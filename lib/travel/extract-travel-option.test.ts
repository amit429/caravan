import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGenerateObject = vi.fn();
const mockExtractIdeaMetadata = vi.fn();
const mockSearchTavily = vi.fn();

vi.mock("ai", () => ({ generateObject: (...args: unknown[]) => mockGenerateObject(...args) }));
vi.mock("@/lib/agents/runtime/model", () => ({ flashModel: "mock-flash-model", fastGoogleOptions: {} }));
vi.mock("@/lib/ideas/extract-idea", () => ({ extractIdeaMetadata: (...args: unknown[]) => mockExtractIdeaMetadata(...args) }));
vi.mock("@/lib/search/tavily", () => ({ searchTavily: (...args: unknown[]) => mockSearchTavily(...args) }));

import { extractTravelOptionDetails } from "./extract-travel-option";

beforeEach(() => {
  mockGenerateObject.mockReset();
  mockExtractIdeaMetadata.mockReset().mockResolvedValue({ title: null, note: null, imageUrl: null });
  mockSearchTavily.mockReset().mockResolvedValue("");
});

describe("extractTravelOptionDetails", () => {
  it("classifies mode even with no Tavily context at all", async () => {
    mockGenerateObject.mockResolvedValue({ object: { mode: "air", timing: null, price: null } });
    const result = await extractTravelOptionDetails({ name: "IndiGo 6E-204" });
    expect(result.mode).toBe("air");
    expect(mockGenerateObject).toHaveBeenCalled();
  });

  it("uses the OG-scraped title when a URL is given", async () => {
    mockExtractIdeaMetadata.mockResolvedValue({ title: "IndiGo 6E-204 Mumbai-Goa", note: null, imageUrl: null });
    mockGenerateObject.mockResolvedValue({ object: { mode: "air", timing: "08:00", price: "₹4,200" } });
    const result = await extractTravelOptionDetails({ name: "some flight", url: "https://example.com/flight" });
    expect(result.title).toBe("IndiGo 6E-204 Mumbai-Goa");
    expect(result.timing).toBe("08:00");
    expect(result.price).toBe("₹4,200");
  });

  it("classifies road and water modes correctly from context", async () => {
    mockGenerateObject.mockResolvedValueOnce({ object: { mode: "road", timing: null, price: null } });
    expect((await extractTravelOptionDetails({ name: "Volvo Sleeper Bus" })).mode).toBe("road");

    mockGenerateObject.mockResolvedValueOnce({ object: { mode: "water", timing: null, price: null } });
    expect((await extractTravelOptionDetails({ name: "Gili Islands Fast Boat" })).mode).toBe("water");
  });

  it("falls back to a generic mode gracefully if classification fails", async () => {
    mockGenerateObject.mockRejectedValue(new Error("rate limited"));
    const result = await extractTravelOptionDetails({ name: "Some transport" });
    expect(result.mode).toBe("road");
    expect(result.timing).toBeNull();
    expect(result.price).toBeNull();
  });
});
