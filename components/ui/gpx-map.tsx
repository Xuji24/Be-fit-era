"use client";

import dynamic from "next/dynamic";

const GpxMapInner = dynamic(() => import("./gpx-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="h-100 w-full animate-pulse bg-gray-200 dark:bg-zinc-800 rounded-xl"></div>
  ),
});

export default GpxMapInner;
