// app/layout.tsx
import type { Metadata } from "next";
import { Inter, Sora, Geist_Mono } from "next/font/google";
import "../../styles/global.css";
import { Providers } from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Estoca — Estoque e reposição para sellers",
  description:
    "Estoque e reposição para quem vende no Mercado Livre. Controle multi-armazém, kits, pedidos de compra e sincronização com o Mercado Livre.",
  openGraph: {
    title: "Estoca — Estoque e reposição para sellers",
    description:
      "Estoque e reposição para quem vende no Mercado Livre.",
    locale: "pt_BR",
    type: "website",
  },
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }],
    shortcut: ["/favicon.ico"],
    apple: [{ url: "/favicon.ico" }],
    other: [
      {
        rel: "icon",
        url: "/favicon.ico",
      },
    ],
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
        className={`${inter.variable} ${sora.variable} ${geistMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
