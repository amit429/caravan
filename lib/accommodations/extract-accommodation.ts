import { generateObject } from "ai";
import { z } from "zod";
import { flashModel, fastGoogleOptions } from "@/lib/agents/runtime/model";
import { extractIdeaMetadata } from "@/lib/ideas/extract-idea";
import { searchTavily } from "@/lib/search/tavily";

type AccommodationDetails = { title: string; imageUrl: string | null; price: string | null; area: string | null };

const detailsSchema = z.object({
  price: z.string().nullable(),
  area: z.string().nullable(),
});

// A hotel link or a plain-text mention ("staying at Alaya Ubud") both need
// the same two things a raw title never carries: a price and which
// city/area it's actually in (so Plan can group multiple stays across a
// multi-city trip). OG scraping gets a clean title/image for free when
// there's a link; Tavily fills in the rest from live search context, and
// the model only ever tidies that search context into two short fields —
// never invents a price or place it wasn't given real signal for.
export async function extractAccommodationDetails(input: { name: string; url?: string }): Promise<AccommodationDetails> {
  let title = input.name;
  let imageUrl: string | null = null;

  if (input.url) {
    const meta = await extractIdeaMetadata(input.url);
    if (meta.title) title = meta.title;
    imageUrl = meta.imageUrl;
  }

  const searchContext = await searchTavily(`${input.name} hotel price per night location area${input.url ? ` ${input.url}` : ""}`);
  if (!searchContext) return { title, imageUrl, price: null, area: null };

  try {
    const result = await generateObject({
      model: flashModel,
      schema: detailsSchema,
      providerOptions: fastGoogleOptions,
      prompt: `From this search context about a stay called "${input.name}", extract a short price string (e.g. "₹4,500/night", null if not found) and the city or neighborhood/area it's in (null if not found). Never invent either — only use what's actually in the context.\n\nContext:\n${searchContext}`,
    });
    return { title, imageUrl, price: result.object.price, area: result.object.area };
  } catch {
    return { title, imageUrl, price: null, area: null };
  }
}
