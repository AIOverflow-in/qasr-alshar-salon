// List or download nightly backups. They are PRIVATE blobs, so a browser URL will not work —
// this signs a short-lived download URL with the blob token.
//
//   node --import tsx --env-file=.env.prod scripts/fetch-backup.ts            # list
//   BACKUP_DAY=2026-08-31 …same… scripts/fetch-backup.ts                      # download that day
import { writeFileSync } from "node:fs";
import { list, head } from "@vercel/blob";

const DAY = process.env.BACKUP_DAY || "";

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN is not set.");
  const { blobs } = await list({ prefix: "db-backups/", limit: 1000 });
  const sorted = blobs.sort((a, b) => (a.pathname < b.pathname ? 1 : -1));

  if (!DAY) {
    if (!sorted.length) return console.log("No backups found yet.");
    console.log(`${sorted.length} backup(s):\n`);
    for (const b of sorted.slice(0, 40)) {
      console.log(`  ${b.pathname.padEnd(38)} ${(b.size / 1024).toFixed(0).padStart(6)} KB   ${b.uploadedAt.toISOString().slice(0, 16).replace("T", " ")}`);
    }
    console.log("\nDownload one with BACKUP_DAY=YYYY-MM-DD");
    return;
  }

  const match = sorted.find((b) => b.pathname.includes(DAY));
  if (!match) throw new Error(`No backup for ${DAY}.`);
  const meta = await head(match.url);
  const res = await fetch(meta.downloadUrl);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const out = `qasr-${DAY}.json.gz`;
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  console.log(`Saved ${out} (${(match.size / 1024).toFixed(0)} KB)`);
  console.log(`\nRestore into your LOCAL database with:\n  BACKUP_FILE=./${out} node --import tsx --env-file=.env.local scripts/restore-backup.ts`);
}

main().catch((e) => { console.error("FAILED:", e); process.exitCode = 1; });
