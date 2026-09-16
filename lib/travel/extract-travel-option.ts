import { generateObject } from "ai";
import { z } from "zod";
import { flashModel, fastGoogleOptions } from "@/lib/agents/runtime/model";
import { extractIdeaMetadata } from "@/lib/ideas/extract-idea";
import { searchTavily } from "@/lib/search/tavily";
import type { TravelMode } from "@/lib/database.types";

type TravelOptionDetails = { title: string; mode: TravelMode; timing: string | null; price: string | null };

const detailsSchema = z.object({
  mode: z.enum(["air", "road", "water"]),
  timing: z.string().nullable(),
  price: z.string().nullable(),
});

// Unlike accommodation price/area, which need a real web lookup, mode
// (flight vs. bus vs. ferry) is almost always obvious from the name/link
// text alone — "IndiGo 6E-204" or "Volvo Sleeper" doesn't need search
// context to classify. So the model call always runs here, with whatever
// Tavily context exists (possibly none) only helping fill in timing/price.
export async function extractTravelOptionDetails(input: { name: string; url?: string }): Promise<TravelOptionDetails> {
  let title = input.name;

  if (input.url) {
    const meta = await extractIdeaMetadata(input.url);
    if (meta.title) title = meta.title;
  }

  const searchContext = await searchTavily(`${input.name} travel timing price${input.url ? ` ${input.url}` : ""}`);

  try {
    const result = await generateObject({
      model: flashModel,
      schema: detailsSchema,
      providerOptions: fastGoogleOptions,
      prompt: `Classify this travel option: "${title}"${input.url ? ` (${input.url})` : ""}.${
        searchContext ? `\n\nSearch context:\n${searchContext}` : ""
      }\n\nGive "mode": "air" for flights, "road" for bus/car/train, "water" for ferry/boat. Give "timing" (departure/arrival time or duration, null if unknown) and "price" (a short price string, null if unknown) — never invent either, only use what's actually given or in the search context.`,
    });
    return { title, mode: result.object.mode, timing: result.object.timing, price: result.object.price };
  } catch {
    // The mode column is required (not null) — "road" is the most generic
    // fallback for the rare case the classification call itself fails,
    // not a real guess about this specific option.
    return { title, mode: "road", timing: null, price: null };
  }
}
