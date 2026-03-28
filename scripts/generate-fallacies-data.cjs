/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const XLSX = require("xlsx");

const workbookPath = path.resolve(__dirname, "../../Falasi.xlsx");
const outputPath = path.resolve(__dirname, "../src/data/fallacies.json");

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function compactHierarchy(parts) {
  const cleaned = parts.map((part) => String(part || "").trim()).filter(Boolean);
  const compacted = [];

  for (const part of cleaned) {
    if (compacted[compacted.length - 1] !== part) {
      compacted.push(part);
    }
  }

  return compacted;
}

function normalizeSpecialHierarchy(row, name) {
  const baseCategory = String(row.Kategori || "").trim();

  if (name === "Correlative-based fallacies" && baseCategory === "Informal fallacies") {
    return null;
  }

  if (
    baseCategory === "Informal fallacies" &&
    (name === "Suppressed correlative" ||
      name.startsWith("False dilemma ("))
  ) {
    return compactHierarchy([baseCategory, "Correlative-based fallacies", ""]);
  }

  if (baseCategory === "Informal fallacies" && name === "False dilemma") {
    return null;
  }

  return compactHierarchy([row.Kategori, row.Tipe, row.Subtipe]);
}

function splitNameAndMeaning(nameCell, meaningCell) {
  const rawName = String(nameCell || "").trim();
  const rawMeaning = String(meaningCell || "").trim();

  if (rawName.includes("\n")) {
    const [firstLine, ...rest] = rawName.split("\n").map((part) => part.trim()).filter(Boolean);
    return {
      name: firstLine || rawMeaning || "Tanpa Nama",
      shortMeaning: rawMeaning || rest.join(" ") || firstLine || "Tanpa arti singkat",
    };
  }

  return {
    name: rawName || "Tanpa Nama",
    shortMeaning: rawMeaning || rawName || "Tanpa arti singkat",
  };
}

function createTree(items) {
  const root = [];
  const nodeMap = new Map();

  for (const item of items) {
    let level = root;

    item.hierarchy.forEach((segment, index) => {
      const pathParts = item.hierarchy.slice(0, index + 1);
      const nodeId = pathParts.map(slugify).join("::");

      if (!nodeMap.has(nodeId)) {
        const node = {
          id: nodeId,
          label: segment,
          depth: index,
          path: pathParts,
          count: 0,
          children: [],
        };

        nodeMap.set(nodeId, node);
        level.push(node);
      }

      const current = nodeMap.get(nodeId);
      current.count += 1;
      level = current.children;
    });
  }

  return root;
}

const workbook = XLSX.readFile(workbookPath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

const items = rows
  .filter((row) => {
    const name = String(row["Nama Falasi"] || "").trim();
    const description = String(row.Penjelasan || "").trim();
    const hasHierarchy = [row.Kategori, row.Tipe, row.Subtipe, row.Variasi].some((value) =>
      String(value || "").trim(),
    );

    return Boolean(name || description || hasHierarchy);
  })
  .map((row) => {
  const { name, shortMeaning } = splitNameAndMeaning(row["Nama Falasi"], row["Arti "]);
  if (!name || name === "Tanpa Nama") {
    return null;
  }
  const hierarchy = normalizeSpecialHierarchy(row, name);
  if (!hierarchy || hierarchy.length === 0) {
    return null;
  }
  const nodeId = hierarchy.map(slugify).join("::");
  const id = `${nodeId}::${slugify(name)}`;
  const examples = [row.__EMPTY, row.__EMPTY_1, row.__EMPTY_2]
    .map((example) => String(example || "").trim())
    .filter((example) => example && example !== "#N/A");
  const description = String(row.Penjelasan || "").trim();
  const searchableText = [
    hierarchy.join(" "),
    name,
    shortMeaning,
    description,
    examples.join(" "),
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    id,
    hierarchy,
    category: hierarchy[0] || "",
    type: hierarchy[1] || hierarchy[0] || "",
    subtype: hierarchy[2] || "",
    variation: "",
    name,
    shortMeaning,
    description,
    examples,
    searchableText,
  };
})
  .filter(Boolean);

const dataset = {
  generatedAt: new Date().toISOString(),
  sourceFile: "Falasi.xlsx",
  itemCount: items.length,
  topLevelCount: new Set(items.map((item) => item.category)).size,
  items,
  tree: createTree(items),
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(dataset, null, 2));

console.log(`Generated ${items.length} fallacies into ${outputPath}`);
