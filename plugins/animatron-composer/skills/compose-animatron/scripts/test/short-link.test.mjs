// node --test scripts/test/short-link.test.mjs
// Exercises short-link.mjs end to end against the fake Supabase in
// fake-supabase.ts: the studio's own createShare/shareLinkFor run for real,
// only the network is stood in for. Uses the plugin's cached studio checkout
// (run validate.mjs once first) and a throwaway config directory.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkKey } from "../short-link.mjs";
import { findChrome } from "../card.mjs";

const SCRIPTS = fileURLToPath(new URL("..", import.meta.url));
const EXAMPLE = join(SCRIPTS, "..", "examples", "brief-reel-name-ribbon.json");
const work = mkdtempSync(join(tmpdir(), "ac-shortlink-"));
const fakeState = join(work, "fake-supabase.json");
const env = { ...process.env, ANIMATRON_COMPOSER_CONFIG: join(work, "config"), AC_FAKE_SUPABASE: fakeState };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const anonKey = `${b64({ alg: "HS256" })}.${b64({ role: "anon", ref: "fake" })}.sig`;
const serviceKey = `${b64({ alg: "HS256" })}.${b64({ role: "service_role", ref: "fake" })}.sig`;

const run = (args, extraEnv = {}) => spawnSync("node", [join(SCRIPTS, "short-link.mjs"), ...args, ...(process.env.ANIMATRON_COMPOSER_REPO ? ["--repo", process.env.ANIMATRON_COMPOSER_REPO] : [])], { env: { ...env, ...extraEnv }, encoding: "utf8" });
const state = () => JSON.parse(readFileSync(fakeState, "utf8"));
const piece = (name) => {
  const p = join(work, name);
  copyFileSync(EXAMPLE, p);
  return p;
};

test("only public keys are accepted", () => {
  assert.equal(checkKey(anonKey), null);
  assert.equal(checkKey("sb_publishable_abc123"), null);
  assert.match(checkKey(serviceKey), /service-role/);
  assert.match(checkKey("sb_secret_abc123"), /secret key/);
  assert.match(checkKey("hello"), /doesn't look like/);
  const r = run(["setup", "--url", "https://fake.supabase.co", "--key", serviceKey]);
  assert.equal(r.status, 2);
  assert.equal(existsSync(join(work, "config", "cloud.json")), false);
});

test("refuses to run before setup", () => {
  const r = run(["create", piece("early.json"), "--offline", "--no-card"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /not set up/);
});

test("setup saves a private config", () => {
  const r = run(["setup", "--url", "https://fake.supabase.co/", "--key", anonKey]);
  assert.equal(r.status, 0, r.stderr);
  const cfg = JSON.parse(readFileSync(join(work, "config", "cloud.json"), "utf8"));
  assert.equal(cfg.url, "https://fake.supabase.co");
  assert.equal(cfg.shareOrigin, "https://animatron-share.vercel.app");
  assert.equal(statSync(join(work, "config", "cloud.json")).mode & 0o777, 0o600);
});

let firstId;
test("makes a share page link with the studio's own code", () => {
  const file = piece("reel.json");
  const r = run(["create", file, "--offline", "--no-card"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const link = readFileSync(file.replace(/\.json$/, ".short-link.txt"), "utf8").trim();
  assert.match(link, /^https:\/\/animatron-share\.vercel\.app\/s\/[A-Za-z0-9_-]{10}$/);
  firstId = link.slice(-10);
  const s = state();
  const row = s.shares[firstId];
  assert.ok(row, "share stored");
  assert.equal(row.duration, 6);
  const written = JSON.parse(readFileSync(file, "utf8"));
  assert.deepEqual(row.doc, written, "the stored document is the file as written");
  assert.equal(s.users, 1, "one anonymous session");
  assert.equal(statSync(join(work, "config", "session.json")).mode & 0o777, 0o600);
});

test("the next link reuses the same session (same owner)", () => {
  const r = run(["create", piece("reel2.json"), "--offline", "--no-card"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const s = state();
  assert.equal(s.users, 1);
  const owners = new Set(Object.values(s.shares).map((x) => x.owner));
  assert.equal(owners.size, 1);
});

test("without a share page the link is the studio's own ?s= link", () => {
  const r = run(["create", piece("reel3.json"), "--offline", "--no-card"], { ANIMATRON_SHARE_ORIGIN: "" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const link = readFileSync(join(work, "reel3.short-link.txt"), "utf8").trim();
  assert.match(link, /^https:\/\/vakalaktika\.github\.io\/animatron\/\?s=[A-Za-z0-9_-]{10}$/);
});

test("a composition that fails validation never reaches the database", () => {
  const bad = join(work, "bad.json");
  const doc = JSON.parse(readFileSync(EXAMPLE, "utf8"));
  delete doc.clips[1].container;
  writeFileSync(bad, JSON.stringify(doc));
  const before = Object.keys(state().shares).length;
  const r = run(["create", bad, "--offline", "--no-card"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /didn't pass validation/);
  assert.equal(Object.keys(state().shares).length, before);
});

test("the daily limit comes back as the database's message", () => {
  writeFileSync(fakeState, JSON.stringify({ ...state(), quotaFull: true }));
  const r = run(["create", piece("reel4.json"), "--offline", "--no-card"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Share limit reached: 50 links a day/);
  writeFileSync(fakeState, JSON.stringify({ ...state(), quotaFull: false }));
});

test("deletes its own link, once", () => {
  let r = run(["delete", firstId, "--offline"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(state().shares[firstId], undefined);
  r = run(["delete", firstId, "--offline"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /No link/);
});

test("an unreachable project explains where links can be made", () => {
  const r = run(["create", piece("reel5.json"), "--offline", "--no-card"], { AC_FAKE_SUPABASE: "", ANIMATRON_SUPABASE_URL: "https://127.0.0.1:9" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /isn't reachable from here/);
});

const pngSize = (file) => {
  const b = readFileSync(file);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};
const chrome = findChrome();

test("draws the studio's preview card and uploads it with the link", { skip: !chrome && "no Chrome on this machine" }, () => {
  const file = piece("carded.json");
  const r = run(["create", file, "--offline"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /with its preview card/);
  const id = readFileSync(join(work, "carded.short-link.txt"), "utf8").trim().slice(-10);
  assert.deepEqual(pngSize(join(work, "carded.card.png")), [1200, 630]);
  const card = state().cards[`${id}.png`];
  assert.ok(card?.png && card.bytes > 5000, "a real PNG reached the bucket");
});

test("adds a card to a link made without one, once", { skip: !chrome && "no Chrome on this machine" }, () => {
  const file = piece("later.json");
  let r = run(["create", file, "--offline", "--no-card"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /no preview card.*short-link\.mjs card/);
  const id = readFileSync(join(work, "later.short-link.txt"), "utf8").trim().slice(-10);
  r = run(["card", id, file, "--offline"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(state().cards[`${id}.png`]?.png);
  r = run(["card", id, file, "--offline"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /already has a card/);
});

test("won't add a card to a link it didn't make", { skip: !chrome && "no Chrome on this machine" }, () => {
  const s = state();
  s.shares["SomeoneEls"] = { owner: "someone-else", doc: {}, duration: 3 };
  writeFileSync(fakeState, JSON.stringify(s));
  const r = run(["card", "SomeoneEls", piece("other.json"), "--offline"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /isn't a link this plugin's session made/);
});

test("without a browser the link is still made, without a card", () => {
  const r = run(["create", piece("nochrome.json"), "--offline"], { CHROME_PATH: "/nonexistent/chrome" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /no preview card: no Chrome/);
  const id = readFileSync(join(work, "nochrome.short-link.txt"), "utf8").trim().slice(-10);
  assert.ok(state().shares[id]);
  assert.equal(state().cards?.[`${id}.png`], undefined);
});
