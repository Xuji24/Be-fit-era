import { NextResponse } from "next/server";

/** @deprecated Email is sent via lib/email from server actions. Public access disabled. */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "This endpoint has been removed. Email notifications are sent server-side.",
    },
    { status: 410 },
  );
}
