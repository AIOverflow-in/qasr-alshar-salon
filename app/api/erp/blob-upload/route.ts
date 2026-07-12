import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getSession } from "@/lib/auth";
import { isUploadKind, canUpload, UPLOAD_KINDS, MAX_UPLOAD_BYTES } from "@/lib/upload-core";

export const dynamic = "force-dynamic";

/**
 * Client-upload authorizer. The browser uploads the file DIRECTLY to Vercel Blob
 * (so it bypasses the 4.5 MB serverless request limit — any file up to 20 MB
 * works); this route only issues a short-lived, scoped token after checking the
 * session + role for the requested upload kind. The onUploadCompleted callback
 * is a no-op — the client gets the blob URL back and persists it via a normal
 * server action (addExpense, addStaffDocument, …).
 */
export async function POST(req: Request): Promise<NextResponse> {
  let body: HandleUploadBody;
  try { body = (await req.json()) as HandleUploadBody; } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const session = await getSession();

  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        if (!session) throw new Error("Unauthorized");
        let kind: unknown;
        try { kind = JSON.parse(clientPayload || "{}").kind; } catch { kind = undefined; }
        if (!isUploadKind(kind)) throw new Error("Unknown upload kind.");
        if (!canUpload(kind, session.role)) throw new Error("You don't have permission to upload this.");
        return {
          allowedContentTypes: UPLOAD_KINDS[kind].contentTypes,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // No server-side post-processing needed; the client persists the URL itself.
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed." }, { status: 400 });
  }
}
