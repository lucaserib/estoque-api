import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "../../styles/global.css";
import { Providers } from "./providers";

const sora = localFont({
  variable: "--font-sora",
  display: "swap",
  src: [
    { path: "./fonts/sora-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/sora-700.woff2", weight: "700", style: "normal" },
  ],
});

const inter = localFont({
  variable: "--font-inter",
  display: "swap",
  src: [
    { path: "./fonts/inter-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/inter-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/inter-600.woff2", weight: "600", style: "normal" },
  ],
});

const jetbrainsMono = localFont({
  variable: "--font-jetbrains-mono",
  display: "swap",
  src: [{ path: "./fonts/jetbrains-mono-500.woff2", weight: "500", style: "normal" }],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F6FB" },
    { media: "(prefers-color-scheme: dark)", color: "#0E0C1A" },
  ],
};

export const metadata: Metadata = {
  title: "Skubo — estoque, reposição e lucro para quem vende no Mercado Livre",
  applicationName: "Skubo",
  appleWebApp: { capable: true, title: "Skubo", statusBarStyle: "black-translucent" },
  description:
    "Estoque e reposição para quem vende no Mercado Livre. Controle multi-armazém, kits, pedidos de compra e sincronização com o Mercado Livre.",
  openGraph: {
    title: "Skubo — estoque, reposição e lucro para quem vende no Mercado Livre",
    description:
      "O estoque e o lucro da sua loja, num cubo só.",
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${sora.variable} ${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
