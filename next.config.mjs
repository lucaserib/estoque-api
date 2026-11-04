import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // "Anúncios e vínculos" (/mercado-livre/produtos) é a única tela de vínculo manual —
      // esta não tinha mais nenhum link apontando para ela (conferido com grep).
      { source: "/produtos/vincular", destination: "/mercado-livre/produtos", permanent: false },
      // "Lucro por venda" virou a aba padrão de /financeiro/vendas (Ciclo 13 Fase 8) —
      // a análise de vendas ao vivo do ML (outra fonte) saiu do menu.
      { source: "/mercado-livre/vendas", destination: "/financeiro/vendas", permanent: false },
      // Configurações gerais, ML, Bling, Financeiro e Usuários viraram uma tela só com
      // seções (Ciclo 13 Fase 8) — /configuracoes (OAuth callback do ML) continua existindo.
      { source: "/configuracoes-gerais", destination: "/ajustes", permanent: false },
      // "Lucro por produto" virou a aba "Por produto" de /financeiro/vendas.
      { source: "/financeiro/produtos", destination: "/financeiro/vendas?aba=produto", permanent: false },
    ];
  },
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    unoptimized: false,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.mlstatic.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "http2.mlstatic.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "mlstatic.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.mlstatic.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "mlb-s1-p.mlstatic.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "mlb-s2-p.mlstatic.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "mlb-d3-p.mlstatic.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "mla-s1-p.mlstatic.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "mla-s2-p.mlstatic.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "mco-s1-p.mlstatic.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "mco-s2-p.mlstatic.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "mlc-s1-p.mlstatic.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "mlc-s2-p.mlstatic.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "mlu-s1-p.mlstatic.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "mlu-s2-p.mlstatic.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "mlm-s1-p.mlstatic.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "mlm-s2-p.mlstatic.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "resources.mlstatic.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "bling.com.br",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.bling.com.br",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });
    return config;
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: false,
  telemetry: false,
});
