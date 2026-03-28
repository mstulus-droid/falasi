"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { analyzeArgument } from "@/lib/analyze-argument";
import type { FallacyDataset, FallacyItem, HierarchyNode } from "@/lib/fallacy-types";

type Props = {
  data: FallacyDataset;
};

const DEFAULT_ARGUMENT =
  "Tes ini 99% akurat dan hasilku positif, jadi jelas aku pasti sakit.";

export function FallacyExplorer({ data }: Props) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(data.items[0]?.id ?? "");
  const [argument, setArgument] = useState(DEFAULT_ARGUMENT);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(true);
  const [openNodeIds, setOpenNodeIds] = useState<Set<string>>(() => new Set());
  const [expandDepth, setExpandDepth] = useState(-1);
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const summaryRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const navScrollRef = useRef<HTMLElement>(null);
  const navHeaderRef = useRef<HTMLDivElement>(null);
  const [activeStickyPath, setActiveStickyPath] = useState<string[]>([]);

  const deferredQuery = useDeferredValue(query);
  const deferredArgument = useDeferredValue(argument);
  const selected = data.items.find((item) => item.id === selectedId) ?? data.items[0];

  const filteredItems = filterItems(data.items, deferredQuery);
  const visibleIds = new Set(filteredItems.map((item) => item.id));
  const filteredTree = filterTree(data.tree, visibleIds);
  const analysis = analyzeArgument(deferredArgument, { ...data, items: filteredItems.length > 0 ? filteredItems : data.items });
  const searchRecommendations = filteredItems.slice(0, 8);
  const maxTreeDepth = useMemo(() => getMaxDepth(data.tree), [data.tree]);
  const visibleNodeIds = flattenTreeIds(filteredTree);
  const nodeLookup = useMemo(() => createNodeLookup(data.tree), [data.tree]);

  useEffect(() => {
    const target = itemRefs.current.get(selectedId);
    if (target) {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [selectedId]);

  useEffect(() => {
    const container = navScrollRef.current;
    const header = navHeaderRef.current;
    if (!container || !header) {
      return;
    }

    const updateStickyPath = () => {
      const threshold = header.getBoundingClientRect().bottom + 6;
      let activeNodeId: string | null = null;

      for (const nodeId of visibleNodeIds) {
        const element = summaryRefs.current.get(nodeId);
        if (!element) {
          continue;
        }

        const rect = element.getBoundingClientRect();
        if (rect.top <= threshold) {
          activeNodeId = nodeId;
        } else {
          break;
        }
      }

      if (!activeNodeId && visibleNodeIds.length > 0) {
        activeNodeId = visibleNodeIds[0];
      }

      setActiveStickyPath(activeNodeId ? (nodeLookup.get(activeNodeId)?.path ?? []) : []);
    };

    updateStickyPath();
    container.addEventListener("scroll", updateStickyPath, { passive: true });
    window.addEventListener("resize", updateStickyPath);

    return () => {
      container.removeEventListener("scroll", updateStickyPath);
      window.removeEventListener("resize", updateStickyPath);
    };
  }, [visibleNodeIds, nodeLookup, openNodeIds, query]);

  function focusNavigatorToSelected(smooth = true) {
    const target = itemRefs.current.get(selectedId);
    if (target) {
      target.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
    }
  }

  function isMobileViewport() {
    return typeof window !== "undefined" && window.matchMedia("(max-width: 1279px)").matches;
  }

  function handleSelectItem(id: string) {
    const item = data.items.find((entry) => entry.id === id);
    if (item) {
      setOpenNodeIds((current) => {
        const next = new Set(current);
        for (const ancestorId of getAncestorNodeIds(item)) {
          next.add(ancestorId);
        }
        return next;
      });
    }
    setSelectedId(id);
    if (isMobileViewport()) {
      setIsDetailOpen(true);
    }
  }

  function handleCollapseAll() {
    setOpenNodeIds(new Set());
    setExpandDepth(-1);
  }

  function handleExpandAll() {
    setOpenNodeIds(getNodeIdsUpToDepth(data.tree, maxTreeDepth));
    setExpandDepth(maxTreeDepth);
  }

  function handleExpandStep() {
    const nextDepth = Math.min(maxTreeDepth, expandDepth + 1);
    setOpenNodeIds(getNodeIdsUpToDepth(data.tree, nextDepth));
    setExpandDepth(nextDepth);
  }

  function handleCollapseStep() {
    const nextDepth = Math.max(-1, expandDepth - 1);
    setOpenNodeIds(nextDepth >= 0 ? getNodeIdsUpToDepth(data.tree, nextDepth) : new Set());
    setExpandDepth(nextDepth);
  }

  function toggleNode(nodeId: string) {
    setOpenNodeIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8">
      <section className="fade-up grid min-h-[calc(100vh-2rem)] flex-1 gap-5 xl:grid-cols-[460px_minmax(0,1fr)]">
        <aside ref={navScrollRef} className="glass-panel fine-scrollbar rounded-[28px] p-5 sm:p-6 xl:h-[calc(100vh-2rem)] xl:overflow-auto">
            <div ref={navHeaderRef} className="sticky top-0 z-20 -mx-5 -mt-5 mb-4 border-b border-[var(--border)] bg-[rgba(255,252,246,0.99)] shadow-[0_10px_24px_rgba(67,41,16,0.06)] backdrop-blur-md sm:-mx-6 sm:-mt-6">
            <div className="absolute inset-x-0 -top-10 h-10 rounded-t-[28px] bg-[rgba(255,252,246,0.99)]" aria-hidden="true" />
            <div className="relative space-y-2 rounded-t-[28px] px-4 py-4 sm:px-5 sm:py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="section-title">Navigator</p>
                <h2 className="mt-1 text-xl font-semibold text-[var(--accent-strong)]">Hierarki Falasi</h2>
              </div>
              <div className="flex flex-wrap justify-end gap-1.5">
                <button
                  type="button"
                  onClick={handleCollapseAll}
                  className="rounded-full border border-[var(--border)] bg-white/75 p-1.5 text-[var(--ink-soft)] transition hover:bg-white hover:text-[var(--accent-strong)]"
                  aria-label="Collapse all"
                  title="Collapse all"
                >
                  <CollapseAllIcon />
                </button>
                <button
                  type="button"
                  onClick={handleExpandAll}
                  className="rounded-full border border-[var(--border)] bg-white/75 p-1.5 text-[var(--ink-soft)] transition hover:bg-white hover:text-[var(--accent-strong)]"
                  aria-label="Expand all"
                  title="Expand all"
                >
                  <ExpandAllIcon />
                </button>
                <button
                  type="button"
                  onClick={handleCollapseStep}
                  className="rounded-full border border-[var(--border)] bg-white/75 p-1.5 text-[var(--ink-soft)] transition hover:bg-white hover:text-[var(--accent-strong)]"
                  aria-label="Collapse bertahap"
                  title="Collapse bertahap"
                >
                  <StepLeftIcon />
                </button>
                <button
                  type="button"
                  onClick={handleExpandStep}
                  className="rounded-full border border-[var(--border)] bg-white/75 p-1.5 text-[var(--ink-soft)] transition hover:bg-white hover:text-[var(--accent-strong)]"
                  aria-label="Expand bertahap"
                  title="Expand bertahap"
                >
                  <StepRightIcon />
                </button>
              </div>
            </div>
            <label className="block">
              <span className="relative block">
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setShowRecommendations(true);
                }}
                onFocus={() => {
                  if (query.trim()) {
                    setShowRecommendations(true);
                  }
                }}
                placeholder="cari falasi"
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-2.5 pr-10 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setShowRecommendations(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[var(--ink-soft)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--accent-strong)]"
                  aria-label="Hapus pencarian"
                >
                  <CloseIcon />
                </button>
              )}
              </span>
            </label>

            {query.trim() && showRecommendations && (
              <div className="rounded-[24px] border border-[var(--border)] bg-white/60 p-3">
                <p className="mb-2 text-xs font-semibold tracking-[0.12em] text-[var(--ink-soft)] uppercase">
                  Rekomendasi realtime
                </p>
                <div className="space-y-2">
                  {searchRecommendations.map((item) => (
                    <button
                      key={`search-${item.id}`}
                      type="button"
                      onClick={() => {
                        handleSelectItem(item.id);
                        setShowRecommendations(false);
                      }}
                      className="block w-full rounded-[18px] border border-transparent bg-white/80 px-3 py-3 text-left transition hover:border-[var(--border)] hover:bg-[var(--surface-soft)]"
                    >
                      <p className="text-sm font-semibold text-[var(--foreground)]">{item.name}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--ink-soft)]">{item.description}</p>
                    </button>
                  ))}
                  {searchRecommendations.length === 0 && (
                    <p className="text-sm leading-6 text-[var(--ink-soft)]">Belum ada rekomendasi yang cocok.</p>
                  )}
                </div>
              </div>
            )}

            {activeStickyPath.length > 0 && (
              <div className="overflow-hidden rounded-[18px] border border-[var(--border)] bg-white/72">
                {activeStickyPath.map((segment, index) => (
                  <div
                    key={`sticky-${index}-${segment}`}
                    className={clsx(
                      "flex items-center gap-2 px-3 py-1.5 text-sm",
                      index > 0 && "border-t border-[rgba(88,68,43,0.08)]",
                    )}
                  >
                    <span
                      className="inline-flex w-[72px] shrink-0 justify-center rounded-full bg-[var(--surface-soft)] px-2 py-1 text-[10px] tracking-[0.12em] text-[var(--accent-strong)] uppercase"
                      style={{ marginLeft: `${index * 16}px` }}
                    >
                      {getLevelLabel(index)}
                    </span>
                    <span className="font-semibold text-[var(--foreground)]">{segment}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>

          <div className="space-y-2 pt-1">
            {filteredTree.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                selectedId={selected.id}
                itemMap={filteredItems}
                onSelect={handleSelectItem}
                openNodeIds={openNodeIds}
                onToggleNode={toggleNode}
                registerItemRef={(id, element) => {
                  if (element) {
                    itemRefs.current.set(id, element);
                  } else {
                    itemRefs.current.delete(id);
                  }
                }}
                registerSummaryRef={(id, element) => {
                  if (element) {
                    summaryRefs.current.set(id, element);
                  } else {
                    summaryRefs.current.delete(id);
                  }
                }}
              />
            ))}
            {filteredTree.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white/40 p-4 text-sm leading-6 text-[var(--ink-soft)]">
                Tidak ada hasil untuk pencarian ini. Coba kata lain atau kosongkan filter.
              </div>
            )}
          </div>
        </aside>

        <section className="hidden glass-panel fine-scrollbar rounded-[28px] p-6 sm:p-7 xl:block xl:h-[calc(100vh-2rem)] xl:overflow-auto">
          <div className="fade-up space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <p className="section-title">Detail Falasi</p>
                <div>
                  <button
                    type="button"
                    onClick={() => focusNavigatorToSelected(true)}
                    className="max-w-3xl text-left text-3xl leading-tight font-semibold text-[var(--accent-strong)] transition hover:opacity-80"
                    title="Fokuskan falasi ini di navigator"
                  >
                    {selected.name}
                  </button>
                  <p className="mt-2 text-lg text-[var(--olive)]">{selected.shortMeaning}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selected.hierarchy.map((segment, index) => (
                    <span
                      key={`${selected.id}-hierarchy-${index}-${segment}`}
                      className="rounded-full border border-[var(--border)] bg-white/70 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-[var(--ink-soft)] uppercase"
                    >
                      {segment}
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAnalysisOpen(true)}
                className="hidden rounded-[24px] bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(110,49,23,0.24)] transition hover:brightness-105 xl:inline-flex"
              >
                Buka Kotak Uji
              </button>
            </div>

            <article className="rounded-[28px] bg-[var(--surface-strong)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
              <p className="section-title">Penjelasan</p>
              <p className="mt-4 max-w-5xl text-base leading-8 text-[var(--foreground)] sm:text-lg">
                {selected.description}
              </p>
            </article>

            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {selected.examples.map((example, index) => (
                <article
                  key={`${selected.id}-${index}`}
                  className="rounded-[26px] border border-[var(--border)] bg-white/70 p-6 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_30px_rgba(67,41,16,0.08)]"
                >
                  <p className="section-title">Contoh {index + 1}</p>
                  <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">{example}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </section>

      {isDetailOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-[rgba(31,41,55,0.35)] p-3 backdrop-blur-sm xl:hidden">
          <div className="glass-panel fine-scrollbar max-h-[88vh] w-full max-w-3xl overflow-auto rounded-[32px] p-5 shadow-[0_24px_60px_rgba(31,41,55,0.22)]">
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                  <p className="section-title">Detail Falasi</p>
                  <div>
                    <button
                      type="button"
                      onClick={() => focusNavigatorToSelected(true)}
                      className="text-left text-2xl leading-tight font-semibold text-[var(--accent-strong)] transition hover:opacity-80"
                      title="Fokuskan falasi ini di navigator"
                    >
                      {selected.name}
                    </button>
                    <p className="mt-2 text-base text-[var(--olive)]">{selected.shortMeaning}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDetailOpen(false)}
                  className="rounded-full border border-[var(--border)] bg-white/70 p-2 text-[var(--accent-strong)] transition hover:bg-white"
                  aria-label="Tutup detail falasi"
                >
                  <CloseIcon />
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {selected.hierarchy.map((segment, index) => (
                  <span
                    key={`${selected.id}-mobile-hierarchy-${index}-${segment}`}
                    className="rounded-full border border-[var(--border)] bg-white/70 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-[var(--ink-soft)] uppercase"
                  >
                    {segment}
                  </span>
                ))}
              </div>

              <article className="rounded-[28px] bg-[var(--surface-strong)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                <p className="section-title">Penjelasan</p>
                <p className="mt-4 text-base leading-8 text-[var(--foreground)]">{selected.description}</p>
              </article>

              <div className="grid gap-4">
                {selected.examples.map((example, index) => (
                  <article
                    key={`${selected.id}-mobile-example-${index}`}
                    className="rounded-[26px] border border-[var(--border)] bg-white/70 p-5"
                  >
                    <p className="section-title">Contoh {index + 1}</p>
                    <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">{example}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsAnalysisOpen(true)}
        className="fixed right-4 bottom-4 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-[0_18px_34px_rgba(110,49,23,0.3)] transition hover:brightness-105 xl:hidden"
        aria-label="Buka kotak uji"
        title="Buka kotak uji"
      >
        <SparkIcon />
      </button>

      {isAnalysisOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(31,41,55,0.35)] p-3 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="glass-panel fine-scrollbar w-full max-w-6xl rounded-[32px] p-5 shadow-[0_24px_60px_rgba(31,41,55,0.22)] sm:max-h-[88vh] sm:overflow-auto sm:p-6">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="section-title">Kotak Uji</p>
                    <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--accent-strong)] sm:text-4xl">
                      Uji argumenmu
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                      Masukkan argumen, lalu sistem akan mencocokkannya ke database falasi berdasarkan nama,
                      penjelasan, dan contoh yang paling dekat.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAnalysisOpen(false)}
                    className="rounded-full border border-[var(--border)] bg-white/70 px-3 py-2 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-white"
                  >
                    Tutup
                  </button>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[var(--ink-soft)]">Argumen yang ingin diuji</span>
                  <textarea
                    value={argument}
                    onChange={(event) => setArgument(event.target.value)}
                    rows={11}
                    className="w-full rounded-[24px] border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-4 text-sm leading-7 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                  />
                </label>
              </div>

              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="section-title">Hasil</p>
                    <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--accent-strong)] sm:text-4xl">
                      Kandidat falasi
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAnalysisOpen(false)}
                    className="rounded-full border border-[var(--border)] bg-white/70 p-2 text-[var(--accent-strong)] transition hover:bg-white"
                    aria-label="Tutup kotak uji"
                  >
                    <CloseIcon />
                  </button>
                </div>

                <div className="rounded-[24px] bg-[var(--surface-soft)] p-4">
                  <p className="font-medium text-[var(--accent-strong)]">{analysis.summary}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
                    Ini masih mesin similarity, jadi hasilnya cocok untuk eksplorasi awal dan validasi database.
                  </p>
                </div>

                <div className="space-y-3">
                  {analysis.matches.map((match, index) => (
                    <button
                      key={match.item.id}
                      type="button"
                      onClick={() => {
                        handleSelectItem(match.item.id);
                        setIsAnalysisOpen(false);
                      }}
                      className="w-full rounded-[24px] border border-[var(--border)] bg-white/80 p-4 text-left transition hover:border-[var(--accent)] hover:bg-white"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <p className="font-semibold text-[var(--foreground)]">
                          {index + 1}. {match.item.name}
                        </p>
                        <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 font-mono text-xs font-semibold text-[var(--accent-strong)]">
                          {Math.round(match.score * 100)}%
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-[var(--olive)]">{match.item.shortMeaning}</p>
                      <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">{match.reason}</p>
                    </button>
                  ))}

                  {analysis.matches.length === 0 && (
                    <div className="rounded-[24px] border border-dashed border-[var(--border)] bg-white/50 p-4 text-sm leading-7 text-[var(--ink-soft)]">
                      Belum ada kandidat kuat. Nanti ini bisa kita naikkan lagi dengan semantic search atau AI.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function filterItems(items: FallacyItem[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return items;
  }

  return [...items]
    .map((item) => {
      const nameText = item.name.toLowerCase();
      const descriptionText = item.description.toLowerCase();
      const searchText = item.searchableText.toLowerCase();

      let score = 0;
      if (nameText.includes(normalized)) score += 5;
      if (descriptionText.includes(normalized)) score += 3;
      if (searchText.includes(normalized)) score += 1;

      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .map(({ item }) => item);
}

function filterTree(nodes: HierarchyNode[], visibleIds: Set<string>) {
  const next: HierarchyNode[] = [];

  for (const node of nodes) {
    const children = filterTree(node.children, visibleIds);
    const keepNode = children.length > 0 || Array.from(visibleIds).some((id) => id.startsWith(`${node.id}::`));

    if (keepNode) {
      next.push({
        ...node,
        children,
      });
    }
  }

  return next;
}

function TreeNode({
  node,
  selectedId,
  itemMap,
  onSelect,
  openNodeIds,
  onToggleNode,
  registerItemRef,
  registerSummaryRef,
}: {
  node: HierarchyNode;
  selectedId: string;
  itemMap: FallacyItem[];
  onSelect: (id: string) => void;
  openNodeIds: Set<string>;
  onToggleNode: (id: string) => void;
  registerItemRef: (id: string, element: HTMLButtonElement | null) => void;
  registerSummaryRef: (id: string, element: HTMLDivElement | null) => void;
}) {
  const relatedItems = itemMap.filter(
    (item) =>
      item.hierarchy.length === node.path.length &&
      item.hierarchy.every((segment, index) => segment === node.path[index]),
  );
  const levelLabel = getLevelLabel(node.depth);
  const hasExpandableContent = node.children.length > 0 || relatedItems.length > 0;
  const isOpen = openNodeIds.has(node.id);

  return (
    <details className="group rounded-[22px] bg-white/55 px-3 py-1.5" open={isOpen}>
      <summary
        className="list-none"
        onClick={(event) => {
          event.preventDefault();
          if (hasExpandableContent) {
            onToggleNode(node.id);
          }
        }}
      >
        <div
          ref={(element) => registerSummaryRef(node.id, element)}
          className="flex items-center justify-between gap-3 rounded-[18px] bg-[rgba(255,252,246,0.72)] px-3 py-1.5"
        >
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
            <span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-[10px] tracking-[0.12em] text-[var(--accent-strong)] uppercase">
              {levelLabel}
            </span>
            <span>{node.label}</span>
            <span className="text-[11px] font-medium tracking-[0.08em] text-[color:rgba(94,90,82,0.72)] uppercase">
              {node.count} item
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-[var(--accent-strong)]">
          {hasExpandableContent ? (
            node.children.length > 0 ? (
              <>
                <span className={clsx(isOpen && "hidden")} aria-hidden="true">
                  <FolderClosedIcon />
                </span>
                <span className={clsx(!isOpen && "hidden")} aria-hidden="true">
                  <FolderOpenIcon />
                </span>
              </>
            ) : (
              <>
                <span className={clsx(isOpen && "hidden")} aria-hidden="true">
                  <ChevronRightIcon />
                </span>
                <span className={clsx(!isOpen && "hidden")} aria-hidden="true">
                  <ChevronDownIcon />
                </span>
              </>
            )
          ) : (
            <span aria-hidden="true">
              <DotIcon />
            </span>
          )}
        </div>
        </div>
      </summary>

      <div className="space-y-2 pb-2 pt-1 pl-2">
        {relatedItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            ref={(element) => registerItemRef(item.id, element)}
            className={clsx(
              "block w-full rounded-[18px] px-3 py-3 text-left transition",
              item.id === selectedId
                ? "bg-[var(--accent)] text-white shadow-[0_10px_24px_rgba(110,49,23,0.24)]"
                : "bg-white/75 text-[var(--foreground)] hover:bg-[var(--surface-soft)]",
            )}
          >
            <p className="text-sm font-semibold">{item.name}</p>
            <p
              className={clsx(
                "mt-1 text-xs leading-5",
                item.id === selectedId ? "text-white/85" : "text-[var(--ink-soft)]",
              )}
            >
              {item.shortMeaning}
            </p>
          </button>
        ))}

        {node.children.map((child) => (
          <TreeNode
            key={child.id}
            node={child}
            selectedId={selectedId}
            itemMap={itemMap}
            onSelect={onSelect}
            openNodeIds={openNodeIds}
            onToggleNode={onToggleNode}
            registerItemRef={registerItemRef}
            registerSummaryRef={registerSummaryRef}
          />
        ))}
      </div>
    </details>
  );
}

function getLevelLabel(depth: number) {
  return ["Kategori", "Tipe", "Subtipe"][depth] ?? "Level";
}

function FolderClosedIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
      <path
        d="M3.75 5.75a1.5 1.5 0 0 1 1.5-1.5h3.1a1.5 1.5 0 0 1 1.06.44l.82.81c.28.28.66.44 1.06.44h3.47a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 8.25h4.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function FolderOpenIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
      <path
        d="M3.75 6.25a1.5 1.5 0 0 1 1.5-1.5h3.1a1.5 1.5 0 0 1 1.06.44l.82.81c.28.28.66.44 1.06.44h4.92a1 1 0 0 1 .96 1.27l-1.26 4.42a1.5 1.5 0 0 1-1.44 1.08H5.18a1.5 1.5 0 0 1-1.46-1.85z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 10.25h5.25" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
      <path
        d="M7 4l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
      <path
        d="M4 7l6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
      <path d="M6 6l8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14 6l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CollapseAllIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
      <path d="M4 6h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 10h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 14h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14 8l2 2-2 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StepRightIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
      <path d="M4 10h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M11 7l4 3-4 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StepLeftIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
      <path d="M6 10h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 7l-4 3 4 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExpandAllIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
      <path d="M4 6h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 14h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M11 7l5 3-5 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DotIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
      <circle cx="10" cy="10" r="2" fill="currentColor" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-6 w-6">
      <path
        d="M10 2.5l1.7 4.3L16 8.5l-4.3 1.7L10 14.5l-1.7-4.3L4 8.5l4.3-1.7L10 2.5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M15.5 13.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" fill="currentColor" />
    </svg>
  );
}

function getNodeIdsUpToDepth(nodes: HierarchyNode[], depth: number) {
  const ids = new Set<string>();

  function walk(items: HierarchyNode[]) {
    for (const item of items) {
      if (item.depth <= depth) {
        ids.add(item.id);
      }
      if (item.children.length > 0) {
        walk(item.children);
      }
    }
  }

  walk(nodes);
  return ids;
}

function getMaxDepth(nodes: HierarchyNode[]) {
  let maxDepth = 0;

  function walk(items: HierarchyNode[]) {
    for (const item of items) {
      maxDepth = Math.max(maxDepth, item.depth);
      if (item.children.length > 0) {
        walk(item.children);
      }
    }
  }

  walk(nodes);
  return maxDepth;
}

function getAncestorNodeIds(item: FallacyItem) {
  const ancestorIds: string[] = [];
  const parts: string[] = [];

  for (const segment of item.hierarchy) {
    parts.push(slugifySegment(segment));
    ancestorIds.push(parts.join("::"));
  }

  return ancestorIds;
}

function slugifySegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function flattenTreeIds(nodes: HierarchyNode[]) {
  const ids: string[] = [];

  function walk(items: HierarchyNode[]) {
    for (const item of items) {
      ids.push(item.id);
      if (item.children.length > 0) {
        walk(item.children);
      }
    }
  }

  walk(nodes);
  return ids;
}

function createNodeLookup(nodes: HierarchyNode[]) {
  const lookup = new Map<string, HierarchyNode>();

  function walk(items: HierarchyNode[]) {
    for (const item of items) {
      lookup.set(item.id, item);
      if (item.children.length > 0) {
        walk(item.children);
      }
    }
  }

  walk(nodes);
  return lookup;
}
