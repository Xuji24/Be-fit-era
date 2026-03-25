import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client to bypass RLS for background system operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  // Validate the authorization header strictly for Vercel Cron invocation
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const now = new Date().toISOString();
    const todayDateOnly = now.split('T')[0];

    // 1. Close registrations if the deadline has passed
    const { data: closedRaces, error: closeError } = await supabaseAdmin
      .from('races')
      .update({ registration_open: false })
      .eq('registration_open', true)
      .lt('registration_deadline', now)
      .select('id, title');

    if (closeError) {
      console.error('Error closing registrations:', closeError);
      throw closeError;
    }

    // 2. Mark upcoming/active races as "completed" if their date has passed
    const { data: completedRaces, error: completeError } = await supabaseAdmin
      .from('races')
      .update({ status: 'completed' })
      .in('status', ['upcoming', 'active'])
      .lt('event_date', todayDateOnly)
      .select('id, title');

    if (completeError) {
      console.error('Error completing races:', completeError);
      throw completeError;
    }

    // You could also add logic here in the future to:
    // - Calculate final leaderboard rankings for "completedRaces"
    // - Send notification emails to participants via Resend

    return NextResponse.json({ 
      success: true, 
      message: 'Race timeframes updated successfully',
      closedRegistrationsCount: closedRaces?.length || 0,
      completedRacesCount: completedRaces?.length || 0,
    }, { status: 200 });

  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}
