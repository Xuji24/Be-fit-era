import Image from "next/image";
import { Button } from "@/components/shadcn/button";
import Link from "next/link";

export default function HeroSection({ isLoggedIn }: { isLoggedIn: boolean }) {
  const primaryCta = isLoggedIn ? (
    <Link href="/activities" className="w-full sm:w-auto">
      <Button className="w-full sm:w-auto font-raleway font-bold text-sm sm:text-base bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand-hover)] transition-all px-6 sm:px-8 py-2.5 sm:py-3 rounded-full cursor-pointer shadow-lg shadow-[var(--brand)]/30 hover:shadow-xl hover:shadow-[var(--brand)]/40 hover:scale-[1.02] active:scale-[0.98]">
        View Activities
      </Button>
    </Link>
  ) : (
    <Link href="/signup" className="w-full sm:w-auto">
      <Button className="w-full sm:w-auto font-raleway font-bold text-sm sm:text-base bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand-hover)] transition-all px-6 sm:px-8 py-2.5 sm:py-3 rounded-full cursor-pointer shadow-lg shadow-[var(--brand)]/30 hover:shadow-xl hover:shadow-[var(--brand)]/40 hover:scale-[1.02] active:scale-[0.98]">
        Get Started Free
      </Button>
    </Link>
  );

  const secondaryCta = (
    <Link href="/race" className="w-full sm:w-auto">
      <Button
        variant="outline"
        className="w-full sm:w-auto font-raleway font-bold text-sm sm:text-base bg-background text-foreground border-foreground/20 hover:bg-foreground/5 hover:border-foreground/30 transition-all px-6 sm:px-8 py-2.5 sm:py-3 rounded-full cursor-pointer"
      >
        Browse Races
      </Button>
    </Link>
  );

  const heading = (
    <h1 className="font-raleway font-bold text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-foreground leading-tight mb-3 sm:mb-4">
      Your Era. <span className="text-[var(--brand)]">Your Fitness.</span>
    </h1>
  );

  const mission = (
    <p className="font-merriweather-sans text-sm sm:text-sm md:text-base text-foreground/70 leading-relaxed mb-6 sm:mb-7">
      Our mission is to make consistency easier than quitting — the tools to
      track progress, stay motivated, and grow alongside a community that
      shows up together.
    </p>
  );

  return (
    <section className="w-full bg-background pt-8 sm:pt-10 pb-14 sm:pb-16 px-4 sm:px-6 md:px-12 lg:px-16">
      {/* Padding lives on this full-width section, and max-w-6xl below is a
          pure width cap with no padding of its own — matching WhyJoinUs /
          Community's structure exactly, so the hero image is pixel-for-pixel
          the same width as the feature cards row at every breakpoint,
          including on very wide screens where max-w-6xl (not the viewport)
          is what's constraining the layout. */}
      <div className="max-w-6xl mx-auto">
        {/* Mobile: the image alone doesn't leave enough width for legible
            overlaid text, so it stays a plain contained visual (still
            reduced from the old full-bleed edge-to-edge size) with copy and
            CTAs in normal flow underneath. */}
        <div className="sm:hidden">
          <div className="relative w-full overflow-hidden rounded-3xl aspect-[3/2]">
            <Image
              src="/be-fit-era-header-section.png"
              alt="A runner on a city waterfront at sunset, representing the be-fit-era community"
              fill
              priority
              sizes="100vw"
              className="object-cover object-[center_60%]"
            />
          </div>
          <div className="mt-6">
            {heading}
            {mission}
            <div className="flex flex-col gap-3">
              {primaryCta}
              {secondaryCta}
            </div>
          </div>
        </div>

        {/* sm and up: image is boxed into the page's max-w-6xl column
            (down from full-bleed) and capped to a short aspect ratio via
            object-cover, so it reads as a supporting visual instead of a
            huge banner. Headline/mission/CTAs sit in the empty left side of
            the photo, kept legible by a scrim that fades from the page
            background into transparent — safer than relying on the source
            image's own light area, which shifts with the crop at each
            breakpoint. */}
        <div className="hidden sm:block relative w-full overflow-hidden rounded-3xl sm:aspect-video lg:aspect-[21/9]">
          <Image
            src="/be-fit-era-header-section.png"
            alt="A runner on a city waterfront at sunset, representing the be-fit-era community"
            fill
            priority
            quality={90}
            sizes="(min-width: 1024px) 1024px, (min-width: 768px) 672px, 100vw"
            className="object-cover object-[center_60%]"
          />
          <div className="absolute inset-0 bg-linear-to-r from-background via-background/85 md:via-background/70 to-transparent" />
          <div className="absolute inset-0 flex items-center">
            <div className="w-full max-w-sm md:max-w-md px-8 md:px-12 lg:px-14">
              {heading}
              {mission}
              <div className="flex flex-col sm:flex-row gap-3">
                {primaryCta}
                {secondaryCta}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
