import path from "path";
import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV !== "production";
const scriptSrc = isDevelopment
  ? "'self' 'unsafe-inline' 'unsafe-eval' https:"
  : "'self' 'unsafe-inline' https:";
const firebaseAuthDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const firebaseAuthFrameSrc = firebaseAuthDomain
  ? ` https://${firebaseAuthDomain}`
  : "";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  {
    key: "Content-Security-Policy",
    value: `default-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'; frame-ancestors 'none'; frame-src 'self' https://vercel.live https://*.vercel.app${firebaseAuthFrameSrc} https://*.firebaseapp.com https://accounts.google.com https://*.google.com https://*.mercadopago.com https://*.mercadopago.com.br https://*.mercadolibre.com; img-src 'self' data: blob: https:; media-src 'self' https:; font-src 'self' data: https:; connect-src 'self' https: wss:${isDevelopment ? " http://127.0.0.1:* http://localhost:*" : ""}; style-src 'self' 'unsafe-inline' https:; script-src ${scriptSrc};${isDevelopment ? "" : " upgrade-insecure-requests;"}`,
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: false,
  reactCompiler: true,
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
