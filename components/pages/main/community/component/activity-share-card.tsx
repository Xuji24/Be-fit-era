"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as MapLibreGL from "maplibre-gl";
import {
  decodeRoute,
  formatDuration,
  routeToSvgPath,
  type StravaActivity,
} from "@/lib/strava-share";

const CARD_SIZE = 600;
const ROUTE_COLOR = "#FF5733";

// Carto's OSM-derived basemaps — same styles the shared <Map> uses, no API key.
const CARD_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

/** Longest we'll wait on any single map event before capturing anyway. */
const EVENT_TIMEOUT_MS = 8000;

/**
 * Resolve when `event` fires, when `alreadyDone` is already true, or when the
 * timeout elapses — whichever comes first. The timeout matters because a
 * stalled tile request would otherwise leave the button spinning forever.
 */
function waitFor(
  map: MapLibreGL.Map,
  event: "styledata" | "idle",
  alreadyDone?: () => boolean,
): Promise<void> {
  if (alreadyDone?.()) return Promise.resolve();

  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      map.off(event, finish);
      resolve();
    };
    const timer = setTimeout(finish, EVENT_TIMEOUT_MS);
    map.on(event, finish);
  });
}

/**
 * Generates a shareable image for a Strava activity: the Carto basemap and the
 * route rendered by MapLibre, with a stats overlay drawn on top in canvas.
 *
 * A single hidden map instance is created lazily and reused for every card, so
 * repeated generation costs one WebGL context and one set of tile fetches
 * rather than one per activity.
 */
export function useActivityCard() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreGL.Map | null>(null);
  const [generating, setGenerating] = useState(false);

  // Tear the map down with the component that owns the hook.
  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      containerRef.current?.remove();
      containerRef.current = null;
    };
  }, []);

  const getMap = useCallback(async (): Promise<MapLibreGL.Map> => {
    if (mapRef.current) return mapRef.current;

    // The container must stay inside the viewport with real dimensions —
    // MapLibre never starts rendering (and fetches no tiles) for an element
    // parked off-screen. It's hidden behind the page instead: zero opacity,
    // no pointer events, and a negative z-index.
    const container = document.createElement("div");
    container.style.cssText =
      `position:fixed;left:0;top:0;width:${CARD_SIZE}px;height:${CARD_SIZE}px;` +
      `opacity:0;pointer-events:none;z-index:-1;`;
    container.setAttribute("aria-hidden", "true");
    document.body.appendChild(container);
    containerRef.current = container;

    const map = new MapLibreGL.Map({
      container,
      style: CARD_STYLE,
      attributionControl: false,
      interactive: false,
      renderWorldCopies: false,
      // Required to read pixels back out of the WebGL canvas; without it
      // toDataURL returns a blank image.
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });

    map.resize();
    // Wait for the style rather than `load`: adding sources/layers requires a
    // parsed style, and `styledata` still fires in a hidden tab, where the
    // rAF-driven `load` never would.
    await waitFor(map, "styledata", () => map.isStyleLoaded() === true);
    mapRef.current = map;
    return map;
  }, []);

  /**
   * Render `activity` to a JPEG blob, or null if it has no usable route.
   * Runs are generated one at a time on the shared map instance.
   */
  const generate = useCallback(
    async (activity: StravaActivity): Promise<Blob | null> => {
      if (!activity.polyline) return null;
      const coordinates = decodeRoute(activity.polyline);
      if (coordinates.length < 2) return null;

      setGenerating(true);
      try {
        const map = await getMap();

        const sourceId = "share-route";
        if (map.getLayer(sourceId)) map.removeLayer(sourceId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);

        map.addSource(sourceId, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates },
          },
        });
        map.addLayer({
          id: sourceId,
          type: "line",
          source: sourceId,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": ROUTE_COLOR, "line-width": 5, "line-opacity": 0.95 },
        });

        let [minLng, minLat] = coordinates[0];
        let [maxLng, maxLat] = coordinates[0];
        for (const [lng, lat] of coordinates) {
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }
        map.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat],
          ],
          // Extra bottom padding keeps the route clear of the stats overlay.
          { padding: { top: 60, right: 60, bottom: 190, left: 60 }, duration: 0 },
        );

        // `idle` fires once tiles have finished loading and rendering — capturing
        // before this yields a half-drawn basemap. Bounded so a stalled tile
        // request degrades to a slightly plainer card instead of hanging.
        if (document.visibilityState === "visible") {
          await waitFor(map, "idle");
        }

        const canvas = document.createElement("canvas");
        canvas.width = CARD_SIZE;
        canvas.height = CARD_SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        // MapLibre renders via requestAnimationFrame, which browsers suspend in
        // hidden tabs — the basemap would be blank. Draw the route ourselves in
        // that case so the card is still usable.
        if (document.visibilityState === "visible" && map.loaded()) {
          ctx.drawImage(map.getCanvas(), 0, 0, CARD_SIZE, CARD_SIZE);
        } else {
          drawFallbackRoute(ctx, coordinates);
        }
        drawStatsOverlay(ctx, activity);

        return await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85),
        );
      } finally {
        setGenerating(false);
      }
    },
    [getMap],
  );

  return { generate, generating };
}

/**
 * Draw the route on a plain background, for when the basemap isn't available
 * (hidden tab, or tiles that didn't arrive before the timeout).
 */
function drawFallbackRoute(
  ctx: CanvasRenderingContext2D,
  coordinates: [number, number][],
) {
  ctx.fillStyle = "#F2F4F7";
  ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);

  // The route is drawn above the stats overlay, hence the generous padding.
  const path = new Path2D(routeToSvgPath(coordinates, CARD_SIZE, 90));
  ctx.strokeStyle = ROUTE_COLOR;
  ctx.lineWidth = 6;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke(path);
}

/** Draw the gradient scrim and activity stats across the bottom of the card. */
function drawStatsOverlay(ctx: CanvasRenderingContext2D, activity: StravaActivity) {
  const scrimTop = CARD_SIZE - 170;

  const gradient = ctx.createLinearGradient(0, scrimTop, 0, CARD_SIZE);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(0.45, "rgba(0,0,0,0.72)");
  gradient.addColorStop(1, "rgba(0,0,0,0.9)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, scrimTop, CARD_SIZE, 170);

  // Activity name, truncated to keep it on one line.
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "600 26px system-ui, -apple-system, sans-serif";
  ctx.textBaseline = "alphabetic";
  let title = activity.name;
  while (ctx.measureText(title).width > CARD_SIZE - 80 && title.length > 4) {
    title = title.slice(0, -2);
  }
  if (title !== activity.name) title += "…";
  ctx.fillText(title, 40, CARD_SIZE - 108);

  const stats: [string, string][] = [
    [`${activity.distance}`, "KM"],
    [activity.averagePace.replace("/km", ""), "PACE"],
    [formatDuration(activity.movingTime), "TIME"],
  ];

  stats.forEach(([value, label], i) => {
    const x = 40 + i * 175;
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "700 34px system-ui, -apple-system, sans-serif";
    ctx.fillText(value, x, CARD_SIZE - 58);

    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = "600 13px system-ui, -apple-system, sans-serif";
    ctx.letterSpacing = "1px";
    ctx.fillText(label, x, CARD_SIZE - 36);
    ctx.letterSpacing = "0px";
  });

  // Strava attribution — API Agreement Section 2.14.5.
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "500 13px system-ui, -apple-system, sans-serif";
  const credit = "via Strava";
  ctx.fillText(credit, CARD_SIZE - 40 - ctx.measureText(credit).width, CARD_SIZE - 36);

  // Basemap attribution — Carto/OpenStreetMap terms.
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "400 11px system-ui, -apple-system, sans-serif";
  const osm = "© OpenStreetMap contributors © CARTO";
  ctx.fillText(osm, CARD_SIZE - 40 - ctx.measureText(osm).width, CARD_SIZE - 16);
}
