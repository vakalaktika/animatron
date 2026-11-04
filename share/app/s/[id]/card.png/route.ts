import { isShareId } from "@/lib/id";
import { readCard, readMeta } from "@/lib/supabase";

/** The preview card, served from this address so link previews stay on the share's own domain. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isShareId(id)) return new Response("Not found", { status: 404 });
  // A deleted share's card may outlive it in storage; it goes with the share here.
  const stream = (await readMeta(id)) ? await readCard(id) : null;
  if (!stream) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(stream, { status: 200, headers: { "Content-Type": "image/png", "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=31536000, immutable" } });
}
