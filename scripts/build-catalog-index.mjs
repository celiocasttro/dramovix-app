import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const catalogDir = path.join(root, "public", "catalogo", "filmesseries");
const outputDir = path.join(catalogDir, "data");
const manifestPath = path.join(catalogDir, "manifesto.json");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    if (row.some((value) => value !== "")) rows.push(row);
  }
  return rows;
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "categoria";
}

async function main() {
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });

  const categories = new Map();
  const usedSlugs = new Map();
  let totalRows = 0;

  for (const part of manifest.parts) {
    const filePath = path.join(catalogDir, part.file);
    const text = await fs.readFile(filePath, "utf8");
    const rows = parseCsv(text);
    if (!rows.length) continue;

    const headers = rows[0].map((header) => header.trim());
    const column = (name) => headers.indexOf(name);
    const titleIndex = column("Nome");
    const categoryIndex = column("Categoria");
    const coverIndex = column("Capa");
    const originalIndex = column("LinkOriginal");
    const finalIndex = column("LinkFinal");

    if (titleIndex < 0 || categoryIndex < 0) {
      throw new Error(`Cabeçalhos obrigatórios não encontrados em ${part.file}`);
    }

    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i];
      const title = (row[titleIndex] || "").trim();
      const category = (row[categoryIndex] || "").trim();
      if (!title || !category) continue;

      const cover = (row[coverIndex] || "").trim();
      const videoUrl =
        (row[originalIndex] || "").trim() ||
        (row[finalIndex] || "").trim();
      if (!categories.has(category)) {
        let slug = slugify(category);
        const previous = usedSlugs.get(slug);
        if (previous && previous !== category) {
          slug += "-" + (categories.size + 1);
        }
        usedSlugs.set(slug, category);
        categories.set(category, { slug, items: [] });
      }
      const bucket = categories.get(category);
      bucket.items.push({
        id: `${bucket.slug}-${bucket.items.length + 1}`,
        title,
        category,
        cover,
        videoUrl,
      });
      totalRows += 1;
    }

    console.log(`Processado ${part.file}: ${rows.length - 1} linhas`);
  }

  const index = [];
  for (const [category, bucket] of categories.entries()) {
    const type = /^SÉRIES\s*\|/i.test(category)
      ? "series"
      : /^FILMES\s*\|/i.test(category) || /^FILMES$/i.test(category)
        ? "movies"
        : "other";
    index.push({
      name: category,
      slug: bucket.slug,
      count: bucket.items.length,
      type,
      file: `${bucket.slug}.json`,
    });
    await fs.writeFile(
      path.join(outputDir, `${bucket.slug}.json`),
      JSON.stringify(bucket.items),
      "utf8"
    );
  }

  index.sort((a, b) => {
    const groupOrder = { movies: 0, series: 1, other: 2 };
    return (
      groupOrder[a.type] - groupOrder[b.type] ||
      a.name.localeCompare(b.name, "pt-BR")
    );
  });

  await fs.writeFile(
    path.join(outputDir, "index.json"),
    JSON.stringify({ total: totalRows, categories: index }),
    "utf8"
  );

  console.log(
    `Índice criado: ${totalRows} registros em ${index.length} categorias.`
  );
}

main().catch((error) => {
  console.error("Falha ao preparar o catálogo DRAMOVIX:", error);
  process.exitCode = 1;
});
