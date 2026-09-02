import Image from "next/image";

export default function LoginHero() {
  return (
    <div className="hidden lg:flex relative w-full lg:w-1/2 min-h-screen overflow-hidden items-center bg-background">
      {/* Reference-provided photo — already carries its own arc/dot/wave
          decoration, so no extra CSS overlay or accent stripes on top of it
          (stacking more effects on a busy image just muddies it). Background
          is light, so copy runs in the site's normal dark ink, not white. */}
      <Image
        src="/be-fit-era-auth-pages.png"
        alt=""
        fill
        priority
        sizes="50vw"
        className="object-cover object-[70%_center]"
      />

      {/* Content — kept as our own copy, not the wording from the reference
          mockup. */}
      <div className="relative z-10 px-10 lg:px-14 xl:px-20 text-left max-w-md">
        <h2 className="font-raleway font-bold text-3xl lg:text-4xl xl:text-[2.75rem] text-foreground leading-tight mb-4">
          Bold Race
          <span className="block bg-linear-to-r from-[var(--brand)] to-[var(--brand-hover)] bg-clip-text text-transparent">
            Energy
          </span>
        </h2>
        <p className="font-merriweather-sans text-sm lg:text-base text-foreground/70 leading-relaxed max-w-xs">
          Every stride brings you closer to the finish line. Track your runs,
          join races, and unleash your potential.
        </p>

        {/* Accent line */}
        <div className="mt-8 w-16 h-1 rounded-full bg-linear-to-r from-[var(--brand)] to-[var(--brand-hover)]" />
      </div>
    </div>
  );
}
