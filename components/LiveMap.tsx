"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import { GeolocateControl, Map as MapLibre, Popup, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { Vehicle } from "@/lib/gtfs";
import { fetchApi } from "@/lib/hooks";

// Free vector tiles, no key needed: https://openfreemap.org
const STYLE = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};
const KARLSTAD: [number, number] = [13.503, 59.381];

// Served from public/ (see scripts/copy-maplibre-worker.mjs).
setWorkerUrl("/maplibre-gl-worker.mjs");
const REFRESH_MS = 10000;

type Status = { count: number; updatedAt: number } | { error: string } | null;

function toGeoJson(vehicles: Vehicle[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: vehicles.map((v) => ({
      type: "Feature",
      id: v.id,
      geometry: { type: "Point", coordinates: [v.lon, v.lat] },
      properties: { line: v.line, headsign: v.headsign ?? "", mode: v.mode, timestamp: v.timestamp },
    })),
  };
}

function popupHtml(p: { line: string; headsign: string; timestamp: number }) {
  const seconds = Math.max(0, Math.round(Date.now() / 1000 - p.timestamp));
  const div = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = p.headsign ? `Linje ${p.line} mot ${p.headsign}` : `Linje ${p.line}`;
  const age = document.createElement("div");
  age.textContent = `Position för ${seconds} s sedan`;
  div.append(title, age);
  return div;
}

export function LiveMap() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [line, setLine] = useState("");

  useEffect(() => {
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const map = new MapLibre({
      container: container.current!,
      style: dark ? STYLE.dark : STYLE.light,
      center: KARLSTAD,
      zoom: 12.5,
      attributionControl: { compact: true, customAttribution: "Bussdata från Trafiklab.se" },
    });
    mapRef.current = map;
    map.addControl(
      new GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }),
      "top-right",
    );

    let timer: ReturnType<typeof setInterval> | undefined;
    const load = () => {
      if (document.visibilityState !== "visible") return;
      fetchApi<Vehicle[]>("/api/vehicles")
        .then((vehicles) => {
          (map.getSource("vehicles") as GeoJSONSource | undefined)?.setData(toGeoJson(vehicles));
          setStatus({ count: vehicles.length, updatedAt: Date.now() });
        })
        .catch((e: Error) => setStatus({ error: e.message }));
    };

    map.on("load", () => {
      map.addSource("vehicles", { type: "geojson", data: toGeoJson([]) });
      // Buses are yellow like Värmlandstrafik's own; trains and the rest are dark.
      map.addLayer({
        id: "vehicle-dot",
        type: "circle",
        source: "vehicles",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 6, 13, 13],
          "circle-color": ["match", ["get", "mode"], "BUS", "#f9b000", "#18181b"],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
      map.addLayer({
        id: "vehicle-line",
        type: "symbol",
        source: "vehicles",
        minzoom: 11,
        layout: {
          "text-field": ["get", "line"],
          "text-font": ["Noto Sans Bold"],
          "text-size": 11,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: { "text-color": ["match", ["get", "mode"], "BUS", "#18181b", "#ffffff"] },
      });
      load();
      timer = setInterval(load, REFRESH_MS);
    });

    map.on("click", "vehicle-dot", (e) => {
      const feature = e.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const [lon, lat] = feature.geometry.coordinates;
      new Popup({ closeButton: false, offset: 14 })
        .setLngLat([lon, lat])
        .setDOMContent(popupHtml(feature.properties as { line: string; headsign: string; timestamp: number }))
        .addTo(map);
    });
    map.on("mouseenter", "vehicle-dot", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "vehicle-dot", () => (map.getCanvas().style.cursor = ""));
    document.addEventListener("visibilitychange", load);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Typing a line number shows only that line's vehicles.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const filter = line.trim() ? (["==", ["get", "line"], line.trim().toUpperCase()] as const) : null;
      for (const id of ["vehicle-dot", "vehicle-line"]) if (map.getLayer(id)) map.setFilter(id, filter as never);
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [line]);

  const updated =
    status && "updatedAt" in status
      ? new Date(status.updatedAt).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      : null;

  return (
    <div className="fixed inset-x-0 top-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom)+1px)]">
      {/* h-full, not inset-0: MapLibre's CSS makes this element position: relative. */}
      <div ref={container} className="h-full w-full" />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <label className="pointer-events-auto flex h-11 w-44 items-center gap-2 rounded-xl bg-white/95 px-3 shadow-md shadow-zinc-900/10 ring-1 ring-zinc-900/10 backdrop-blur focus-within:ring-2 focus-within:ring-brand dark:bg-zinc-900/95 dark:ring-white/10">
          <MagnifyingGlassIcon weight="bold" className="size-4 shrink-0 text-zinc-400" aria-hidden />
          <span className="sr-only">Visa bara linje</span>
          <input
            inputMode="text"
            autoCapitalize="characters"
            placeholder="Linje"
            value={line}
            onChange={(e) => setLine(e.target.value)}
            className="w-full min-w-0 bg-transparent text-base outline-none placeholder:text-zinc-500"
          />
          {line && (
            <button type="button" aria-label="Visa alla linjer" onClick={() => setLine("")} className="text-zinc-400">
              <XIcon weight="bold" className="size-4" />
            </button>
          )}
        </label>
        {status && (
          <p
            role="status"
            className={`pointer-events-auto w-fit max-w-full rounded-lg px-2.5 py-1 text-xs font-medium shadow-sm ${
              "error" in status
                ? "bg-red-600 text-white"
                : "bg-white/95 text-zinc-600 ring-1 ring-zinc-900/10 dark:bg-zinc-900/95 dark:text-zinc-300 dark:ring-white/10"
            }`}
          >
            {"error" in status ? status.error : `${status.count} fordon i trafik · ${updated}`}
          </p>
        )}
      </div>
    </div>
  );
}
