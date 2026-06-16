import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "麻雀成績管理",
    short_name: "麻雀",
    description: "麻雀成績管理アプリ",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f4f6",
    theme_color: "#7e22ce",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}