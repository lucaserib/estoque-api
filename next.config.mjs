/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    unoptimized: false,
    remotePatterns: [
      // Mercado Livre domains - principais
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
      // Subdomínios por país - Brasil
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
      // Subdomínios por país - Argentina
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
      // Subdomínios por país - Colômbia
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
      // Subdomínios por país - Chile
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
      // Subdomínios por país - Uruguai
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
      // Subdomínios por país - México
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
      // CDN adicional
      {
        protocol: "https",
        hostname: "resources.mlstatic.com",
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

export default nextConfig;
