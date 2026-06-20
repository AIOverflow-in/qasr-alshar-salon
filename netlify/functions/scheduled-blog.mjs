/**
 * Netlify Scheduled Function — auto-publishes an AI blog post every alternate
 * day at 06:00 UTC by calling the protected Next.js cron route.
 */
export const config = {
  schedule: "0 6 */2 * *",
};

export default async () => {
  const base =
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.NEXT_PUBLIC_SITE_URL;
  const secret = process.env.CRON_SECRET || "";

  if (!base) {
    return new Response("No site URL available", { status: 500 });
  }

  try {
    const res = await fetch(`${base}/api/cron/generate-blog`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    const text = await res.text();
    console.log("[scheduled-blog]", res.status, text);
    return new Response(text, { status: res.status });
  } catch (e) {
    console.error("[scheduled-blog] error", e);
    return new Response("error", { status: 500 });
  }
};
