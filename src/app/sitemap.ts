import type { MetadataRoute } from "next";
import { SITE } from "@/lib/config";
import {
  allCategories,
  allListingSlugs,
  allLocations,
} from "@/lib/queries";

export const revalidate = 3600;

/** Programmatic sitemap: home, towns, categories, town×top-category, listings. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [towns, cats, slugs] = await Promise.all([
    allLocations(),
    allCategories(),
    allListingSlugs(),
  ]);
  const topCats = cats.filter((c) => !c.parentId);
  const base = SITE.url;
  const now = new Date();

  const urls: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/towns`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/categories`, changeFrequency: "weekly", priority: 0.6 },
  ];

  for (const c of cats) urls.push({ url: `${base}/${c.slug}`, lastModified: now, priority: 0.7 });
  for (const t of towns) {
    urls.push({ url: `${base}/${t.slug}`, lastModified: now, priority: 0.7 });
    for (const c of topCats) urls.push({ url: `${base}/${t.slug}/${c.slug}`, priority: 0.5 });
  }
  for (const slug of slugs) urls.push({ url: `${base}/business/${slug}`, lastModified: now, priority: 0.8 });

  return urls;
}
