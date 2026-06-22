import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, ArrowLeft } from "lucide-react";
import { Markdown } from "@/components/Markdown";
import { prisma } from "@/lib/prisma";
import { SITE } from "@/lib/site";
import { pageMeta, breadcrumbSchema } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

export const revalidate = 600;

export async function generateStaticParams() {
  const posts = await prisma.blogPost
    .findMany({ where: { status: "PUBLISHED" }, select: { slug: true }, take: 50 })
    .catch(() => []);
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await prisma.blogPost.findUnique({ where: { slug } }).catch(() => null);
  if (!post) return pageMeta({ title: "Article" });
  return {
    ...pageMeta({
      title: post.title,
      description: post.metaDescription,
      path: `/blog/${post.slug}`,
      images: [post.heroImage || "/og/default.jpg"],
      keywords: post.tags,
    }),
    openGraph: {
      type: "article",
      title: post.title,
      description: post.metaDescription,
      url: `${SITE.url}/blog/${post.slug}`,
      images: [{ url: post.heroImage || "/og/default.jpg", width: 1200, height: 630 }],
      publishedTime: post.publishedAt.toISOString(),
    },
  };
}

function fmt(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await prisma.blogPost.findUnique({ where: { slug } }).catch(() => null);
  if (!post || post.status !== "PUBLISHED") notFound();

  const related = await prisma.blogPost
    .findMany({
      where: { status: "PUBLISHED", slug: { not: slug } },
      orderBy: { publishedAt: "desc" },
      take: 3,
    })
    .catch(() => []);

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.metaDescription,
    image: `${SITE.url}${post.heroImage || "/og/default.jpg"}`,
    datePublished: post.publishedAt.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: { "@type": "Organization", name: SITE.name },
    publisher: {
      "@type": "Organization",
      name: SITE.name,
      logo: { "@type": "ImageObject", url: `${SITE.url}/icon.png` },
    },
    mainEntityOfPage: `${SITE.url}/blog/${post.slug}`,
    keywords: post.tags.join(", "),
  };

  return (
    <>
      <JsonLd data={articleSchema} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: post.title, path: `/blog/${post.slug}` },
        ])}
      />

      <article className="pt-24">
        {/* hero — vivid banner image, title sits on the bright page below */}
        <header>
          <div className="relative aspect-[21/9] max-h-[52svh] w-full overflow-hidden rounded-b-3xl">
            <Image
              src={post.heroImage || "/gallery/hero.jpg"}
              alt={post.title}
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
          </div>
          <div className="container-x pt-8 pb-8">
            <Link
              href="/blog"
              className="mb-5 inline-flex items-center gap-2 text-sm text-sand hover:text-gold"
            >
              <ArrowLeft size={16} /> Back to Journal
            </Link>
            <div className="text-xs uppercase tracking-wider text-gold">{post.category}</div>
            <h1 className="mt-3 max-w-3xl font-display text-4xl leading-tight text-cream md:text-5xl">
              {post.title}
            </h1>
            <div className="mt-5 flex items-center gap-5 text-sm text-muted">
              <span className="flex items-center gap-1.5">
                <CalendarDays size={15} /> {fmt(post.publishedAt)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={15} /> {post.readingMinutes} min read
              </span>
            </div>
          </div>
        </header>

        {/* body */}
        <div className="container-x pb-20">
          <div className="mx-auto max-w-3xl">
            <Markdown>{post.contentMarkdown}</Markdown>

            {post.tags.length > 0 && (
              <div className="mt-10 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-ink-line px-3 py-1 text-xs text-sand"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-12 rounded-3xl bg-gold-gradient p-8 text-center text-espresso">
              <h2 className="font-display text-2xl">Ready to treat yourself?</h2>
              <p className="mt-2 text-espresso/80">Book your appointment at Qasr Alshar today.</p>
              <div className="mt-5">
                <Link
                  href="/book"
                  className="inline-flex rounded-full bg-espresso px-7 py-3 font-semibold text-gold transition-transform hover:scale-105"
                >
                  Book Now
                </Link>
              </div>
            </div>
          </div>

          {related.length > 0 && (
            <div className="mx-auto mt-16 max-w-5xl">
              <h2 className="mb-6 font-display text-2xl text-cream">Keep reading</h2>
              <div className="grid gap-6 md:grid-cols-3">
                {related.map((r) => (
                  <Link
                    key={r.id}
                    href={`/blog/${r.slug}`}
                    className="surface surface-hover group overflow-hidden rounded-2xl"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <Image
                        src={r.heroImage || "/gallery/hero.jpg"}
                        alt={r.title}
                        fill
                        sizes="(max-width:768px) 100vw, 33vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    </div>
                    <div className="p-5">
                      <h3 className="font-display text-lg leading-snug text-cream group-hover:text-gold">
                        {r.title}
                      </h3>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </article>
    </>
  );
}
