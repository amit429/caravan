import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGenerateObject = vi.fn();
const mockExtractIdeaMetadata = vi.fn();
const mockSearchTavily = vi.fn();

vi.mock("ai", () => ({ generateObject: (...args: unknown[]) => mockGenerateObject(...args) }));
vi.mock("@/lib/agents/runtime/model", () => ({ flashModel: "mock-flash-model", fastGoogleOptions: {} }));
vi.mock("@/lib/ideas/extract-idea", () => ({ extractIdeaMetadata: (...args: unknown[]) => mockExtractIdeaMetadata(...args) }));
vi.mock("@/lib/search/tavily", () => ({ searchTavily: (...args: unknown[]) => mockSearchTavily(...args) }));

import { extractAccommodationDetails } from "./extract-accommodation";

beforeEach(() => {
  mockGenerateObject.mockReset();
  mockExtractIdeaMetadata.mockReset().mockResolvedValue({ title: null, note: null, imageUrl: null });
  mockSearchTavily.mockReset().mockResolvedValue("");
});

describe("extractAccommodationDetails", () => {
  it("uses the OG-scraped title and image when a URL is given", async () => {
    mockExtractIdeaMetadata.mockResolvedValue({ title: "Alaya Ubud", note: null, imageUrl: "https://example.com/photo.jpg" });
    const result = await extractAccommodationDetails({ name: "some hotel", url: "https://example.com/hotel" });
    expect(result.title).toBe("Alaya Ubud");
    expect(result.imageUrl).toBe("https://example.com/photo.jpg");
  });

  it("falls back to the given name when there's no url or no OG title", async () => {
    const result = await extractAccommodationDetails({ name: "Some Hotel" });
    expect(result.title).toBe("Some Hotel");
    expect(result.imageUrl).toBeNull();
  });

  it("returns null price/area when Tavily has no context, without calling the model", async () => {
    mockSearchTavily.mockResolvedValue("");
    const result = await extractAccommodationDetails({ name: "Some Hotel" });
    expect(result.price).toBeNull();
    expect(result.area).toBeNull();
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  it("extracts price/area from Tavily context via the model", async () => {
    mockSearchTavily.mockResolvedValue("Alaya Ubud: rooms from ₹4,500/night, located in Ubud, Bali.");
    mockGenerateObject.mockResolvedValue({ object: { price: "₹4,500/night", area: "Ubud" } });
    const result = await extractAccommodationDetails({ name: "Alaya Ubud" });
    expect(result.price).toBe("₹4,500/night");
    expect(result.area).toBe("Ubud");
  });

  it("returns null price/area gracefully if the model call fails", async () => {
    mockSearchTavily.mockResolvedValue("some context");
    mockGenerateObject.mockRejectedValue(new Error("rate limited"));
    const result = await extractAccommodationDetails({ name: "Some Hotel" });
    expect(result.price).toBeNull();
    expect(result.area).toBeNull();
  });
});
