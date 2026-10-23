import dns from "node:dns/promises";
import net from "node:net";

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224;
  }
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    return normalized === "::1" || normalized === "::" ||
      normalized.startsWith("fc") || normalized.startsWith("fd") ||
      normalized.startsWith("fe8") || normalized.startsWith("fe9") ||
      normalized.startsWith("fea") || normalized.startsWith("feb") ||
      normalized.startsWith("::ffff:127.") || normalized.startsWith("::ffff:10.");
  }
  return true;
}

async function validatePublicUrl(raw) {
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Use um endereço HTTP ou HTTPS.");
  if (url.username || url.password) throw new Error("URLs com usuário ou senha não são aceitas.");
  const host = url.hostname.toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    throw new Error("Esse endereço não é permitido.");
  }
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error("Endereço de rede privada não permitido.");
  } else {
    const records = await dns.lookup(host, { all: true, verbatim: true });
    if (!records.length || records.some((record) => isPrivateIp(record.address))) {
      throw new Error("O servidor informado não é um endereço público permitido.");
    }
  }
  return url;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método não permitido." });
  }

  const rawUrl = typeof req.query?.url === "string" ? req.query.url : "";
  if (!rawUrl || rawUrl.length > 2048) {
    return res.status(400).json({ error: "Informe uma URL válida para a playlist." });
  }

  let url;
  try {
    url = await validatePublicUrl(rawUrl);
  } catch (error) {
    return res.status(400).json({ error: error.message || "URL inválida ou não permitida." });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const upstream = await fetch(url, {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
      headers: { Accept: "application/vnd.apple.mpegurl, audio/x-mpegurl, text/plain, */*" }
    });
    if (!upstream.ok) {
      return res.status(502).json({ error: "O servidor da playlist respondeu com HTTP " + upstream.status + "." });
    }
    const declaredLength = Number(upstream.headers.get("content-length") || 0);
    const maxBytes = 4 * 1024 * 1024;
    if (declaredLength > maxBytes) {
      return res.status(413).json({ error: "A playlist é maior que 4 MB. Use o arquivo M3U/M3U8 para importar listas grandes." });
    }
    if (!upstream.body) return res.status(502).json({ error: "O servidor não retornou conteúdo." });

    const reader = upstream.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return res.status(413).json({ error: "A playlist é maior que 4 MB. Use o arquivo M3U/M3U8 para importar listas grandes." });
      }
      chunks.push(Buffer.from(value));
    }
    const text = Buffer.concat(chunks).toString("utf8").replace(/^\uFEFF/, "");
    if (!text.trimStart().startsWith("#EXTM3U")) {
      return res.status(422).json({ error: "A URL não retornou um arquivo de playlist M3U/M3U8." });
    }
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(200).send(text);
  } catch (error) {
    const message = error?.name === "AbortError"
      ? "O servidor demorou demais para responder."
      : "Não foi possível buscar a playlist. O endereço pode bloquear requisições externas ou redirecionar para outro endereço.";
    return res.status(502).json({ error: message });
  } finally {
    clearTimeout(timeout);
  }
}
