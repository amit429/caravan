import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller, callerAuthError } from "@/lib/auth/resolve-caller";
import { extractIdeaMetadata } from "@/lib/ideas/extract-idea";
import { createIdeaSchema } from "@/lib/validation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  const authError = callerAuthError(caller);
  if (authError) return authError;

  const { data, error } = await supabase
    .from("ideas")
    .select()
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "could_not_list_ideas" }, { status: 500 });
  return NextResponse.json({ ideas: data });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  const authError = callerAuthError(caller);
  if (authError) return authError;

  const body = await request.json();
  const parsed = createIdeaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const metadata = await extractIdeaMetadata(parsed.data.url);

  const { data: idea, error } = await supabase
    .from("ideas")
    .insert({
      trip_id: tripId,
      member_id: caller!.id,
      url: parsed.data.url,
      title: metadata.title,
      note: metadata.note,
      image_url: metadata.imageUrl,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: "could_not_save_idea" }, { status: 500 });
  return NextResponse.json({ idea }, { status: 201 });
}
