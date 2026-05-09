"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface ImageGalleryProps {
  images: string[];
}

export default function ImageGallery({ images }: ImageGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (images.length === 0) return null;

  const openLightbox = (i: number) => setLightboxIndex(i);
  const closeLightbox = () => setLightboxIndex(null);
  const prev = () => setLightboxIndex((i) => (i !== null ? (i - 1 + images.length) % images.length : 0));
  const next = () => setLightboxIndex((i) => (i !== null ? (i + 1) % images.length : 0));

  // Grid layout: 1 image = full width, 2 = side by side, 3+ = 2+1 or 2x2 grid
  const gridClass =
    images.length === 1
      ? "grid-cols-1"
      : images.length === 2
        ? "grid-cols-2"
        : "grid-cols-2";

  const displayImages = images.slice(0, 4);
  const remaining = images.length - 4;

  return (
    <>
      <div className={`grid ${gridClass} gap-1 rounded-xl overflow-hidden`}>
        {displayImages.map((url, i) => (
          <div
            key={url}
            className={`relative overflow-hidden cursor-pointer group ${
              images.length === 3 && i === 2 ? "col-span-2" : ""
            }`}
            onClick={() => openLightbox(i)}
          >
            <img
              src={url}
              alt={`Post image ${i + 1}`}
              className="w-full h-52 object-cover group-hover:scale-105 transition-transform duration-200"
            />
            {/* Overlay for remaining count */}
            {i === 3 && remaining > 0 && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="text-white font-raleway font-bold text-2xl">+{remaining}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <button
            title="Close"
            onClick={closeLightbox}
            className="absolute top-4 right-4 p-2 text-white hover:text-gray-300 transition-colors cursor-pointer z-10"
          >
            <X className="w-6 h-6" />
          </button>

          {images.length > 1 && (
            <>
              <button
                title="Previous image"
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-4 p-2 text-white hover:text-gray-300 transition-colors cursor-pointer z-10"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button
                title="Next image"
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-14 p-2 text-white hover:text-gray-300 transition-colors cursor-pointer z-10"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </>
          )}

          <img
            src={images[lightboxIndex]}
            alt={`Image ${lightboxIndex + 1} of ${images.length}`}
            className="max-w-full max-h-screen object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  title={`Go to image ${i + 1}`}
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(i); }}
                  className={`w-2 h-2 rounded-full transition-all cursor-pointer ${i === lightboxIndex ? "bg-white scale-125" : "bg-white/40 hover:bg-white/70"}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
