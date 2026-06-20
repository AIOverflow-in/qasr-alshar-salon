import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const KEY = process.env.OPENAI_API_KEY;
const ROOT = process.cwd();
const STYLE =
  "Photorealistic editorial beauty photography, luxurious warm gold and black salon setting, soft cinematic lighting, true-to-life natural skin tones (not orange), elegant and aspirational, sharp detail. Correct, realistic human anatomy — natural hands and fingers. Absolutely no text, words, letters, logos or watermarks.";

const JOBS = [
  { file: "public/gallery/hero-model.jpg", size: "1536x1024", q: "high",
    prompt: "A confident, beautiful dark-skinned Black African woman with long, elegant knotless braids, in a luxurious gold-and-black beauty salon, radiant and glamorous, looking at the camera, plenty of negative space on one side for text." },
  { file: "public/gallery/weaving.jpg", size: "1024x1024", q: "high",
    prompt: "A beautiful Black woman with a voluminous, natural-looking curly Afro sew-in / weave, healthy glossy coily hair, luxury salon backdrop." },
  { file: "public/gallery/locs.jpg", size: "1024x1024", q: "high",
    prompt: "A beautiful Black woman with neat, well-maintained medium locs (microlocs), elegantly styled, healthy scalp and edges, luxury salon, warm light." },
  { file: "public/gallery/natural.jpg", size: "1024x1024", q: "high",
    prompt: "A joyful Black woman with healthy, voluminous 4C natural afro hair beautifully shaped, confident and radiant, luxury salon." },
  { file: "public/gallery/knotless.jpg", size: "1024x1024", q: "high",
    prompt: "Close-up of long, fresh knotless box braids on a dark-skinned Black woman, neat clean partings, glossy and well done." },
  { file: "public/gallery/makeup.jpg", size: "1024x1024", q: "high",
    prompt: "An elegant Khaleeji Gulf Arab bride with flawless glamorous bridal makeup and ornate gold jewellery, tasteful and modest styling, warm golden light. No western veil or tiara." },
];

async function gen(job) {
  const out = path.join(ROOT, job.file);
  await mkdir(path.dirname(out), { recursive: true });
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-image-1", prompt: `${job.prompt} ${STYLE}`,
      size: job.size, quality: job.q, output_format: "jpeg", output_compression: 82, n: 1,
    }),
  });
  if (!res.ok) { console.error("FAIL", job.file, res.status, (await res.text()).slice(0, 160)); return; }
  const data = await res.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) return console.error("no data", job.file);
  await writeFile(out, Buffer.from(b64, "base64"));
  console.log("ok", job.file);
}

for (const job of JOBS) {
  try { await gen(job); } catch (e) { console.error("err", job.file, e.message); }
}
console.log("done");
