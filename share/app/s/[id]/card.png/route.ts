import { isShareId } from "@/lib/id";
import { readCard } from "@/lib/store";

/** The preview card, served from this address so link previews stay on the share's own domain. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isShareId(id)) return new Response("Not found", { status: 404 });
  const stream = await readCard(id);
  if (!stream) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(stream, { status: 200, headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" } });
}
