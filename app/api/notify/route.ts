import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "re_123456789");

export async function POST(req: Request) {
  try {
    const { email, subject, message } = await req.json();

    if (!process.env.RESEND_API_KEY) {
       console.log("Mock Email Sent to ${email}: ${subject} ");
       return NextResponse.json({ success: true, mock: true });
    }

    const data = await resend.emails.send({
      from: "Be Fit Era <onboarding@resend.dev>",
      to: [email],
      subject: subject,
      html: "<p>${message}</p>",
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error });
  }
}
