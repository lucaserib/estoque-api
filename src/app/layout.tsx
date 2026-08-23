// app/layout.tsx
import type { Metadata } from "next";
import { Inter, Barlow_Condensed, Geist_Mono } from "next/font/google";
import "../../styles/global.css";
import { Providers } from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Leap Store — Estoque e reposição para sellers",
  description:
    "Estoque e reposição para quem vende no Mercado Livre. Controle multi-armazém, kits, pedidos de compra e sincronização com o Mercado Livre.",
  openGraph: {
    title: "Leap Store — Estoque e reposição para sellers",
    description:
      "Estoque e reposição para quem vende no Mercado Livre.",
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
        className={`${inter.variable} ${barlowCondensed.variable} ${geistMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
