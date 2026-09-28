import { ADDON_DEFINITIONS, applyAddonsToFeatures } from "@/lib/plans/addon-definitions";
import { DEFAULT_PLANS } from "@/lib/plans/default-plans";
import type { AddonDefinition, AddonType, PlanFeatures, PlanTier, UserPlan } from "@/types";

import type { ChaveNumerica, Requisito, UnidadeDoLimite } from "./tipos";

type PlanoBase = Omit<UserPlan, "id">;

export interface SeloDoPlano {
  /** O menor plano que já traz o recurso; `null` se nenhum traz. */
  aPartirDe: PlanTier | null;
  /** Planos abaixo de `aPartirDe` onde o recurso é comprável como add-on. */
  addonEm: { tier: PlanTier; addons: AddonType[] }[];
  /** "Todos os planos", "A partir do Profissional", "Enterprise". */
  rotulo: string;
  /** "Add-on no Starter e no Profissional", ou `null`. */
  rotuloAddon: string | null;
}

function ordenar(planos: readonly PlanoBase[]): PlanoBase[] {
  return [...planos].sort((a, b) => a.order - b.order);
}

function atende(plano: PlanoBase, features: PlanFeatures, requisito: Requisito, ordenados: readonly PlanoBase[]): boolean {
  if (requisito.tipo === "livre") return true;
  if (requisito.tipo === "tier") {
    const minimo = ordenados.find((p) => p.tier === requisito.minimo);
    return !!minimo && plano.order >= minimo.order;
  }
  const recursos = requisito.recursos ?? [];
  const limites = requisito.limites ?? [];
  return recursos.every((k) => features[k]) && limites.every((k) => features[k] !== 0);
}

/**
 * Todos os subconjuntos dos add-ons disponíveis num tier, do menor para o
 * maior, respeitando `requiresAddons` (o pagamento online no Starter precisa
 * do financeiro junto). São no máximo seis add-ons: 64 combinações.
 */
function combinacoesDeAddons(tier: PlanTier, addons: readonly AddonDefinition[]): AddonType[][] {
  const disponiveis = addons.filter((a) => a.availableForTiers.includes(tier));
  const combinacoes: AddonType[][] = [];
  for (let mascara = 1; mascara < 1 << disponiveis.length; mascara++) {
    const escolhidos = disponiveis.filter((_, i) => mascara & (1 << i));
    const ids = new Set(escolhidos.map((a) => a.id));
    const valida = escolhidos.every((a) =>
      (a.requiresAddons?.[tier] ?? []).every((req) => ids.has(req)),
    );
    if (valida) combinacoes.push(escolhidos.map((a) => a.id));
  }
  return combinacoes.sort((a, b) => a.length - b.length);
}

function juntar(partes: readonly string[]): string {
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
}

/**
 * O selo que o visitante lê, derivado dos mesmos dados que o ERP usa para
 * bloquear: `DEFAULT_PLANS` (espelho de `PLAN_CATALOG`, com paridade testada)
 * e as definições de add-on. Os parâmetros existem para o teste de paridade
 * injetar o catálogo do backend; a página usa os padrões.
 */
export function seloDoPlano(
  requisito: Requisito,
  planos: readonly PlanoBase[] = DEFAULT_PLANS,
  addons: readonly AddonDefinition[] = ADDON_DEFINITIONS,
  aplicar: (base: PlanFeatures, compras: readonly AddonType[]) => PlanFeatures = applyAddonsToFeatures,
): SeloDoPlano {
  const ordenados = ordenar(planos);
  const indice = ordenados.findIndex((p) => atende(p, p.features, requisito, ordenados));
  const aPartirDe = indice === -1 ? null : ordenados[indice];

  const abaixo = indice === -1 ? ordenados : ordenados.slice(0, indice);
  const addonEm = abaixo.flatMap((plano) => {
    const combinacao = combinacoesDeAddons(plano.tier, addons).find((c) =>
      atende(plano, aplicar(plano.features, c), requisito, ordenados),
    );
    return combinacao ? [{ tier: plano.tier, addons: combinacao }] : [];
  });

  let rotulo: string;
  if (!aPartirDe) rotulo = "Só como add-on";
  else if (indice === 0) rotulo = "Todos os planos";
  else if (indice === ordenados.length - 1) rotulo = aPartirDe.name;
  else rotulo = `A partir do ${aPartirDe.name}`;

  const nomes = addonEm.map(({ tier }) => `no ${ordenados.find((p) => p.tier === tier)?.name ?? tier}`);
  const rotuloAddon = nomes.length ? `Add-on ${juntar(nomes)}` : null;

  return { aPartirDe: aPartirDe?.tier ?? null, addonEm, rotulo, rotuloAddon };
}

/**
 * A escada de um limite por plano: "5 planilhas no Starter, 50 no Profissional
 * e ilimitadas no Enterprise". Plano com o limite em zero fica de fora (é o
 * "não tem"), e o valor sai de `DEFAULT_PLANS`.
 */
export function escadaDoLimite(
  chave: ChaveNumerica,
  unidade: UnidadeDoLimite,
  planos: readonly PlanoBase[] = DEFAULT_PLANS,
): string {
  const degraus = ordenar(planos)
    .filter((p) => p.features[chave] !== 0)
    .map((p, i) => {
      const valor = p.features[chave];
      const nome = `no ${p.name}`;
      if (valor === -1) return `${unidade.ilimitado} ${nome}`;
      const numero = valor.toLocaleString("pt-BR");
      const substantivo = i === 0 ? ` ${valor === 1 ? unidade.um : unidade.varios}` : "";
      return `${numero}${substantivo} ${nome}`;
    });
  const texto = juntar(degraus);
  return unidade.sufixo ? `${texto}, ${unidade.sufixo}` : texto;
}
