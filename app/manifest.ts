import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Trafik",
    short_name: "Trafik",
    description: "Avgångar och reseplanerare för Värmlandstrafik.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f4f5",
    theme_color: "#f4f4f5",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" }],
  };
}
