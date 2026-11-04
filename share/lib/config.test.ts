describe("config", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("defaults to the GitHub Pages studio and opens shares with its short link", async () => {
    vi.stubEnv("STUDIO_URL", "");
    const { openInStudio, studioUrl } = await import("./config");
    expect(studioUrl()).toBe("https://vakalaktika.github.io/animatron/");
    expect(openInStudio("Ab3dEfGh9k")).toBe("https://vakalaktika.github.io/animatron/?s=Ab3dEfGh9k");
  });

  it("takes the studio and its own public address from the environment", async () => {
    vi.stubEnv("STUDIO_URL", "https://studio.example.test");
    vi.stubEnv("SHARE_URL", "https://links.example.test/");
    const { openInStudio, shareLink } = await import("./config");
    expect(openInStudio("Ab3dEfGh9k")).toBe("https://studio.example.test/?s=Ab3dEfGh9k");
    expect(shareLink("Ab3dEfGh9k")).toBe("https://links.example.test/s/Ab3dEfGh9k");
  });

  it("falls back to the Vercel production host", async () => {
    vi.stubEnv("SHARE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "animatron-share.vercel.app");
    const { shareBase } = await import("./config");
    expect(shareBase()).toBe("https://animatron-share.vercel.app");
  });

  it("needs the Supabase project, and says so", async () => {
    const { supabaseConfig } = await import("./config");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_ANON_KEY", "key");
    expect(() => supabaseConfig()).toThrow("SUPABASE_URL and SUPABASE_ANON_KEY must be set");
    vi.stubEnv("SUPABASE_URL", "https://x.supabase.co/");
    expect(supabaseConfig()).toEqual({ url: "https://x.supabase.co", anonKey: "key" });
  });
});
