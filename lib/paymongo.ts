/**
 * PayMongo helpers — works identically with sandbox and live keys.
 * Sandbox:  PAYMONGO_SECRET_KEY=sk_test_...
 * Live:     PAYMONGO_SECRET_KEY=sk_live_...
 *
 * Swap the key in your environment — no code changes required.
 */

const PAYMONGO_API = "https://api.paymongo.com/v1";

function authHeader(): string {
  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) throw new Error("PAYMONGO_SECRET_KEY is not set");
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

export type PayMongoPaymentMethod =
  | "card"
  | "gcash"
  | "paymaya"
  | "brankas_bdo"
  | "brankas_landbank"
  | "brankas_metrobank"
  | "dob"
  | "dob_ubp"
  | "billease"
  | "qrph";

interface CreateCheckoutParams {
  raceId: string;
  raceTitle: string;
  /** Amount in PHP (e.g. 500 = ₱500) */
  amountPhp: number;
  /** Buyer's email for the receipt */
  buyerEmail: string;
  /** Buyer's full name */
  buyerName: string;
  appUrl: string;
}

export interface PayMongoCheckoutSession {
  id: string;
  checkoutUrl: string;
}

/**
 * Creates a PayMongo checkout session and returns the session id + redirect URL.
 * PayMongo amounts are in centavos (smallest unit), so ₱500 = 50000.
 */
export async function createCheckoutSession(
  params: CreateCheckoutParams,
): Promise<PayMongoCheckoutSession> {
  const { raceId, raceTitle, amountPhp, buyerEmail, buyerName, appUrl } =
    params;

  const amountCentavos = Math.round(amountPhp * 100);

  const body = {
    data: {
      attributes: {
        billing: {
          name: buyerName,
          email: buyerEmail,
        },
        send_email_receipt: true,
        show_description: true,
        show_line_items: true,
        cancel_url: `${appUrl}/race/${raceId}?canceled=true`,
        success_url: `${appUrl}/race/${raceId}?success=true`,
        description: `${raceTitle} — Race Registration`,
        line_items: [
          {
            currency: "PHP",
            amount: amountCentavos,
            name: raceTitle,
            description: "Race registration fee",
            quantity: 1,
          },
        ],
        // Supported PH payment methods — card, GCash, Maya, QR Ph
        payment_method_types: [
          "card",
          "gcash",
          "paymaya",
          "qrph",
        ] satisfies PayMongoPaymentMethod[],
        metadata: { race_id: raceId },
      },
    },
  };

  const res = await fetch(`${PAYMONGO_API}/checkout_sessions`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail =
      (err as { errors?: { detail?: string }[] })?.errors?.[0]?.detail ??
      "PayMongo request failed";
    throw new Error(detail);
  }

  const json = await res.json();
  return {
    id: json.data.id as string,
    checkoutUrl: json.data.attributes.checkout_url as string,
  };
}

/**
 * Retrieves a checkout session from PayMongo by its ID.
 * Used in the webhook to confirm the payment status.
 */
export async function getCheckoutSession(sessionId: string) {
  const res = await fetch(
    `${PAYMONGO_API}/checkout_sessions/${sessionId}`,
    {
      headers: { Authorization: authHeader() },
      cache: "no-store",
    },
  );

  if (!res.ok) return null;
  const json = await res.json();
  return json.data ?? null;
}

/**
 * Verifies a PayMongo webhook signature.
 *
 * PayMongo sends the raw body + a signature header:
 *   paymongo-signature: t=<timestamp>,te=<test_sig>,li=<live_sig>
 *
 * We verify against the secret that matches the current key type
 * (test secret for sk_test_*, live secret for sk_live_*).
 *
 * Returns true if valid, false otherwise.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): Promise<boolean> {
  if (!signatureHeader) return false;

  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!webhookSecret) return false;

  // Parse the signature header: t=...,te=...,li=...
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => p.split("=")),
  );
  const timestamp = parts["t"];
  const isLive = process.env.PAYMONGO_SECRET_KEY?.startsWith("sk_live_");
  const signature = isLive ? parts["li"] : parts["te"];

  if (!timestamp || !signature) return false;

  const payload = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  const computed = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return computed === signature;
}
