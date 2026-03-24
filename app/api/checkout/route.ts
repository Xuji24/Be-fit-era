import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_12345", {
  apiVersion: "2026-02-25.clover"
});

export async function POST(req: Request) {
  try {
    const { raceId, userId } = await req.json();

    if (!process.env.STRIPE_SECRET_KEY) {
       console.log("Mock Checkout generated for User ${userId}, Race ${raceId} ");
       return NextResponse.json({ success: true, url: "/race/${raceId}?success=true&mock=true" });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "Race Registration" },
            unit_amount: 1500, // .00
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: "${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/race/${raceId}?success=true",
      cancel_url: "${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/race/${raceId}?canceled=true",
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
