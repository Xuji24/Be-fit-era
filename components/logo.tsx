import Link from "next/link";
import Image from "next/image";

export default function Logo() {
  return (
    <Link href="/" className="flex items-center w-36 sm:w-44 shrink-0">
      {/* Wordmark is baked in as dark text, so it needs the same
          brightness-0+invert trick as the old fitra-logo.png to stay legible
          on a dark navbar — that flattens the whole mark to solid white
          rather than keeping the orange icon tinted in dark mode. */}
      <Image
        src="/be-fit-era-logo.png"
        alt="be-fit-era"
        width={2079}
        height={756}
        priority
        className="w-full h-auto object-contain dark:brightness-0 dark:invert"
      />
    </Link>
  );
}

export function FooterLogo() {
  return (
    <Link href="/" className="flex items-center w-40">
      {/* Footer band is always dark regardless of site theme, so the
          invert filter is unconditional here (not gated behind dark:). */}
      <Image
        src="/be-fit-era-logo.png"
        alt="be-fit-era"
        width={2079}
        height={756}
        className="w-full h-auto object-contain brightness-0 invert"
      />
    </Link>
  );
}
