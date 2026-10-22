const ALLOWED_SOURCE_HOST = "dbonline.tech-cdn.top";
const MAX_REDIRECTS = 8;

function isPrivateOrLocalHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    host.startsWith("fe80:")
  ) return true;

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const octets = ipv4.slice(1).map(Number);
    if (octets.some((n) => n > 255)) return true;
    const [a, b] = octets;
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  return false;
}

async function followRedirects(startUrl, method, useRange) {
  let current = new URL(startUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (!["http:", "https:"].includes(current.protocol) || isPrivateOrLocalHost(current.hostname)) {
      throw new Error("O endereço do vídeo não é permitido.");
    }

    const headers = {};
    if (method === "GET" && useRange) headers.Range = "bytes=0-0";
    headers["User-Agent"] = "Mozilla/5.0 (compatible; DRAMOVIX/1.0)";
    headers.Accept = "*/*";

    const response = await fetch(current, {
      method,
      redirect: "manual",
      headers,
      signal: AbortSignal.timeout(15000)
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel().catch(() => {});
      if (!location) throw new Error("O servidor redirecionou sem informar o destino.");
      current = new URL(location, current);
      continue;
    }

    const finalUrl = response.url || current.toString();
    const status = response.status;
    await response.body?.cancel().catch(() => {});
    return { url: finalUrl, status };
  }

  throw new Error("O vídeo excedeu o limite de redirecionamentos.");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST para resolver o link." });
  }

  try {
    const rawUrl = typeof req.body?.url === "string" ? req.body.url.trim() : "";
    if (!rawUrl || rawUrl.length > 4096) {
      return res.status(400).json({ error: "Link do vídeo inválido." });
    }

    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return res.status(400).json({ error: "Link do vídeo inválido." });
    }

    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      !(
        parsed.hostname === ALLOWED_SOURCE_HOST ||
        parsed.hostname.endsWith("." + ALLOWED_SOURCE_HOST)
      )
    ) {
      return res.status(400).json({ error: "Este domínio não está autorizado para resolução." });
    }

    // Alguns hosts respondem mal a HEAD ou a pedidos Range. Tentamos GET com
    // Range primeiro, GET normal depois e HEAD por último, sempre cancelando o corpo.
    const attempts = [
      () => followRedirects(parsed.toString(), "GET", true),
      () => followRedirects(parsed.toString(), "GET", false),
      () => followRedirects(parsed.toString(), "HEAD", false)
    ];

    let resolved = null;
    for (const attempt of attempts) {
      try {
        const result = await attempt();
        if (result.status >= 200 && result.status < 400) {
          resolved = result;
          break;
        }
        resolved = result;
      } catch (error) {
        console.warn("Tentativa de resolução falhou:", error?.message || error);
      }
    }

    if (!resolved || resolved.status < 200 || resolved.status >= 400) {
      return res.status(502).json({
        error: "O servidor do vídeo não entregou um link reproduzível.",
        upstreamStatus: resolved?.status || null
      });
    }

    return res.status(200).json({ url: resolved.url });
  } catch (error) {
    console.error("Erro ao resolver link de vídeo:", error);
    return res.status(502).json({
      error: error?.name === "TimeoutError"
        ? "O servidor demorou demais para responder ao buscar o link real."
        : error?.message || "Não foi possível resolver o link do vídeo."
    });
  }
}
