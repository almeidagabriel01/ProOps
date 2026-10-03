import * as fs from "fs";
import * as path from "path";
import { test, type Page } from "@playwright/test";
import sharp from "sharp";

import { LoginPage } from "../e2e/pages/login.page";
import { interceptFirebaseRequests } from "../e2e/fixtures/auth.fixture";
import { EMPRESAS, SENHA, URL_FUNCTIONS, type EmpresaDeCaptura } from "./ambiente";
import { gerarVariantes } from "./variantes";

/**
 * O roteiro das capturas. Cada entrada é uma tela de verdade do ERP, aberta
 * como a dona de uma empresa de exemplo, e salva em WebP em
 * `apps/web/public/capturas/`. Rodar um pedaço: `--grep "financeiro"`.
 */

const SAIDA = path.resolve(__dirname, "../../apps/web/public/capturas");
const DESKTOP = { width: 1440, height: 900 };
const CELULAR = { width: 390, height: 844 };

type Tela = "desktop" | "celular";

interface Captura {
  /** Caminho do arquivo, sem extensão, dentro de `public/capturas/`. */
  arquivo: string;
  empresa: EmpresaDeCaptura;
  tela: Tela;
  /** A rota, ou uma função que a monta (para os links do cliente, que pedem token). */
  rota: string | ((ctx: { token: () => Promise<string> }) => Promise<string>);
  /** O que precisa estar na tela antes do print. */
  esperar?: string;
  /** Um passo antes do print (abrir um painel, rolar até um bloco). */
  preparar?: (page: Page) => Promise<void>;
}

const automacao = EMPRESAS.automacao_residencial;

/** Um token do Auth emulado para chamar a API como a dona da empresa. */
async function tokenDa(empresa: EmpresaDeCaptura): Promise<string> {
  const r = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: empresa.dono.email, password: SENHA, returnSecureToken: true }),
    },
  );
  const corpo = (await r.json()) as { idToken?: string };
  if (!corpo.idToken) throw new Error(`Sem token para ${empresa.dono.email}`);
  return corpo.idToken;
}

async function api<T>(empresa: EmpresaDeCaptura, metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const r = await fetch(`${URL_FUNCTIONS}${caminho}`, {
    method: metodo,
    headers: { "content-type": "application/json", authorization: `Bearer ${await tokenDa(empresa)}` },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${metodo} ${caminho}: ${r.status} ${texto.slice(0, 200)}`);
  return JSON.parse(texto) as T;
}

/** Acha o token dentro da resposta de um endpoint de link, seja qual for o formato. */
function tokenDaResposta(resposta: unknown): string {
  const texto = JSON.stringify(resposta);
  const url = texto.match(/\/share\/(?:[a-z]+\/)?([A-Za-z0-9_-]{12,})/);
  if (url) return url[1];
  const campo = texto.match(/"token"\s*:\s*"([A-Za-z0-9_-]{12,})"/);
  if (campo) return campo[1];
  throw new Error(`Resposta sem token: ${texto.slice(0, 200)}`);
}

const ROTEIRO: Captura[] = [
  // ── As funcionalidades, na empresa de automação ─────────────────────────────
  { arquivo: "funcionalidades/crm", empresa: automacao, tela: "desktop", rota: "/crm" },
  { arquivo: "funcionalidades/contatos", empresa: automacao, tela: "desktop", rota: "/contacts/demo_client_ana" },
  { arquivo: "funcionalidades/catalogo", empresa: automacao, tela: "desktop", rota: "/products" },
  { arquivo: "funcionalidades/propostas", empresa: automacao, tela: "desktop", rota: "/proposals" },
  { arquivo: "funcionalidades/pdf-da-proposta", empresa: automacao, tela: "desktop", rota: "/proposals/demo_prop_1/edit-pdf" },
  { arquivo: "funcionalidades/obras", empresa: automacao, tela: "desktop", rota: "/projects/proposal_demo_prop_1" },
  {
    arquivo: "funcionalidades/assistencia-tecnica",
    empresa: EMPRESAS.climatizacao,
    tela: "desktop",
    // A OS concluída e assinada da demonstração de climatização.
    rota: "/service-orders/demo_clim_os_1",
  },
  { arquivo: "funcionalidades/agenda", empresa: automacao, tela: "desktop", rota: "/calendar" },
  {
    arquivo: "funcionalidades/financeiro",
    empresa: automacao,
    tela: "desktop",
    rota: "/transactions",
    // A aba Agrupados mostra cada venda com as parcelas, e abre sem seleção
    // (a lista por vencimento abre com tudo marcado, para os cards somarem).
    preparar: async (page) => {
      await page.getByRole("button", { name: "Agrupados" }).first().click();
    },
  },
  { arquivo: "funcionalidades/fluxo-de-caixa-e-dre", empresa: automacao, tela: "desktop", rota: "/cash-flow" },
  { arquivo: "funcionalidades/notas-fiscais", empresa: automacao, tela: "desktop", rota: "/invoices" },
  { arquivo: "funcionalidades/equipe-e-seguranca", empresa: automacao, tela: "desktop", rota: "/settings/team" },
  {
    arquivo: "funcionalidades/lia",
    empresa: automacao,
    tela: "desktop",
    rota: "/dashboard",
    // O emulador responde com o provedor simulado (AI_PROVIDER=mock).
    preparar: async (page) => {
      await page.getByRole("button", { name: "Abrir Lia" }).click();
      const campo = page.getByLabel("Mensagem para Lia");
      await campo.fill("Quanto tenho para receber este mês?");
      await campo.press("Enter");
      await page.waitForTimeout(6000);
    },
  },
  { arquivo: "funcionalidades/no-dia-a-dia", empresa: automacao, tela: "celular", rota: "/dashboard" },
  {
    arquivo: "funcionalidades/aceite-online",
    empresa: automacao,
    tela: "celular",
    rota: async () => `/share/${tokenDaResposta(await api(automacao, "POST", "/v1/proposals/demo_prop_2/share-link", {}))}`,
  },
  {
    arquivo: "funcionalidades/pos-venda",
    empresa: automacao,
    tela: "celular",
    rota: async () =>
      `/share/portal/${tokenDaResposta(await api(automacao, "POST", "/v1/client-portal/demo_client_ana/link", {}))}`,
  },
  // ── As landings de nicho: a proposta, a obra e o catálogo de cada um ───────
  ...Object.values(EMPRESAS).flatMap((empresa): Captura[] => {
    const prefixo = empresa.niche === "automacao_residencial" ? "demo" : `demo_${prefixoDoNicho(empresa)}`;
    return [
      { arquivo: `nichos/${empresa.niche}/proposta`, empresa, tela: "desktop", rota: `/proposals/${prefixo}_prop_1/view` },
      { arquivo: `nichos/${empresa.niche}/obra`, empresa, tela: "desktop", rota: `/projects/proposal_${prefixo}_prop_1` },
      { arquivo: `nichos/${empresa.niche}/produtos`, empresa, tela: "desktop", rota: "/products" },
    ];
  }),
];

function prefixoDoNicho(empresa: EmpresaDeCaptura): string {
  return { cortinas: "cort", seguranca_eletronica: "seg", vidracaria_esquadrias: "vid", marcenaria: "marc", climatizacao: "clim" }[
    empresa.niche as "cortinas"
  ];
}

async function entrar(page: Page, empresa: EmpresaDeCaptura) {
  await interceptFirebaseRequests(page);
  const login = new LoginPage(page);
  await login.goto();
  await login.login(empresa.dono.email, SENHA);
  await page.waitForURL(/dashboard/, { timeout: 60_000 });
}

/** O selo do servidor de desenvolvimento e os avisos passageiros não entram no print. */
const CSS_DO_PRINT = `
  nextjs-portal, [data-nextjs-toast], [data-sonner-toaster], [data-sileo-toaster] { display: none !important; }
  *, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; caret-color: transparent !important; }
`;

async function salvar(page: Page, captura: Captura) {
  const bruto = await page.screenshot({ type: "png" });
  const largura = captura.tela === "desktop" ? 1600 : 780;
  const destino = path.join(SAIDA, `${captura.arquivo}.webp`);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  await sharp(bruto).resize({ width: largura }).webp({ quality: 82 }).toFile(destino);
  const { height } = await sharp(destino).metadata();
  await gerarVariantes({
    src: `/capturas/${captura.arquivo}.webp`,
    formato: captura.tela,
    largura,
    altura: height ?? 0,
    alt: "",
  });
  console.log(`[capturas] ${path.relative(SAIDA, destino)}`);
}

for (const captura of ROTEIRO) {
  test(captura.arquivo, async ({ browser }) => {
    const contexto = await browser.newContext({
      viewport: captura.tela === "desktop" ? DESKTOP : CELULAR,
      deviceScaleFactor: 2,
      isMobile: captura.tela === "celular",
      hasTouch: captura.tela === "celular",
      locale: "pt-BR",
      colorScheme: "light",
    });
    await contexto.addInitScript(() => {
      localStorage.setItem("proops_cookie_consent", "dismissed");
      localStorage.setItem("theme", "light");
    });
    const page = await contexto.newPage();
    const rota = typeof captura.rota === "string" ? captura.rota : await captura.rota({ token: () => tokenDa(captura.empresa) });
    // Os links do cliente abrem sem login; o resto entra como a dona da empresa.
    if (!rota.startsWith("/share/")) await entrar(page, captura.empresa);
    await page.goto(rota);
    // O ERP mantém ouvintes em tempo real abertos: a rede nunca fica ociosa de vez.
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    if (captura.esperar) await page.getByText(captura.esperar).first().waitFor({ timeout: 30_000 });
    await page.addStyleTag({ content: CSS_DO_PRINT });
    await captura.preparar?.(page);
    // Os skeletons somem, as imagens carregam, os gráficos terminam de desenhar.
    await page.waitForTimeout(2500);
    await salvar(page, captura);
    await contexto.close();
  });
}
