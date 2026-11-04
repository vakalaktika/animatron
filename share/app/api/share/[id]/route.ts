import { isShareId } from "@/lib/id";
import { readDoc } from "@/lib/store";

const IMMUTABLE = "public, max-age=31536000, immutable";

/** The composition behind a share, for the studio to open. Shares are public and never change. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isShareId(id)) return Response.json({ error: "Not a share link." }, { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });
  const doc = await readDoc(id);
  if (!doc) return Response.json({ error: "There is nothing behind this link." }, { status: 404, headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } });
  return new Response(doc, {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Access-Control-Allow-Origin": "*", "Cache-Control": IMMUTABLE },
  });
}
