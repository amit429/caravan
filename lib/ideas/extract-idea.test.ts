import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGenerateObject = vi.fn();
vi.mock("ai", () => ({ generateObject: (...args: unknown[]) => mockGenerateObject(...args) }));
vi.mock("@/lib/agents/runtime/model", () => ({ flashModel: "mock-flash-model", fastGoogleOptions: {} }));

import { parseOgTags, extractIdeaMetadata } from "./extract-idea";

const html = `<html><head>
<title>Fallback Title</title>
<meta property="og:title" content="Hidden Waterfall Trek, Wayanad" />
<meta property="og:description" content="A 4km trek through the forest to a secluded waterfall." />
<meta property="og:image" content="https://example.com/photo.jpg" />
</head><body></body></html>`;

describe("parseOgTags", () => {
  it("extracts og:title, og:description, og:image", () => {
    expect(parseOgTags(html)).toEqual({
      title: "Hidden Waterfall Trek, Wayanad",
      description: "A 4km trek through the forest to a secluded waterfall.",
      image: "https://example.com/photo.jpg",
    });
  });

  it("falls back to <title> when og:title is missing", () => {
    const noOg = `<html><head><title>Fallback Title</title></head></html>`;
    expect(parseOgTags(noOg).title).toBe("Fallback Title");
  });

  it("returns nulls for a page with no usable tags", () => {
    expect(parseOgTags("<html><head></head></html>")).toEqual({ title: null, description: null, image: null });
  });
});

describe("extractIdeaMetadata", () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    mockGenerateObject.mockReset();
    global.fetch = originalFetch;
  });

  it("scrapes tags then asks the model to clean them up", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(html) });
    mockGenerateObject.mockResolvedValue({
      object: { title: "Hidden Waterfall Trek", note: "A short forest trek to a secluded waterfall." },
    });

    const result = await extractIdeaMetadata("https://example.com/trek");
    expect(result).toEqual({
      title: "Hidden Waterfall Trek",
      note: "A short forest trek to a secluded waterfall.",
      imageUrl: "https://example.com/photo.jpg",
    });
  });

  it("skips the LLM call and returns nulls when the page has no usable tags", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve("<html><head></head></html>") });

    const result = await extractIdeaMetadata("https://example.com/blank");
    expect(mockGenerateObject).not.toHaveBeenCalled();
    expect(result).toEqual({ title: null, note: null, imageUrl: null });
  });

  it("degrades gracefully when the fetch fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down"));
    const result = await extractIdeaMetadata("https://example.com/unreachable");
    expect(result).toEqual({ title: null, note: null, imageUrl: null });
  });

  it("degrades gracefully when the LLM call fails, keeping the scraped title", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(html) });
    mockGenerateObject.mockRejectedValue(new Error("rate limited"));

    const result = await extractIdeaMetadata("https://example.com/trek");
    expect(result).toEqual({
      title: "Hidden Waterfall Trek, Wayanad",
      note: null,
      imageUrl: "https://example.com/photo.jpg",
    });
  });
});
