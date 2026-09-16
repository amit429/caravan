import { inngest } from "./client";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { sweepDecisions, sweepAutoGeneration, sweepDateOutreach, sweepDigest, sweepIntakeNudges } from "@/lib/agents/chaser";

export const chaserSweep = inngest.createFunction(
  { id: "chaser-sweep", triggers: { cron: "*/30 * * * *" } },
  async ({ step }) => {
    const supabase = createServiceSupabaseClient();
    const { data: trips } = await supabase.from("trips").select("id").eq("status", "active");

    for (const trip of trips ?? []) {
      await step.run(`sweep-decisions-${trip.id}`, () => sweepDecisions(trip.id));
      await step.run(`sweep-auto-generation-${trip.id}`, () => sweepAutoGeneration(trip.id));
      await step.run(`sweep-date-outreach-${trip.id}`, () => sweepDateOutreach(trip.id));
      await step.run(`sweep-digest-${trip.id}`, () => sweepDigest(trip.id));
      await step.run(`sweep-intake-${trip.id}`, () => sweepIntakeNudges(trip.id));
    }

    return { tripsSwept: trips?.length ?? 0 };
  }
);
