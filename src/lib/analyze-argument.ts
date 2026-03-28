import type { FallacyDataset, FallacyItem, FallacyMatch } from "./fallacy-types";

const STOPWORDS = new Set([
  "yang",
  "dan",
  "atau",
  "karena",
  "jadi",
  "untuk",
  "dengan",
  "dalam",
  "tidak",
  "bisa",
  "pada",
  "dari",
  "bahwa",
  "adalah",
  "itu",
  "ini",
  "the",
  "a",
  "an",
  "of",
  "to",
  "is",
  "are",
  "be",
  "if",
  "then",
  "than",
  "more",
  "less",
  "very",
]);

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string) {
  return normalizeText(text)
    .split(" ")
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function uniqueTokens(tokens: string[]) {
  return Array.from(new Set(tokens));
}

function scoreItem(input: string, item: FallacyItem): FallacyMatch | null {
  const inputTokens = uniqueTokens(tokenize(input));
  if (inputTokens.length === 0) {
    return null;
  }

  const itemTokens = new Set(tokenize(item.searchableText));
  const matchedTerms = inputTokens.filter((token) => itemTokens.has(token));
  const overlapScore = matchedTerms.length / Math.max(inputTokens.length, 1);

  const exactExampleHit = item.examples.some((example) =>
    normalizeText(example).includes(normalizeText(input).slice(0, 42)),
  );

  const phraseBoost =
    normalizeText(item.name).split(" ").some((token) => token.length > 4 && normalizeText(input).includes(token))
      ? 0.16
      : 0;

  const descriptionBoost = inputTokens.some((token) => tokenize(item.description).includes(token)) ? 0.12 : 0;
  const exampleBoost = matchedTerms.length >= 3 ? 0.2 : matchedTerms.length >= 2 ? 0.12 : 0;
  const exactBoost = exactExampleHit ? 0.24 : 0;

  const score = Math.min(0.99, overlapScore + phraseBoost + descriptionBoost + exampleBoost + exactBoost);

  if (score < 0.18) {
    return null;
  }

  const reason =
    matchedTerms.length > 0
      ? `Mirip dengan kata kunci ${matchedTerms.slice(0, 4).join(", ")} dari penjelasan dan contoh.`
      : "Punya kemiripan pola dengan deskripsi dan contoh dalam database.";

  return {
    item,
    score,
    matchedTerms: matchedTerms.slice(0, 6),
    reason,
  };
}

export function analyzeArgument(input: string, dataset: FallacyDataset) {
  const matches = dataset.items
    .map((item) => scoreItem(input, item))
    .filter((item): item is FallacyMatch => Boolean(item))
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);

  const strongest = matches[0];
  const hasStrongMatch = Boolean(strongest && strongest.score >= 0.34);

  return {
    hasStrongMatch,
    strongestScore: strongest?.score ?? 0,
    matches,
    summary: hasStrongMatch
      ? "Argumen ini punya kemiripan cukup kuat dengan beberapa pola falasi di database."
      : "Belum ada kecocokan yang cukup kuat. Bisa jadi argumen ini tidak falasional, atau butuh contoh yang lebih lengkap.",
  };
}
