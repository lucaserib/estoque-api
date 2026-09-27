import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
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
