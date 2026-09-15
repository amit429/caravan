import { generateObject } from "ai";
import { z } from "zod";
import { flashModel, fastGoogleOptions } from "@/lib/agents/runtime/model";

type OgTags = { title: string | null; description: string | null; image: string | null };

function matchMetaContent(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`,
    "i"
  );
  return re.exec(html)?.[1]?.trim() || null;
}

// Deterministic scrape — no LLM involved. Most trip-idea links (Instagram,
// blogs, YouTube) carry usable og:* tags, so this alone gets a title/image
// for free before spending a token on cleanup.
export function parseOgTags(html: string): OgTags {
  const title = matchMetaContent(html, "og:title") ?? /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? null;
  const description = matchMetaContent(html, "og:description");
  const image = matchMetaContent(html, "og:image");
  return { title, description, image };
}

const cleanupSchema = z.object({ title: z.string(), note: z.string() });

type IdeaMetadata = { title: string | null; note: string | null; imageUrl: string | null };

// F12: paste a link, get back a clean place/activity card. Scraping is
// deterministic; the LLM only tidies up messy titles/descriptions into a
// short, consistent card — and is skipped entirely when there's nothing
// usable to tidy, since a raw URL with no tags gives the model nothing real
// to work with anyway.
export async function extractIdeaMetadata(url: string): Promise<IdeaMetadata> {
  let og: OgTags = { title: null, description: null, image: null };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0" } });
    clearTimeout(timeout);
    if (res.ok) og = parseOgTags(await res.text());
  } catch {
    return { title: null, note: null, imageUrl: null };
  }

  if (!og.title && !og.description) {
    return { title: null, note: null, imageUrl: og.image };
  }

  try {
    const result = await generateObject({
      model: flashModel,
      schema: cleanupSchema,
      providerOptions: fastGoogleOptions,
      prompt: `Summarize this into a short trip idea card. Raw title: ${og.title ?? "unknown"}. Raw description: ${
        og.description ?? "none"
      }.\n\nReturn a clean "title" (the place or activity name, under 8 words) and a one-sentence "note" describing what it is.`,
    });
    return { title: result.object.title, note: result.object.note, imageUrl: og.image };
  } catch {
    return { title: og.title, note: null, imageUrl: og.image };
  }
}
