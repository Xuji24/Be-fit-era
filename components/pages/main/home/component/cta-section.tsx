import { Button } from "@/components/shadcn/button";
import Link from "next/link";
import Image from "next/image";

const featureShots = [
  {
    src: "/feature-leaderboard.png",
    alt: "Weekly leaderboard ranking runners by distance",
    className: "w-[62%] top-0 left-0 -rotate-6 z-10 aspect-[430/428]",
  },
  {
    src: "/feature-community.png",
    alt: "Community feed for sharing race stories and milestones",
    className: "w-[64%] top-8 sm:top-10 right-0 rotate-3 z-20 aspect-[430/620]",
  },
  {
    src: "/feature-races.png",
    alt: "Race browsing page with upcoming races to join",
    className: "w-[68%] bottom-0 left-4 sm:left-6 -rotate-3 z-30 aspect-[430/620]",
  },
];

export default function CTASection({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <div className="w-full relative bg-[#1A1A1A] dark:bg-[#0D0D0D] py-20 sm:py-24 md:py-28 px-4 sm:px-6 md:px-12 lg:px-16 overflow-hidden">
      {/* Accent gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-linear-to-r from-[var(--brand)] via-[var(--brand-soft)] to-[var(--brand)]" />

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 sm:gap-20 lg:gap-12 items-center relative z-10">
        {/* Screenshot stack — real feature pages, fanned like a stack of
            cards instead of one flat banner photo. */}
        <div className="relative h-[340px] sm:h-[420px] lg:h-[440px] max-w-sm mx-auto lg:mx-0 w-full order-2 lg:order-1">
          {featureShots.map((shot) => (
            <div
              key={shot.src}
              className={`absolute rounded-2xl overflow-hidden border-4 border-white/10 shadow-2xl shadow-black/40 ${shot.className}`}
            >
              <Image
                src={shot.src}
                alt={shot.alt}
                fill
                sizes="(min-width: 1024px) 280px, 45vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>

        {/* Copy — short bulleted features instead of one paragraph. */}
        <div className="order-1 lg:order-2 text-center lg:text-left">
          <span className="font-raleway font-bold text-[var(--brand-soft)] text-xs sm:text-sm tracking-[0.2em] uppercase mb-4 sm:mb-5 block">
            Ready?
          </span>
          <h2 className="font-raleway font-bold text-3xl sm:text-4xl md:text-5xl text-white leading-tight mb-5 sm:mb-6">
            Your Next <span className="text-[var(--brand)]">Finish Line</span> Awaits
          </h2>
          <ul className="font-merriweather-sans text-sm sm:text-base text-white/70 mb-8 sm:mb-10 space-y-3 text-left inline-block lg:block">
            <li className="flex items-start gap-3">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[var(--brand)] shrink-0" />
              Browse and join races happening near you
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[var(--brand)] shrink-0" />
              Share your journey with a community that shows up
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[var(--brand)] shrink-0" />
              Climb the leaderboard and outpace the competition
            </li>
          </ul>
          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start items-center">
            {isLoggedIn ? (
              <Link href="/race">
                <Button className="font-raleway font-bold text-base sm:text-lg bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand-hover)] transition-all px-10 sm:px-12 py-3.5 sm:py-4 rounded-full cursor-pointer shadow-lg shadow-[var(--brand)]/30 hover:shadow-xl hover:shadow-[var(--brand)]/40 hover:scale-[1.02] active:scale-[0.98]">
                  Browse Races
                </Button>
              </Link>
            ) : (
              <Link href="/signup">
                <Button className="font-raleway font-bold text-base sm:text-lg bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand-hover)] transition-all px-10 sm:px-12 py-3.5 sm:py-4 rounded-full cursor-pointer shadow-lg shadow-[var(--brand)]/30 hover:shadow-xl hover:shadow-[var(--brand)]/40 hover:scale-[1.02] active:scale-[0.98]">
                  Sign Up Free
                </Button>
              </Link>
            )}
            <Link
              href="/race"
              className="font-raleway font-bold text-sm sm:text-base text-white/70 hover:text-[var(--brand-soft)] transition-colors underline underline-offset-4 decoration-white/25 hover:decoration-[var(--brand-soft)]"
            >
              Explore Races →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
