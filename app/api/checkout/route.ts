import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCheckoutSession } from "@/lib/paymongo";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { raceId } = (await req.json()) as { raceId?: string };

    if (!raceId) {
      return NextResponse.json(
        { error: "raceId is required" },
        { status: 400 },
      );
    }

    // Fetch race details from DB — never trust client-supplied amounts
    const { data: race, error: raceError } = await supabase
      .from("races")
      .select("registration_fee, title, registration_open")
      .eq("id", raceId)
      .single();

    if (raceError || !race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    if (!race.registration_open) {
      return NextResponse.json(
        { error: "Registration is closed for this race" },
        { status: 400 },
      );
    }

    const feePhp = Number(race.registration_fee ?? 0);

    // Free race — skip payment entirely
    if (feePhp <= 0) {
      return NextResponse.json({
        success: true,
        url: `/race/${raceId}?success=true`,
      });
    }

    // No PayMongo key — dev mock (sandbox key not set yet)
    if (!process.env.PAYMONGO_SECRET_KEY) {
      console.log(
        `[Mock Checkout] User ${user.id}, Race ${raceId}, Fee ₱${feePhp}`,
      );
      return NextResponse.json({
        success: true,
        url: `/race/${raceId}?success=true&mock=true`,
      });
    }

    // Fetch the buyer's profile for billing info
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();

    const session = await createCheckoutSession({
      raceId,
      raceTitle: race.title,
      amountPhp: feePhp,
      buyerEmail: profile?.email ?? user.email ?? "",
      buyerName: profile?.full_name ?? "Runner",
      appUrl: APP_URL,
    });

    return NextResponse.json({ url: session.checkoutUrl, sessionId: session.id });
  } catch (error: unknown) {
    console.error("[checkout] Error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}
