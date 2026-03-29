"use server";

import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .single();

  if (profile?.role !== "admin") {
    throw new Error("Forbidden: Admins only");
  }

  return { supabase, user: authData.user };
}

export interface AdminDispute {
  id: string;
  user_id: string;
  runner_name: string;
  distance_km: number;
  activity_type: string;
  flag_reason: string;
  created_at: string;
  race_title: string;
}

export async function getAdminDisputes(): Promise<AdminDispute[]> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from('activity_entries')
    .select('id, user_id, distance_km, activity_type, flag_reason, created_at, profiles(full_name), race_registrations(races(title))')
    .eq('is_flagged', true)
    .order('created_at', { ascending: false });
    
  if (error) throw new Error(error.message);
  
  return data.map((d: any) => ({
    ...d, 
    runner_name: d.profiles?.full_name || 'Unknown', 
    race_title: d.race_registrations?.races?.title || 'Unknown'
  }));
}

export async function resolveDispute(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase
      .from('activity_entries')
      .update({ is_flagged: false, flag_reason: null })
      .eq('id', id);
      
    if (error) throw new Error(error.message);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function rejectDispute(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from('activity_entries').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
