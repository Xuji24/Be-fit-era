/* eslint-disable */
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

function isValidImageUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    // Must have a pathname beyond just "/"
    if (parsed.pathname === "/" || parsed.pathname === "") return false;
    // Must look like an image file or be from a known image CDN
    const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|avif)(\?.*)?$/i;
    const knownImageCdns = /\/(photo|image|img|media|cdn-cgi|storage)\//i;
    return imageExtensions.test(parsed.pathname) || knownImageCdns.test(parsed.pathname);
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const title = searchParams.get("title") ?? "Race Event";
  const date = searchParams.get("date") ?? "";
  const location = searchParams.get("location") ?? "";
  const category = searchParams.get("category") ?? "";
  const image = searchParams.get("image") ?? "";
  const safeImage = isValidImageUrl(image) ? image : "";

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.befitra.app";
  const logoUrl = `${siteUrl}/fitra-logo.png`;

  try {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: "#0A0A0A",
          fontFamily: "sans-serif",
        }}
      >
        {/* Race cover image as blurred background */}
        {safeImage ? (
          <img
            src={safeImage}
            alt={title}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.35,
            }}
          />
        ) : null}

        {/* Dark gradient overlay — heavier on the left so text is readable */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(120deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.70) 55%, rgba(0,0,0,0.40) 100%)",
            display: "flex",
          }}
        />

        {/* Right-side accent strip */}
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: 8,
            backgroundColor: "#FF5733",
            display: "flex",
          }}
        />

        {/* Content container */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "48px 64px",
            width: "100%",
          }}
        >
          {/* Top: Fitra logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img
              src={logoUrl}
              alt="Fitra"
              style={{ width: 120, height: 36, objectFit: "contain" }}
            />
          </div>

          {/* Middle: Race title */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 780 }}>
            <div
              style={{
                color: "#FFFFFF",
                fontSize: 58,
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: "-1px",
              }}
            >
              {title}
            </div>

            {/* Meta pills */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {date ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    backgroundColor: "rgba(255,255,255,0.12)",
                    padding: "10px 20px",
                    borderRadius: 10,
                    color: "#FFFFFF",
                    fontSize: 22,
                    border: "1px solid rgba(255,255,255,0.2)",
                  }}
                >
                  {`📅  ${date}`}
                </div>
              ) : null}
              {location ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    backgroundColor: "rgba(255,255,255,0.12)",
                    padding: "10px 20px",
                    borderRadius: 10,
                    color: "#FFFFFF",
                    fontSize: 22,
                    border: "1px solid rgba(255,255,255,0.2)",
                  }}
                >
                  {`📍  ${location}`}
                </div>
              ) : null}
              {category ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    backgroundColor: "#FF5733",
                    padding: "10px 20px",
                    borderRadius: 10,
                    color: "#FFFFFF",
                    fontSize: 22,
                    fontWeight: 700,
                  }}
                >
                  {`🏅  ${category}`}
                </div>
              ) : null}
            </div>
          </div>

          {/* Bottom: CTA + domain */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 20, letterSpacing: "0.5px" }}>
              befitra.app
            </div>
            <div
              style={{
                backgroundColor: "#FF5733",
                color: "#FFFFFF",
                padding: "12px 32px",
                borderRadius: 10,
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: "0.3px",
              }}
            >
              Register Now
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
  } catch {
    return new Response("Failed to generate OG image", { status: 500 });
  }
}
