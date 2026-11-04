import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { openInStudio, shareLink } from "@/lib/config";
import { fallbackDescription, kicker } from "@/lib/format";
import { isShareId } from "@/lib/id";
import { readMeta } from "@/lib/store";
import { CopyLinkButton } from "./CopyLinkButton";

type Params = { params: Promise<{ id: string }> };

async function load(id: string) {
  return isShareId(id) ? readMeta(id) : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const meta = await load(id);
  if (!meta) return { title: "Animatron", robots: { index: false } };
  const description = meta.description || fallbackDescription(meta);
  const url = shareLink(id);
  const image = { url: `${url}/card.png`, width: 1200, height: 630, alt: `${meta.name}, an Animatron composition` };
  return {
    title: `${meta.name} · Animatron`,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", siteName: "Animatron", title: meta.name, description, url, images: [image] },
    twitter: { card: "summary_large_image", title: meta.name, description, images: [image.url] },
  };
}

/** The page behind a short link: the card, what it is, and two ways on. */
export default async function SharePage({ params }: Params) {
  const { id } = await params;
  const meta = await load(id);
  if (!meta) notFound();
  const description = meta.description || fallbackDescription(meta);
  return (
    <main className="share">
      <article className="share-card">
        {/* eslint-disable-next-line @next/next/no-img-element -- a stored PNG at a fixed size; no optimisation wanted */}
        <img className="share-picture" src={`/s/${id}/card.png`} width={1200} height={630} alt={`A frame of ${meta.name}`} />
        <p className="share-kicker">Animatron · {kicker(meta)}</p>
        <h1 className="share-title">{meta.name}</h1>
        <p className="share-blurb">{description}</p>
        <div className="share-actions">
          <a className="share-button share-button-primary" href={openInStudio(id)}>
            Add to my Compositions
          </a>
          <CopyLinkButton url={shareLink(id)} />
        </div>
        <p className="share-note">Open it in the browser you use for Animatron. It loads the piece and saves it to your Compositions automatically.</p>
      </article>
    </main>
  );
}
