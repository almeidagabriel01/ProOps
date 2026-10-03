/**
 * Espelho dos modelos do PMOC de `apps/functions/src/shared/pmoc.ts`, para o
 * formulário montar o plano antes de salvar. A regra de quais itens entram em
 * cada visita é só do backend (rotina diária). Paridade em
 * `__tests__/pmoc-parity.test.ts`: mude os dois juntos.
 */

export const PMOC_FREQUENCIES = ["monthly", "quarterly", "semiannual", "annual"] as const;
export type PmocFrequency = (typeof PMOC_FREQUENCIES)[number];

export const PMOC_FREQUENCY_MONTHS: Record<PmocFrequency, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

export const PMOC_FREQUENCY_LABELS: Record<PmocFrequency, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
};

/** O ambiente climatizado entra sempre; os aparelhos, pelos tipos cobertos. */
export const PMOC_CATEGORIES = ["split", "vrf", "window", "environment"] as const;
export type PmocCategory = (typeof PMOC_CATEGORIES)[number];

export const PMOC_CATEGORY_LABELS: Record<PmocCategory, string> = {
  split: "Split",
  vrf: "VRF",
  window: "Janela",
  environment: "Ambiente",
};

export interface PmocItem {
  id: string;
  category: PmocCategory;
  text: string;
  frequency: PmocFrequency;
}

type TemplateItem = Omit<PmocItem, "category">;

export const PMOC_TEMPLATES: Record<PmocCategory, TemplateItem[]> = {
  split: [
    { id: "split_filtros", text: "Limpar ou trocar os filtros de ar", frequency: "monthly" },
    { id: "split_dreno", text: "Verificar a drenagem do condensado (bandeja e mangueira)", frequency: "monthly" },
    { id: "split_ruido", text: "Verificar ruídos e vibrações anormais", frequency: "monthly" },
    { id: "split_controle", text: "Testar o controle remoto e o termostato", frequency: "monthly" },
    { id: "split_serpentina_evaporadora", text: "Limpar a serpentina da evaporadora", frequency: "quarterly" },
    { id: "split_bandeja", text: "Limpar a bandeja de condensado e aplicar bactericida", frequency: "quarterly" },
    { id: "split_serpentina_condensadora", text: "Limpar a serpentina da condensadora", frequency: "quarterly" },
    { id: "split_conexoes", text: "Verificar e reapertar as conexões elétricas", frequency: "quarterly" },
    { id: "split_corrente", text: "Medir a tensão e a corrente do compressor", frequency: "quarterly" },
    { id: "split_isolamento", text: "Verificar o isolamento térmico da tubulação", frequency: "quarterly" },
    { id: "split_higienizacao", text: "Higienizar a evaporadora (turbina e gabinete)", frequency: "semiannual" },
    { id: "split_gas", text: "Verificar a pressão do gás refrigerante e testar vazamentos", frequency: "semiannual" },
    { id: "split_temperaturas", text: "Medir as temperaturas de insuflamento e de retorno", frequency: "semiannual" },
    { id: "split_fixacao", text: "Verificar os suportes e a fixação das unidades", frequency: "semiannual" },
    { id: "split_aterramento", text: "Revisar a alimentação elétrica e o aterramento", frequency: "annual" },
    { id: "split_corrosao", text: "Verificar a corrosão das aletas e do gabinete", frequency: "annual" },
  ],
  vrf: [
    { id: "vrf_filtros", text: "Limpar ou trocar os filtros das unidades internas", frequency: "monthly" },
    { id: "vrf_dreno", text: "Verificar a drenagem do condensado das unidades internas", frequency: "monthly" },
    { id: "vrf_alarmes", text: "Conferir o histórico de alarmes do controle central", frequency: "monthly" },
    { id: "vrf_serpentinas_internas", text: "Limpar as serpentinas das unidades internas", frequency: "quarterly" },
    { id: "vrf_serpentinas_externas", text: "Limpar as serpentinas das unidades externas", frequency: "quarterly" },
    { id: "vrf_pressoes", text: "Registrar as pressões de alta e de baixa", frequency: "quarterly" },
    { id: "vrf_conexoes", text: "Verificar e reapertar as conexões elétricas", frequency: "quarterly" },
    { id: "vrf_corrente", text: "Medir a tensão e a corrente dos compressores", frequency: "quarterly" },
    { id: "vrf_higienizacao", text: "Higienizar as unidades internas", frequency: "semiannual" },
    { id: "vrf_vazamento", text: "Testar vazamentos de gás refrigerante", frequency: "semiannual" },
    { id: "vrf_temperaturas", text: "Medir as temperaturas de insuflamento e de retorno", frequency: "semiannual" },
    { id: "vrf_comunicacao", text: "Verificar a comunicação entre as unidades e o controle", frequency: "annual" },
    { id: "vrf_aterramento", text: "Revisar a alimentação elétrica e o aterramento", frequency: "annual" },
  ],
  window: [
    { id: "janela_filtro", text: "Limpar o filtro de ar", frequency: "monthly" },
    { id: "janela_dreno", text: "Verificar a drenagem do condensado", frequency: "monthly" },
    { id: "janela_serpentinas", text: "Limpar as serpentinas", frequency: "quarterly" },
    { id: "janela_conexoes", text: "Verificar as conexões elétricas", frequency: "quarterly" },
    { id: "janela_higienizacao", text: "Higienizar o aparelho", frequency: "semiannual" },
    { id: "janela_gas", text: "Verificar vazamentos de gás refrigerante", frequency: "semiannual" },
    { id: "janela_vedacao", text: "Verificar a vedação e a fixação na parede", frequency: "annual" },
  ],
  environment: [
    { id: "ambiente_tomada_ar", text: "Verificar a tomada de ar externo e o filtro dela", frequency: "monthly" },
    { id: "ambiente_difusores", text: "Verificar a limpeza dos difusores e das grelhas", frequency: "monthly" },
    { id: "ambiente_renovacao", text: "Medir a renovação de ar e o CO2 do ambiente", frequency: "semiannual" },
    {
      id: "ambiente_qualidade_ar",
      text: "Coletar amostras para a análise da qualidade do ar (RE ANVISA 09/2003)",
      frequency: "semiannual",
    },
    { id: "ambiente_dutos", text: "Inspecionar a limpeza dos dutos, quando houver", frequency: "annual" },
  ],
};

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * O modelo de um tipo de aparelho, pelo nome digitado no cadastro. Cortina de
 * ar não climatiza, então não entra no PMOC; tipo desconhecido segue o split,
 * que é o caso comum.
 */
export function pmocCategoryForType(type: string | null | undefined): PmocCategory | null {
  const value = normalize(type ?? "");
  if (value.includes("cortina")) return null;
  if (value.includes("vrf") || value.includes("vrv")) return "vrf";
  if (value.includes("janela")) return "window";
  return "split";
}

/** Os itens do PMOC para os tipos de aparelho cobertos, com o ambiente sempre. */
export function buildPmocItems(equipmentTypes: ReadonlyArray<string | null | undefined>): PmocItem[] {
  const categories = new Set<PmocCategory>(["environment"]);
  for (const type of equipmentTypes) {
    const category = pmocCategoryForType(type);
    if (category) categories.add(category);
  }
  if (categories.size === 1) categories.add("split");
  return PMOC_CATEGORIES.filter((c) => categories.has(c)).flatMap((category) =>
    PMOC_TEMPLATES[category].map((item) => ({ ...item, category })),
  );
}
