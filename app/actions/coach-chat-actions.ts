"use server";

import { createClient } from "@/lib/supabase/server";

export interface ChatMessageRow {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

const HISTORY_LIMIT = 50;

/** Chat history for the initial page render, oldest first. */
export async function getChatHistory(): Promise<ChatMessageRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("coach_messages")
    .select("id, role, content, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  return (data ?? [])
    .reverse()
    .map((m) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.created_at }));
}
