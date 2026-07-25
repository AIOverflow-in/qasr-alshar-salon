"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, ExternalLink, Loader2, Check } from "lucide-react";
import { updatePost } from "@/lib/actions/admin";

export type EditablePost = {
  id: string;
  slug: string;
  title: string;
  category: string;
  status: "DRAFT" | "PUBLISHED";
  excerpt: string;
  metaDescription: string;
  targetKeyword: string;
  tags: string[];
  contentMarkdown: string;
  publishedAt: string;
};

const field = "w-full rounded-lg border border-ink-line bg-ink-card px-3 py-2 text-sm text-cream placeholder:text-muted focus:border-gold/60 focus:outline-none";
const label = "mb-1 block text-xs font-medium uppercase tracking-wider text-muted";

export function BlogEditor({ post }: { post: EditablePost }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({
    title: post.title,
    category: post.category,
    status: post.status,
    excerpt: post.excerpt,
    metaDescription: post.metaDescription,
    targetKeyword: post.targetKeyword,
    tags: post.tags.join(", "),
    contentMarkdown: post.contentMarkdown,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => { setF((p) => ({ ...p, [k]: v })); setSaved(false); };

  function save() {
    setErr(null);
    start(async () => {
      const res = await updatePost(post.id, {
        title: f.title, category: f.category, status: f.status,
        excerpt: f.excerpt, metaDescription: f.metaDescription, targetKeyword: f.targetKeyword,
        tags: f.tags.split(","), contentMarkdown: f.contentMarkdown,
      });
      if (res?.ok) { setSaved(true); router.refresh(); }
      else setErr(res?.error || "Could not save");
    });
  }

  const publishedLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", day: "numeric", month: "short", year: "numeric" }).format(new Date(post.publishedAt));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/erp/blog" className="inline-flex items-center gap-1 text-sm text-muted hover:text-gold"><ArrowLeft size={15} /> Blog</Link>
        <div className="flex items-center gap-3">
          <Link href={`/blog/${post.slug}`} target="_blank" className="inline-flex items-center gap-1 text-sm text-sand hover:text-gold">Preview <ExternalLink size={13} /></Link>
          <button onClick={save} disabled={pending} className="inline-flex items-center gap-2 rounded-full bg-gold-gradient px-5 py-2.5 text-sm font-semibold text-espresso disabled:opacity-60">
            {pending ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : <Save size={15} />}
            {pending ? "Saving…" : saved ? "Saved" : "Save"}
          </button>
        </div>
      </div>

      {err && <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{err}</p>}

      <div className="surface space-y-4 rounded-2xl p-6">
        <div>
          <label className={label}>Title</label>
          <input className={field} value={f.title} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={label}>Category</label>
            <input className={field} value={f.category} onChange={(e) => set("category", e.target.value)} />
          </div>
          <div>
            <label className={label}>Status</label>
            <select className={field} value={f.status} onChange={(e) => set("status", e.target.value as "DRAFT" | "PUBLISHED")}>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
            </select>
          </div>
          <div>
            <label className={label}>Publish date (fixed)</label>
            <input className={`${field} cursor-not-allowed opacity-60`} value={publishedLabel} readOnly title="Editing never changes the publish date" />
          </div>
        </div>
        <div>
          <label className={label}>Target keyword</label>
          <input className={field} value={f.targetKeyword} onChange={(e) => set("targetKeyword", e.target.value)} placeholder="e.g. knotless braids dubai" />
        </div>
        <div>
          <label className={label}>Tags (comma-separated)</label>
          <input className={field} value={f.tags} onChange={(e) => set("tags", e.target.value)} placeholder="braids, protective styling, dubai" />
        </div>
        <div>
          <label className={label}>Excerpt <span className="text-muted/60">({f.excerpt.length}/160)</span></label>
          <textarea className={`${field} h-16 resize-y`} value={f.excerpt} onChange={(e) => set("excerpt", e.target.value)} />
        </div>
        <div>
          <label className={label}>Meta description <span className="text-muted/60">({f.metaDescription.length}/155)</span></label>
          <textarea className={`${field} h-16 resize-y`} value={f.metaDescription} onChange={(e) => set("metaDescription", e.target.value)} />
        </div>
      </div>

      <div className="surface rounded-2xl p-6">
        <label className={label}>Content (Markdown) <span className="text-muted/60">· {f.contentMarkdown.trim().split(/\s+/).filter(Boolean).length} words</span></label>
        <textarea className={`${field} h-[32rem] resize-y font-mono text-[13px] leading-relaxed`} value={f.contentMarkdown} onChange={(e) => set("contentMarkdown", e.target.value)} spellCheck />
      </div>
    </div>
  );
}
