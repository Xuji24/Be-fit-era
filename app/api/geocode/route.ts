import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { geocodeAddress } from "@/lib/geocode";

/**
 * GET /api/geocode?q=<address>
 *
 * Proxies address lookups to OpenStreetMap's Nominatim geocoder so organizers get
 * address suggestions while creating a race. Server-side because Nominatim's usage
 * policy requires an identifying User-Agent and caps traffic at ~1 request/second.
 *
 * Returns: { results: { label, lat, lng }[] }
 */

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query || query.length < 3) return NextResponse.json({ results: [] });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Nominatim allows ~1 req/sec; keep well under it per user.
  const { allowed } = await checkRateLimit(`geocode:${user.id}`, 30, 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many searches. Please slow down." },
      { status: 429 },
    );
  }

  try {
    return NextResponse.json({ results: await geocodeAddress(query) });
  } catch {
    return NextResponse.json(
      { error: "Address lookup unavailable. You can still pin on the map." },
      { status: 502 },
    );
  }
}
