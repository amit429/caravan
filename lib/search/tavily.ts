// Shared by every agent that wants live web context (Scout's destination
// research, accommodation/travel-option price and location lookups) —
// enrichment, not a dependency: every caller works without it, just with
// less current context, since TAVILY_API_KEY is optional.
export async function searchTavily(query: string): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return "";
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, query, max_results: 5 }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    const results = (data.results ?? []) as { title: string; content: string }[];
    return results.map((r) => `${r.title}: ${r.content}`).join("\n");
  } catch {
    return "";
  }
}
