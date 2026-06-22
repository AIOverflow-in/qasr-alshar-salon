import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Clock } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { Reveal } from "@/components/Reveal";
import { prisma } from "@/lib/prisma";
import { pageMeta, breadcrumbSchema } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

export const revalidate = 600;

export const metadata: Metadata = pageMeta({
  title: "Beauty Journal — Tips & Trends",
  description:
    "The Qasr Alshar beauty journal — expert tips on braiding, henna, hair care, skincare and bridal beauty for Dubai. Fresh articles every other day.",
  path: "/blog",
  keywords: ["beauty blog Dubai", "hair care tips", "henna tips", "salon blog UAE"],
});

function fmt(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export default async function BlogPage() {
  const posts = await prisma.blogPost
    .findMany({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" } })
    .catch(() => []);

  const [featured, ...rest] = posts;

  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Blog", path: "/blog" }])} />
      <PageHero
        eyebrow="Journal"
        title="Beauty Journal"
        subtitle="Tips, trends and inspiration from Dubai's crown of beauty."
        image="/salon/salon-facial.jpg"
        crumbs={[{ name: "Blog", href: "/blog" }]}
      />

      <section className="section-y">
        <div className="container-x">
          {posts.length === 0 ? (
            <p className="text-center text-sand/70">
              Our first articles are on the way — check back soon!
            </p>
          ) : (
            <>
              {/* featured */}
              <Reveal>
                <Link
                  href={`/blog/${featured.slug}`}
                  className="surface surface-hover group grid overflow-hidden rounded-3xl md:grid-cols-2"
                >
                  <div className="relative aspect-[16/10] md:aspect-auto">
                    <Image
                      src={featured.heroImage || "/gallery/hero.jpg"}
                      alt={featured.title}
                      fill
                      sizes="(max-width:768px) 100vw, 50vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-col justify-center p-8">
                    <span className="text-xs uppercase tracking-wider text-gold">
                      {featured.category}
                    </span>
                    <h2 className="mt-3 font-display text-3xl leading-tight text-cream group-hover:text-gold">
                      {featured.title}
                    </h2>
                    <p className="mt-3 text-sand/80">{featured.excerpt}</p>
                    <div className="mt-5 flex items-center gap-4 text-xs text-muted">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays size={14} /> {fmt(featured.publishedAt)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock size={14} /> {featured.readingMinutes} min read
                      </span>
                    </div>
                  </div>
                </Link>
              </Reveal>

              {/* grid */}
              <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {rest.map((p, i) => (
                  <Reveal key={p.id} delay={(i % 3) * 70}>
                    <Link
                      href={`/blog/${p.slug}`}
                      className="surface surface-hover group flex h-full flex-col overflow-hidden rounded-2xl"
                    >
                      <div className="relative aspect-[16/10] overflow-hidden">
                        <Image
                          src={p.heroImage || "/gallery/hero.jpg"}
                          alt={p.title}
                          fill
                          sizes="(max-width:768px) 100vw, 33vw"
                          className="object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      </div>
                      <div className="flex flex-1 flex-col p-6">
                        <span className="text-xs uppercase tracking-wider text-gold">
                          {p.category}
                        </span>
                        <h3 className="mt-2 font-display text-xl leading-snug text-cream group-hover:text-gold">
                          {p.title}
                        </h3>
                        <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted">
                          {p.excerpt}
                        </p>
                        <div className="mt-4 flex items-center gap-3 text-xs text-muted">
                          <span>{fmt(p.publishedAt)}</span>
                          <span>· {p.readingMinutes} min</span>
                        </div>
                      </div>
                    </Link>
                  </Reveal>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
