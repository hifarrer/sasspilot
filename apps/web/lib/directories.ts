import type { Prisma } from "@prisma/client";
import { db } from "./db";

export interface DirectoryQuery {
  q?: string;
  category?: string;
  cost?: string;
  backlink?: string;
  minDR?: number;
  page?: number;
  pageSize?: number;
  sort?: "clakr" | "dr" | "name" | "rank";
}

// clakr.com lists categories in this curated, startup-relevance order (not
// alphabetical, not by authority) — "Launchpads & Startups" leads. Mirroring it
// keeps our grouped view in step with clakr's homepage.
export const CLAKR_CATEGORY_ORDER = [
  "Launchpads & Startups",
  "AI Directories",
  "SaaS & Alternatives",
  "Software Reviews",
  "Tech Press",
  "Communities",
  "Reddit",
  "Design",
  "Dev & Open Source",
  "Marketplaces & Deals",
  "General Directories",
  "Other",
];

// Within a category, clakr leads with every editor's pick ("top"), each block
// then ordered by Domain Rating, with clakr's own category rank breaking ties.
const WITHIN_CATEGORY_ORDER: Prisma.DirectoryOrderByWithRelationInput[] = [
  { editorsPick: "desc" },
  { domainRating: "desc" },
  { categoryRank: "asc" },
  { name: "asc" },
];

function buildWhere(query: DirectoryQuery): Prisma.DirectoryWhereInput {
  const where: Prisma.DirectoryWhereInput = {};
  if (query.q) {
    where.OR = [
      { name: { contains: query.q } },
      { domain: { contains: query.q } },
      { knownFor: { contains: query.q } },
    ];
  }
  if (query.category) where.category = query.category;
  if (query.cost) where.cost = query.cost;
  if (query.backlink) where.backlinkType = query.backlink;
  if (query.minDR != null) where.domainRating = { gte: query.minDR };
  return where;
}

export async function listDirectories(query: DirectoryQuery) {
  const pageSize = Math.min(100, query.pageSize ?? 30);
  const page = Math.max(1, query.page ?? 1);

  const where = buildWhere(query);

  // Default ("clakr") mirrors clakr.com's ordering: editor's picks ("top") lead,
  // then by Domain Rating, with clakr's own category rank breaking DR ties.
  const orderBy: Prisma.DirectoryOrderByWithRelationInput[] =
    query.sort === "name"
      ? [{ name: "asc" }]
      : query.sort === "rank"
        ? [{ categoryRank: "asc" }]
        : query.sort === "dr"
          ? [{ domainRating: "desc" }, { name: "asc" }]
          : WITHIN_CATEGORY_ORDER;

  const [items, total] = await Promise.all([
    db.directory.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
    db.directory.count({ where }),
  ]);

  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export type DirectoryListItem = Awaited<ReturnType<typeof listDirectories>>["items"][number];

export interface DirectoryGroup {
  category: string;
  count: number;
  items: DirectoryListItem[];
}

/**
 * Sites grouped into category sections the way clakr.com's homepage shows them:
 * categories in clakr's curated order, each section led by its editor's picks
 * and then ordered by Domain Rating. Honors the same filters as listDirectories.
 */
export async function listDirectoriesGrouped(
  query: DirectoryQuery,
): Promise<{ groups: DirectoryGroup[]; total: number }> {
  const where = buildWhere(query);
  const items = await db.directory.findMany({ where, orderBy: WITHIN_CATEGORY_ORDER });

  const byCategory = new Map<string, DirectoryListItem[]>();
  for (const item of items) {
    const category = item.category ?? "Other";
    const list = byCategory.get(category) ?? [];
    list.push(item);
    byCategory.set(category, list);
  }

  const rank = (c: string) => {
    const i = CLAKR_CATEGORY_ORDER.indexOf(c);
    return i === -1 ? CLAKR_CATEGORY_ORDER.length : i;
  };
  const groups = [...byCategory.entries()]
    .map(([category, list]) => ({ category, count: list.length, items: list }))
    .sort((a, b) => rank(a.category) - rank(b.category) || a.category.localeCompare(b.category));

  return { groups, total: items.length };
}

export function getDirectory(slug: string) {
  return db.directory.findUnique({ where: { slug } });
}

/** Distinct categories with counts, for the filter UI. */
export async function getCategoryFacets() {
  const groups = await db.directory.groupBy({
    by: ["category"],
    _count: { _all: true },
  });
  return groups
    .filter((g) => g.category)
    .map((g) => ({ name: g.category as string, count: g._count._all }))
    .sort((a, b) => b.count - a.count);
}

export async function getStats() {
  const [total, free, dofollow] = await Promise.all([
    db.directory.count(),
    db.directory.count({ where: { cost: "free" } }),
    db.directory.count({ where: { backlinkType: "dofollow" } }),
  ]);
  return { total, free, dofollow };
}
