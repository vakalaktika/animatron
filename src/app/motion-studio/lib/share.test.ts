import { compressToEncodedURIComponent } from "lz-string";
import { makeImageSprite, welcomePreset } from "../presets";
import { docFromHash, SHARE_PARAM, shareUrl } from "./share";

const location = { origin: "https://example.test", pathname: "/animatron/" };

describe("share links", () => {
  it("carries a composition through the URL hash and back", () => {
    const doc = { ...welcomePreset(), name: "Shared one" };
    const result = shareUrl(doc, location);
    if (!result.ok) throw new Error("expected a link");
    expect(result.url.startsWith(`https://example.test/animatron/#${SHARE_PARAM}=`)).toBe(true);
    const hash = result.url.slice(result.url.indexOf("#"));
    const back = docFromHash(hash);
    expect(back?.name).toBe("Shared one");
    expect(back?.clips.map((c) => c.id)).toEqual(doc.clips.map((c) => c.id));
  });

  it("refuses a link that would carry embedded pictures", () => {
    const doc = welcomePreset();
    // Pseudo-random bytes stand in for a real picture, which compresses about as badly.
    let seed = 7;
    const noise = Array.from({ length: 120_000 }, () => {
      seed = (seed * 48271) % 2147483647;
      return "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"[seed % 64];
    }).join("");
    doc.clips.push(makeImageSprite(`data:image/png;base64,${noise}`, "big.png", 1));
    expect(shareUrl(doc, location)).toEqual({ ok: false, reason: "too-large" });
  });

  it("ignores hashes that are not a share, or are unreadable", () => {
    expect(docFromHash("")).toBeNull();
    expect(docFromHash("#other=1")).toBeNull();
    expect(docFromHash(`#${SHARE_PARAM}=not-a-real-payload`)).toBeNull();
  });
});

it("refuses scene-contract links until the destination application is verified",()=>{
 const doc={...welcomePreset(),version:3 as const};
 expect(shareUrl(doc,location)).toEqual({ok:false,reason:"requires-newer-app"});
 const encoded=compressToEncodedURIComponent(JSON.stringify(doc));
 expect(docFromHash(`#share=${encoded}`)?.version).toBe(3);
 const future=compressToEncodedURIComponent(JSON.stringify({...doc,version:4}));
 expect(docFromHash(`#share=${future}`)).toBeNull();
});
