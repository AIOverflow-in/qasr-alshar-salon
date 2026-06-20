import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { CATEGORIES } from "@/lib/services";
import { prisma } from "@/lib/prisma";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE.url;

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, priority: 1, changeFrequency: "weekly" },
    { url: `${base}/services`, priority: 0.9, changeFrequency: "monthly" },
    { url: `${base}/henna`, priority: 0.8, changeFrequency: "monthly" },
    { url: `${base}/packages`, priority: 0.7, changeFrequency: "monthly" },
    { url: `${base}/gallery`, priority: 0.6, changeFrequency: "monthly" },
    { url: `${base}/about`, priority: 0.5, changeFrequency: "yearly" },
    { url: `${base}/contact`, priority: 0.6, changeFrequency: "yearly" },
    { url: `${base}/blog`, priority: 0.8, changeFrequency: "daily" },
    { url: `${base}/book`, priority: 0.9, changeFrequency: "monthly" },
  ];

  const serviceRoutes: MetadataRoute.Sitemap = CATEGORIES.map((c) => ({
    url: `${base}/services/${c.slug}`,
    priority: 0.8,
    changeFrequency: "monthly",
  }));

  const posts = await prisma.blogPost
    .findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
    })
    .catch(() => []);

  const postRoutes: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${base}/blog/${p.slug}`,
    lastModified: p.updatedAt,
    priority: 0.7,
    changeFrequency: "monthly",
  }));

  return [...staticRoutes, ...serviceRoutes, ...postRoutes];
}
