import { FACT_CATEGORY_LABEL, formatFactValue } from "@/lib/facts/format-fact";
import type { FactRow, IdeaCategory, IdeaRow } from "@/lib/database.types";

const IDEA_CATEGORY_LABEL: Record<IdeaCategory, string> = {
  activity: "Activities",
  stay: "Stays",
  travel: "Travel",
};

function categoryChipClass(category: FactRow["category"]) {
  if (category === "hard_no") return "bg-stop-t text-stop";
  if (category === "vibe") return "bg-plum-t text-plum";
  return "bg-sunk text-ink-2";
}

// Self-view only (You page) — everything a member has told the trip, in one
// place. Unlike MemberFactsBoard (everyone's answers, budget excluded since
// nobody else should see a number that isn't theirs), this is a member
// looking at their own data, so budget shows here — the privacy rule was
// always about *other people* not seeing it, never about hiding it from
// yourself.
export function Scrapbook({ facts, ideas }: { facts: FactRow[]; ideas: IdeaRow[] }) {
  const ideasByCategory = new Map<IdeaCategory, IdeaRow[]>();
  for (const idea of ideas) {
    const list = ideasByCategory.get(idea.category) ?? [];
    list.push(idea);
    ideasByCategory.set(idea.category, list);
  }

  if (facts.length === 0 && ideas.length === 0) {
    return <p className="text-sm text-ink-3">Nothing filed yet — answer the five questions or drop an idea in the group chat.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {facts.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg bg-card p-4">
          <h2 className="font-display text-sm font-semibold text-ink-2">What you&rsquo;ve told us</h2>
          <div className="flex flex-wrap gap-1.5">
            {facts.map((f) => (
              <span
                key={f.id}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${categoryChipClass(f.category)}`}
              >
                {FACT_CATEGORY_LABEL[f.category]}: {formatFactValue(f.value)}
              </span>
            ))}
          </div>
        </div>
      )}

      {(["activity", "stay", "travel"] as const).map((category) => {
        const items = ideasByCategory.get(category);
        if (!items || items.length === 0) return null;
        return (
          <div key={category} className="flex flex-col gap-2 rounded-lg bg-card p-4">
            <h2 className="font-display text-sm font-semibold text-ink-2">{IDEA_CATEGORY_LABEL[category]} you&rsquo;ve suggested</h2>
            <div className="flex flex-col gap-2">
              {items.map((idea) => (
                <div key={idea.id} className="flex gap-3 rounded-lg border border-line p-3">
                  {idea.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element -- arbitrary scraped host, not configurable via next/image remotePatterns
                    <img src={idea.image_url} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    {idea.url ? (
                      <a href={idea.url} target="_blank" rel="noreferrer" className="text-sm font-semibold hover:underline">
                        {idea.title ?? idea.url}
                      </a>
                    ) : (
                      <span className="text-sm font-semibold">{idea.title}</span>
                    )}
                    {idea.note && <p className="text-xs text-ink-2">{idea.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
