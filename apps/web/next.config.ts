import path from "path";
import type { NextConfig } from "next";
import { hostnameDe } from "./src/lib/site/surfaces";

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
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  {
    key: "Content-Security-Policy",
    value: `default-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'; frame-ancestors 'none'; frame-src 'self' https://vercel.live https://*.vercel.app${firebaseAuthFrameSrc} https://*.firebaseapp.com https://accounts.google.com https://*.google.com https://*.mercadopago.com https://*.mercadopago.com.br https://*.mercadolibre.com; img-src 'self' data: blob: https:; media-src 'self' https:; font-src 'self' data: https:; connect-src 'self' https: wss:${isDevelopment ? " http://127.0.0.1:* http://localhost:*" : ""}; style-src 'self' 'unsafe-inline' https:; script-src ${scriptSrc};${isDevelopment ? "" : " upgrade-insecure-requests;"}`,
  },
];

const nextConfig: NextConfig = {
  // Playwright sobe o dev server em 127.0.0.1; sem isto o Next 16 recusa a
  // origem. Vivia num `next.config.js` separado — que, por ser o primeiro da
  // lista de CONFIG_FILES, silenciosamente anulava este arquivo inteiro.
  // `*.localhost` resolves to 127.0.0.1 in Chromium with no hosts-file edit,
  // which is how the three host surfaces (apex / erp / app) are exercised in
  // dev and in Playwright. Without them listed, Next 16 rejects the origin.
  // Derivados de SITE_URLS: renomear um subdominio nao pode deixar para tras um
  // `*.localhost` desatualizado aqui, porque a falha e o Next recusando a
  // origem em dev, sem relacao aparente com a renomeacao.
  allowedDevOrigins: [
    "127.0.0.1",
    ...(["erp", "app"] as const).map(
      (surface) => `${hostnameDe(surface).split(".")[0]}.localhost`,
    ),
    "institucional.localhost",
  ],
  // O servidor de teste do Playwright compila num diretório próprio para não
  // brigar com um `npm run dev` aberto na mesma máquina: os dois usariam
  // apps/web/.next e o config do Playwright apaga esse diretório ao subir.
  // Sem a variável definida nada muda — build, dev e deploy seguem em .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  // version-skew detection: on client/server deployment mismatch Next falls
  // back to a hard navigation instead of importing stale chunks (no-op locally)
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
  reactStrictMode: false,
  reactCompiler: true,
  // NAO reintroduzir `output: "standalone"`.
  //
  // Nada neste repositorio consome `.next/standalone`: nao ha Dockerfile, o CI
  // e o Lighthouse sobem `next start` (que le `.next/` direto) e o frontend e
  // publicado pela Vercel a partir do git, sem workflow. A Vercel monta a
  // propria saida serverless e ignora a standalone.
  //
  // A partir do Next 16.3 essa opcao QUEBRA o deploy: o `next build` termina,
  // e o empacotamento da Vercel morre em onBuildComplete com
  // `ENOENT ... .next/next-server.js.nft.json`. O build local passa, o da
  // Vercel nao. Regressao conhecida do 16.3 (16.2.6 ainda funcionava).
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
