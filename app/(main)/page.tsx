import type { Metadata } from "next";
import HomePage from "@/components/pages/main/home/HomePage";

export const metadata: Metadata = {
  // Explicit "| be-fit-era" suffix rather than relying on the layout's title
  // template — Next doesn't apply a layout's own template to that layout's
  // own index page (only to genuinely nested child segments like /race).
  title: "be-fit-era",
  description:
    "be-fit-era is where runners organize races, join events, and track their running progress — from sign-up to finish line.",
  openGraph: {
    title: "be-fit-era",
    description:
      "Where runners organize races, join events, and track their running progress — from sign-up to finish line.",
    url: "/",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "be-fit-era",
    description:
      "Where runners organize races, join events, and track their running progress — from sign-up to finish line.",
  },
};

export default function Home() {
  return (
    <div>
      <HomePage />
    </div>
  );
}
