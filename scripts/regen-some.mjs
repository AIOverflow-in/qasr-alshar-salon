import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const KEY = process.env.OPENAI_API_KEY;
const ROOT = process.cwd();
const STYLE =
  "Photorealistic, luxurious, warm gold tones, elegant high-end Dubai beauty salon aesthetic. Bright, clean, well-exposed. Absolutely no text, no words, no letters, no logos, no watermarks. Realistic human anatomy with correct hands and fingers.";

const JOBS = [
  {
    file: "public/gallery/henna-feature.jpg",
    size: "1536x1024",
    q: "high",
    prompt:
      "Bright, well-lit close-up of stunning intricate bridal henna (mehndi) covering a woman's hands and forearms. The henna is authentic REDDISH-BROWN to deep maroon stain (NOT black, NOT tattoo ink), with fine floral and paisley patterns. Delicate gold bangles, elegant jewel-tone fabric, soft bright natural light, crisp detail.",
  },
  {
    file: "public/gallery/henna.jpg",
    size: "1024x1024",
    q: "high",
    prompt:
      "Close-up of a woman's hand decorated with intricate traditional henna (mehndi). Authentic henna colour: rich orange-red to deep reddish-brown stain (absolutely NOT black ink, NOT a tattoo). Fine floral and paisley mehndi patterns, a few gold bangles, bright warm lighting, beautiful and realistic.",
  },
  {
    file: "public/gallery/massage.jpg",
    size: "1024x1024",
    q: "medium",
    prompt:
      "Tranquil luxury spa still-life: smooth stacked massage stones, neatly rolled soft towels, a small ceramic bowl of aromatic oil, a single orchid bloom and warm candles arranged on dark wood. Peaceful, serene, golden ambient light. No people.",
  },
];

async function gen(job) {
  const out = path.join(ROOT, job.file);
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
      output_compression: 82,
      n: 1,
    }),
  });
  if (!res.ok) {
    console.error("FAIL", job.file, res.status, (await res.text()).slice(0, 200));
    return;
  }
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
