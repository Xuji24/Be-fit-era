import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_12345", {
  apiVersion: "2026-02-25.clover",
});

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
      return NextResponse.json({ error: "raceId is required" }, { status: 400 });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      console.log(
        `Mock Checkout generated for User ${user.id}, Race ${raceId}`,
      );
      return NextResponse.json({
        success: true,
        url: `/race/${raceId}?success=true&mock=true`,
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "Race Registration" },
            unit_amount: 1500,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: { raceId, userId: user.id },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/race/${raceId}?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/race/${raceId}?canceled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}
