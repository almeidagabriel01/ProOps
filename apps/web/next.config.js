/**
 * ATENÇÃO: o Next resolve o config nesta ordem —
 *   ['next.config.js', 'next.config.mjs', 'next.config.ts']
 * (node_modules/next/dist/shared/lib/constants.js). Como este arquivo existe,
 * ele VENCE e o `next.config.ts` ao lado é ignorado por inteiro.
 *
 * Development config: allow 127.0.0.1 as dev origin so Playwright can use that host.
 */
module.exports = {
  allowedDevOrigins: ["127.0.0.1"],
  // O servidor de teste do Playwright compila num diretório próprio para não
  // brigar com um `npm run dev` aberto: o Next 16 grava um lock em
  // <distDir>/lock e recusa um segundo dev server que use o mesmo distDir.
  // Sem a variável definida nada muda — tudo segue em .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};
