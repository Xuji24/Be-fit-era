'use client';
import Image from "next/image";
import { featuresData } from "@/data/features-data";

export default function WhyJoinUs() {
    return(
        <div className="w-full bg-background px-4 sm:px-6 md:px-12 lg:px-16 py-16 sm:py-20 md:py-28 lg:py-32">
            <div className="max-w-6xl mx-auto">
                {/* Section Header */}
                <div className="mb-12 sm:mb-16 lg:mb-20">
                    <span className="font-raleway font-bold text-[var(--brand-hover)] text-xs sm:text-sm tracking-[0.2em] uppercase mb-3 sm:mb-4 block">
                        Why Choose Us
                    </span>
                    <h2 className="font-raleway font-bold text-3xl sm:text-4xl md:text-5xl text-foreground leading-tight mb-4 sm:mb-5">
                        Everything You Need{" "}
                        <span className="text-[var(--brand)]">to Run Better</span>
                    </h2>
                    <p className="font-merriweather-sans text-sm sm:text-base md:text-lg text-foreground/60 leading-relaxed max-w-xl">
                        From tracking your first mile to crossing the finish line — we&apos;ve got you covered.
                    </p>
                </div>

                {/* Feature grid — three separate cards with breathing room
                    between them, instead of one seamless divided panel.
                    featuresData is exactly 3 items, so this reads cleanly at
                    every width instead of reflowing into an uneven grid. */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6">
                    {featuresData.map((feature, index) => (
                        <div
                            key={index}
                            className="interactive-card flex flex-col items-start gap-4 p-6 sm:p-8 bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-white/8"
                        >
                            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[var(--brand)]/15 rounded-xl flex items-center justify-center">
                                <Image
                                    src={feature.icon}
                                    alt={feature.title}
                                    width={28}
                                    height={28}
                                    className="w-6 h-6 sm:w-7 sm:h-7 object-contain"
                                />
                            </div>

                            <div>
                                <h3 className="font-raleway font-bold text-lg sm:text-xl text-foreground mb-1.5 sm:mb-2">
                                    {feature.title}
                                </h3>
                                <p className="font-merriweather-sans text-sm sm:text-base text-foreground/55 dark:text-foreground/50 leading-relaxed">
                                    {feature.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
