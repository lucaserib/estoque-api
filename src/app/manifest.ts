import type { MetadataRoute } from "next";

/** Torna o app instalável ("Adicionar à tela de início") no celular e no computador. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Skubo",
    short_name: "Skubo",
    description: "Estoque, reposição e resultado de quem vende no Mercado Livre.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0E0C1A",
    theme_color: "#5B3DF5",
    lang: "pt-BR",
    icons: [
      { src: "/brand/skubo/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/skubo/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/skubo/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
