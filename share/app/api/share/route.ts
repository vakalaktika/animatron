import { allowedOrigins, shareLink } from "@/lib/config";
import { newShareId } from "@/lib/id";
import { saveShare, ShareExistsError } from "@/lib/store";
import { checkCard, checkDoc, checkDuration, MAX_CARD_BYTES, MAX_DOC_BYTES, metaFrom } from "@/lib/validate";

/** Browsers get a CORS answer only for origins we know. */
function cors(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins().includes(origin)) return { Vary: "Origin" };
  return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Max-Age": "86400", Vary: "Origin" };
}

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  Response.json(body, { status, headers: { ...headers, "Cache-Control": "no-store" } });

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: cors(request) });
}

/**
 * Makes a share: multipart form with `doc` (the composition as JSON),
 * `card` (a 1200×630 PNG) and `duration` (seconds). Answers with the id
 * and the link. Anything over the size limits is refused before it is read.
 */
export async function POST(request: Request) {
  const headers = cors(request);
  const origin = request.headers.get("origin");
  if (origin && !headers["Access-Control-Allow-Origin"]) return json({ error: "This site can't make Animatron links." }, 403, headers);
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_DOC_BYTES + MAX_CARD_BYTES + 10_000) return json({ error: "The composition is too big to share by link. Download it as a JSON file instead." }, 413, headers);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Expected a form with the composition and its preview." }, 400, headers);
  }
  const docFile = form.get("doc");
  const cardFile = form.get("card");
  if (!(docFile instanceof Blob) || !(cardFile instanceof Blob)) return json({ error: "Expected a form with the composition and its preview." }, 400, headers);
  if (docFile.size > MAX_DOC_BYTES) return json({ error: "The composition is too big to share by link. Download it as a JSON file instead." }, 413, headers);
  if (cardFile.size > MAX_CARD_BYTES) return json({ error: "The preview picture is too big." }, 413, headers);

  const text = await docFile.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return json({ error: "The composition is not valid JSON." }, 400, headers);
  }
  const doc = checkDoc(parsed);
  if (!doc.ok) return json({ error: doc.message }, 400, headers);
  const duration = checkDuration(form.get("duration"));
  if (!duration.ok) return json({ error: duration.message }, 400, headers);
  const card = checkCard(new Uint8Array(await cardFile.arrayBuffer()), cardFile.type);
  if (!card.ok) return json({ error: card.message }, 400, headers);

  const meta = metaFrom(doc.value, duration.value);
  // An id clash is a one-in-many-billions event; two more draws cover it.
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = newShareId();
    try {
      await saveShare(id, JSON.stringify(doc.value), card.value, meta);
      return json({ id, url: shareLink(id) }, 201, headers);
    } catch (err) {
      if (err instanceof ShareExistsError) continue;
      console.error("share: could not store", err);
      return json({ error: "The share service couldn't store the composition. Try again in a moment." }, 503, headers);
    }
  }
  return json({ error: "The share service couldn't find a free id. Try again." }, 503, headers);
}
