"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface RewardPreviewCarouselProps {
  images: string[];
  altPrefix: string;
  theme?: "orange" | "emerald";
}

export function RewardPreviewCarousel({ images, altPrefix, theme = "orange" }: RewardPreviewCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const bgClasses = theme === "orange" 
    ? "bg-[#FFFDF5] dark:bg-[#1E1C14] border-[#FFB800]/15 dark:border-[#FFB800]/25" 
    : "bg-[#F5FFF5] dark:bg-[#1C1C1E] border-emerald-500/15 dark:border-emerald-500/25";

  const buttonClasses = theme === "orange"
    ? "hover:text-[#FFB800]"
    : "hover:text-emerald-500";

  const dotActiveClasses = theme === "orange" ? "bg-[#FFB800]" : "bg-emerald-500";

  return (
    <div className={cn("shrink-0 w-full sm:w-64 h-64 rounded-xl border p-4 relative flex flex-col items-center group", bgClasses)}>
      {/* Main Image Viewport */}
      <div className="flex-1 w-full relative flex items-center justify-center -mt-2">
        {images.map((img, index) => (
          <Image
            key={img}
            src={img}
            alt={`${altPrefix} ${index + 1}`}
            width={300}
            height={300}
            priority={index === 0}
            className={cn(
              "absolute w-full h-full object-contain drop-shadow-lg transition-all duration-500",
              index === currentIndex 
                ? "opacity-100 scale-100 group-hover:scale-110 group-hover:rotate-2 z-10" 
                : "opacity-0 scale-95 z-0 pointer-events-none"
            )}
          />
        ))}
      </div>

      {/* Navigation Arrows (Only show if multiple images) */}
      {images.length > 1 && (
        <>
          <button 
            type="button"
            onClick={prevImage}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-white/80 dark:bg-black/50 hover:bg-white dark:hover:bg-black rounded-full shadow-sm text-gray-600 dark:text-gray-300 transition-colors z-20"
          >
            <ChevronLeft size={16} className={buttonClasses} />
          </button>
          
          <button 
            type="button"
            onClick={nextImage}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-white/80 dark:bg-black/50 hover:bg-white dark:hover:bg-black rounded-full shadow-sm text-gray-600 dark:text-gray-300 transition-colors z-20"
          >
            <ChevronRight size={16} className={buttonClasses} />
          </button>

          {/* Dots Indicator */}
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-20">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all duration-300",
                  index === currentIndex 
                    ? cn("w-3 opacity-100", dotActiveClasses)
                    : "bg-gray-300 dark:bg-gray-600 opacity-70 hover:opacity-100"
                )}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
