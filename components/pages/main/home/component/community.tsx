'use client';

import Image from "next/image";
import { communityData } from "@/data/community-data";

function formatNumber(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(num % 1000 === 0 ? 0 : 1) + "K";
  }
  return num.toString();
}

export default function Community(){
    return(
        <div className="w-full bg-[#1A1A1A] dark:bg-[#0D0D0D] py-16 sm:py-20 md:py-28 lg:py-32 px-4 sm:px-6 md:px-12 lg:px-16 relative overflow-hidden">
            {/* Subtle radial glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-125 h-125 rounded-full bg-[var(--brand)]/8 blur-[120px] pointer-events-none" />

            <div className="max-w-6xl mx-auto relative z-10">
                {/* Section Header */}
                <div className="text-center mb-12 sm:mb-16 lg:mb-20">
                    <span className="font-raleway font-bold text-[var(--brand)] text-xs sm:text-sm tracking-[0.2em] uppercase mb-3 sm:mb-4 block">
                        Our Community
                    </span>
                    <h2 className="font-raleway text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 sm:mb-5">
                        Run Together.{" "}
                        <span className="text-[var(--brand-soft)]">Grow Together.</span>
                    </h2>
                    <p className="font-merriweather-sans text-sm sm:text-base md:text-lg text-white/60 max-w-xl mx-auto leading-relaxed">
                        Join a thriving global community of runners tracking progress, competing, and pushing their limits.
                    </p>
                </div>

                {/* Stats Row — bold, impactful numbers, each with real
                    breathing room instead of relying on a divider line to
                    read as separate. */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 lg:gap-12">
                    {communityData.map((item) => (
                        <div key={item.id} className="flex flex-col items-center text-center">
                            {/* Icon */}
                            <div className="w-12 h-12 mb-4 bg-[var(--brand)]/12 rounded-lg flex items-center justify-center">
                                <Image
                                    src={item.icon}
                                    alt={item.title}
                                    width={24}
                                    height={24}
                                    className="object-contain brightness-0 invert opacity-80"
                                />
                            </div>
                            {/* Number — font-bold (700), not font-extrabold:
                                Raleway is only loaded at 400/500/600/700 (see
                                app/(main)/layout.tsx), so 800 was rendering
                                as a browser-faked faux-bold that reads
                                smeared next to the rest of the site's type. */}
                            <p className="font-raleway text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight mb-2">
                                <span className="text-[var(--brand)]">+</span>
                                {formatNumber(item.growthNumber)}
                            </p>
                            {/* Label */}
                            <span className="font-merriweather-sans text-xs sm:text-sm font-medium text-white/50 uppercase tracking-wider">
                                {item.title}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
