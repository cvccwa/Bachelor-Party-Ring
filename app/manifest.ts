import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bachelor Party Ring Tracker",
    short_name: "Ring Tracker",
    description: "Report wins, curse the Ringbearer, crown a champion.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f0d0a",
    theme_color: "#0f0d0a",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
