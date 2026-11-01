import type { MetadataRoute } from "next";

/** Torna o app instalável ("Adicionar à tela de início") no celular e no computador. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Leap Stock",
    short_name: "Leap Stock",
    description: "Estoque, reposição e resultado de quem vende no Mercado Livre.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0F1316",
    theme_color: "#0F1316",
    lang: "pt-BR",
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/pwa/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
