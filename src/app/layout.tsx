// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Sora, Inter, JetBrains_Mono } from "next/font/google";
import "../../styles/global.css";
import { Providers } from "./providers";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["500"],
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
