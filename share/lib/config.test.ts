describe("config", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("defaults to the GitHub Pages studio and the local dev server", async () => {
    vi.stubEnv("STUDIO_URL", "");
    vi.stubEnv("ALLOWED_ORIGINS", "");
    const { allowedOrigins, openInStudio, studioUrl } = await import("./config");
    expect(studioUrl()).toBe("https://vakalaktika.github.io/animatron/");
    expect(allowedOrigins()).toEqual(["https://vakalaktika.github.io", "http://localhost:3000"]);
    expect(openInStudio("Ab3dEfGh9k")).toBe("https://vakalaktika.github.io/animatron/#s=Ab3dEfGh9k");
  });

  it("takes extra origins and the public address from the environment", async () => {
    vi.stubEnv("STUDIO_URL", "https://studio.example.test");
    vi.stubEnv("ALLOWED_ORIGINS", "https://preview.example.test/, https://preview.example.test");
    vi.stubEnv("SHARE_URL", "https://links.example.test/");
    const { allowedOrigins, shareLink } = await import("./config");
    expect(allowedOrigins()).toEqual(["https://studio.example.test", "http://localhost:3000", "https://preview.example.test"]);
    expect(shareLink("Ab3dEfGh9k")).toBe("https://links.example.test/s/Ab3dEfGh9k");
  });

  it("falls back to the Vercel production host", async () => {
    vi.stubEnv("SHARE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "animatron-share.vercel.app");
    const { shareBase } = await import("./config");
    expect(shareBase()).toBe("https://animatron-share.vercel.app");
  });
});
