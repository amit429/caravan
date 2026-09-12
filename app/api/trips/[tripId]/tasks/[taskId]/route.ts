import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller, callerAuthError } from "@/lib/auth/resolve-caller";
import { getAdminUser } from "@/lib/auth/session";
import { taskStatusSchema } from "@/lib/validation";
import { broadcastTripChange } from "@/lib/realtime/broadcast";

// Members can only toggle their own task (or an unassigned group task);
// the admin can toggle anyone's — same shape as the vote/close split elsewhere.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tripId: string; taskId: string }> }
) {
  const { tripId, taskId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  const authError = callerAuthError(caller);
  if (authError) return authError;

  const body = await request.json();
  const parsed = taskStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: task } = await supabase
    .from("tasks")
    .select("id, member_id")
    .eq("id", taskId)
    .eq("trip_id", tripId)
    .single();
  if (!task) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const isAdmin = !!(await getAdminUser());
  if (task.member_id && task.member_id !== caller!.id && !isAdmin) {
    return NextResponse.json({ error: "not_your_task" }, { status: 403 });
  }

  const { data: updated, error } = await supabase
    .from("tasks")
    .update({ done: parsed.data.done })
    .eq("id", taskId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: "could_not_update_task" }, { status: 500 });
  await broadcastTripChange(tripId);
  return NextResponse.json({ task: updated });
}
