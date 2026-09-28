/**
 * O ambiente das capturas do ERP: emuladores próprios, um servidor Next
 * próprio e uma empresa de exemplo por nicho, montada a partir das
 * demonstrações de `apps/functions/src/scripts/demo/datasets/`.
 *
 * Tudo local e fictício. As senhas abaixo só existem no Auth EMULADO, no
 * projeto `demo-proops-test`, e nunca chegam a um projeto de verdade.
 *
 * As portas fogem das do dia a dia de propósito: o `npm run dev:backend`
 * ocupa a 5001 (e a 4000, 4400 e 4500), então o Functions das capturas fica
 * na 5011 e o hub na 4410. Firestore, Auth e Storage ficam nas portas padrão
 * porque o front as tem fixas (`lib/firebase.ts`).
 */
import type { TenantNicheId } from "../../apps/web/src/lib/niches/registry";

export const PROJETO = "demo-proops-test";
export const PORTA_FUNCTIONS = 5011;
export const PORTA_WEB = 3005;
export const URL_FUNCTIONS = `http://127.0.0.1:${PORTA_FUNCTIONS}/${PROJETO}/southamerica-east1/api`;
export const URL_WEB = `http://localhost:${PORTA_WEB}`;
export const PORTAS_DOS_EMULADORES = [PORTA_FUNCTIONS, 8080, 9099, 9199, 4410, 4510];

export const SENHA = "Capturas#2026";

export interface EmpresaDeCaptura {
  niche: TenantNicheId;
  /** O tenant da demonstração do nicho, que vira uma empresa pagante no emulador. */
  tenantId: string;
  nome: string;
  dono: { uid: string; email: string; nome: string };
}

export const EMPRESAS: Record<TenantNicheId, EmpresaDeCaptura> = {
  automacao_residencial: {
    niche: "automacao_residencial",
    tenantId: "demo",
    nome: "Lumen Automação",
    dono: { uid: "capturas-automacao", email: "dono.automacao@capturas.test", nome: "Carla Mendes" },
  },
  cortinas: {
    niche: "cortinas",
    tenantId: "demo-cortinas",
    nome: "Ateliê Persianas",
    dono: { uid: "capturas-cortinas", email: "dono.cortinas@capturas.test", nome: "Carla Mendes" },
  },
  seguranca_eletronica: {
    niche: "seguranca_eletronica",
    tenantId: "demo-seguranca",
    nome: "Vigia Segurança",
    dono: { uid: "capturas-seguranca", email: "dono.seguranca@capturas.test", nome: "Carla Mendes" },
  },
  vidracaria_esquadrias: {
    niche: "vidracaria_esquadrias",
    tenantId: "demo-vidracaria",
    nome: "Cristal Vidros",
    dono: { uid: "capturas-vidracaria", email: "dono.vidracaria@capturas.test", nome: "Carla Mendes" },
  },
  marcenaria: {
    niche: "marcenaria",
    tenantId: "demo-marcenaria",
    nome: "Nogueira Planejados",
    dono: { uid: "capturas-marcenaria", email: "dono.marcenaria@capturas.test", nome: "Carla Mendes" },
  },
};

/** A equipe que aparece na tela de Equipe, só na empresa de automação. */
export const MEMBROS = [
  { uid: "capturas-membro-tecnico", email: "diego@capturas.test", nome: "Diego Lima" },
  { uid: "capturas-membro-vendas", email: "renata@capturas.test", nome: "Renata Alves" },
];
