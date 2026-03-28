export type FallacyItem = {
  id: string;
  hierarchy: string[];
  category: string;
  type: string;
  subtype: string;
  variation: string;
  name: string;
  shortMeaning: string;
  description: string;
  examples: string[];
  searchableText: string;
};

export type HierarchyNode = {
  id: string;
  label: string;
  depth: number;
  path: string[];
  count: number;
  children: HierarchyNode[];
};

export type FallacyDataset = {
  generatedAt: string;
  sourceFile: string;
  itemCount: number;
  topLevelCount: number;
  items: FallacyItem[];
  tree: HierarchyNode[];
};

export type FallacyMatch = {
  item: FallacyItem;
  score: number;
  matchedTerms: string[];
  reason: string;
};
