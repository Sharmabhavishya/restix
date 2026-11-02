import type { MetadataRoute } from "next";

// Lets students "Add to Home Screen": ResTix opens full screen with its own icon, like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ResTix",
    short_name: "ResTix",
    description: "Spare ticket? Sorted. The ticket exchange for verified students.",
    start_url: "/tickets",
    scope: "/",
    display: "standalone",
    background_color: "#f9fafb",
    theme_color: "#b8336a",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
