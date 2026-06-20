/**
 * Generates a cohesive, royalty-free luxury image set for the site using
 * OpenAI gpt-image-1, written as optimized WebP into /public.
 *
 * Run:  node --env-file=.env scripts/generate-images.mjs
 * Idempotent: skips images that already exist (delete a file to regenerate).
 */
import { writeFile, mkdir, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) throw new Error("OPENAI_API_KEY missing");

const ROOT = process.cwd();
const STYLE =
  "Photorealistic, ultra-luxurious, warm gold and deep black color palette, soft cinematic lighting, elegant and aspirational, high-end Dubai beauty salon aesthetic. Absolutely no text, no words, no letters, no logos, no watermarks.";

const JOBS = [
  { file: "public/gallery/hero.jpg", size: "1536x1024", q: "high",
    prompt: "Wide interior of an opulent modern beauty salon in Dubai with elegant styling stations, marble surfaces, gold accents and warm ambient glow." },
  { file: "public/gallery/henna-feature.jpg", size: "1536x1024", q: "high",
    prompt: "Exquisite intricate bridal henna mehndi patterns on a woman's hands and forearms, adorned with delicate gold bangles, rich jewel-toned fabric." },
  { file: "public/gallery/about.jpg", size: "1536x1024", q: "medium",
    prompt: "Detail of a chic salon styling station with a backlit gold-framed mirror, premium tools neatly arranged, plush textures." },
  { file: "public/og/default.jpg", size: "1536x1024", q: "medium",
    prompt: "Elegant flat-lay of luxury beauty essentials — gold scissors, brushes, nail polish, henna cone — on black marble with golden light." },

  { file: "public/gallery/braiding.jpg", size: "1024x1024", q: "medium",
    prompt: "Close-up of immaculate knotless box braids on a confident Black woman, glossy and neat, warm golden light." },
  { file: "public/gallery/weaving.jpg", size: "1024x1024", q: "medium",
    prompt: "Glamorous woman with a flawless long silky sew-in weave, voluminous healthy hair, salon backdrop." },
  { file: "public/gallery/hair.jpg", size: "1024x1024", q: "medium",
    prompt: "A stylist blow-drying long glossy healthy hair with a round brush in a luxury salon, motion and shine." },
  { file: "public/gallery/nails.jpg", size: "1024x1024", q: "medium",
    prompt: "Beautifully manicured hands with glossy gel nails and subtle gold rings resting on black marble." },
  { file: "public/gallery/facial.jpg", size: "1024x1024", q: "medium",
    prompt: "A woman with radiant glowing skin enjoying a calming luxury facial, serene spa atmosphere." },
  { file: "public/gallery/makeup.jpg", size: "1024x1024", q: "medium",
    prompt: "A makeup artist applying flawless glamorous bridal makeup to a model, golden hour glow." },
  { file: "public/gallery/henna.jpg", size: "1024x1024", q: "medium",
    prompt: "Ornate floral henna design being applied to a hand with a henna cone, fine detail, warm tones." },
  { file: "public/gallery/lashes.jpg", size: "1024x1024", q: "medium",
    prompt: "Extreme close-up of a striking eye with full voluminous eyelash extensions, elegant and dramatic." },
  { file: "public/gallery/waxing.jpg", size: "1024x1024", q: "medium",
    prompt: "Smooth flawless skin and a calm premium spa treatment scene, soft towels and golden light." },
  { file: "public/gallery/threading.jpg", size: "1024x1024", q: "medium",
    prompt: "Precise eyebrow threading close-up on a beautiful face, focused and clean, warm salon light." },
  { file: "public/gallery/massage.jpg", size: "1024x1024", q: "medium",
    prompt: "Serene full-body relaxation massage scene with candles, soft towels and warm golden ambiance." },
];

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

async function gen(job) {
  const out = path.join(ROOT, job.file);
  if (await exists(out)) { console.log("skip  ", job.file); return; }
  await mkdir(path.dirname(out), { recursive: true });

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: `${job.prompt} ${STYLE}`,
      size: job.size,
      quality: job.q,
      output_format: "jpeg",
      output_compression: 80,
      n: 1,
    }),
  });
  if (!res.ok) {
    console.error("FAIL  ", job.file, res.status, (await res.text()).slice(0, 200));
    return;
  }
  const data = await res.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) { console.error("no data", job.file); return; }
  await writeFile(out, Buffer.from(b64, "base64"));
  console.log("ok    ", job.file);
}

for (const job of JOBS) {
  try { await gen(job); } catch (e) { console.error("err", job.file, e.message); }
}
console.log("done");
