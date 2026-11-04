import { studioUrl } from "@/lib/config";

export default function NotFound() {
  return (
    <main className="share">
      <article className="share-card">
        <p className="share-kicker">Animatron</p>
        <h1 className="share-title">Nothing behind this link</h1>
        <p className="share-blurb">It may have been mistyped, or it was never made. Links made in Animatron keep working as long as the service does.</p>
        <div className="share-actions">
          <a className="share-button share-button-primary" href={studioUrl()}>
            Open Animatron
          </a>
        </div>
      </article>
    </main>
  );
}
