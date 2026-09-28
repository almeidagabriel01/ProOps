/**
 * Espelho no front do registro de nichos do backend
 * (`apps/functions/src/shared/niches.ts`), com os campos que o front também usa,
 * mais o que só o front conhece: o rótulo e o caminho da landing.
 *
 * Nicho novo = uma entrada aqui e uma lá. O id é a chave; `TenantNiche` e
 * `TENANT_NICHES` saem dela. A paridade dos dois registros e do
 * `firebase/firestore.rules` é garantida por
 * `src/__tests__/niche-registry-parity.test.ts`.
 *
 * Arquivo puro, sem import: é lido pelo proxy (rotas públicas), pelo sitemap e
 * por toda página. Texto de landing e configuração de tela ficam em
 * `lib/niches/definitions/<id>/`.
 */

export interface VisitType {
  id: string;
  label: string;
  durationMin: number;
}

export interface StageTemplate {
  name: string;
  checklist: readonly string[];
}

export interface WebNicheEntry {
  /** Nome do nicho na interface. */
  label: string;
  /** Caminho da landing do nicho no ERP. É SEO: não muda depois de publicado. */
  landingPath: `/${string}`;
  demoTenantId: string;
  productImageLimit: number;
  defaultVisitType: VisitType;
  /**
   * Etapas com que a obra nasce, com o checklist de cada uma. Espelho do
   * backend: as landings mostram as etapas REAIS do nicho, nunca uma lista
   * escrita à parte.
   */
  stageTemplate: readonly StageTemplate[];
}

export const NICHE_REGISTRY = {
  automacao_residencial: {
    label: "Automação Residencial",
    landingPath: "/automacao-residencial",
    demoTenantId: "demo",
    productImageLimit: 1,
    defaultVisitType: { id: "visita_tecnica", label: "Visita técnica", durationMin: 60 },
    stageTemplate: [
      { name: "Infraestrutura", checklist: ["Conferir tubulação e caixas", "Passar cabeamento", "Montar o quadro/rack"] },
      { name: "Instalação", checklist: ["Instalar os equipamentos", "Ligar e identificar os circuitos"] },
      { name: "Configuração", checklist: ["Programar cenas e automações", "Configurar o aplicativo", "Testar ambiente por ambiente"] },
      { name: "Entrega", checklist: ["Treinar o cliente", "Limpar e organizar a obra", "Registrar fotos finais"] },
    ],
  },
  cortinas: {
    label: "Persianas e Toldos",
    landingPath: "/decoracao",
    demoTenantId: "demo-cortinas",
    productImageLimit: 3,
    defaultVisitType: { id: "medicao", label: "Medição", durationMin: 60 },
    stageTemplate: [
      { name: "Medição", checklist: ["Medir vãos e altura", "Conferir a alvenaria e o ponto elétrico", "Confirmar tecido, lona e acionamento"] },
      { name: "Produção", checklist: ["Enviar pedido", "Conferir peças recebidas"] },
      { name: "Instalação", checklist: ["Fixar trilhos, suportes e braços", "Instalar persianas, cortinas e toldos", "Regular e testar o acionamento"] },
      { name: "Entrega", checklist: ["Orientar o cliente", "Registrar fotos finais"] },
    ],
  },
  seguranca_eletronica: {
    label: "Segurança Eletrônica",
    landingPath: "/seguranca-eletronica",
    demoTenantId: "demo-seguranca",
    productImageLimit: 1,
    defaultVisitType: { id: "vistoria_tecnica", label: "Vistoria técnica", durationMin: 60 },
    stageTemplate: [
      { name: "Levantamento", checklist: ["Mapear os pontos de câmera e sensores", "Definir a rota dos cabos e a energia", "Confirmar o local do gravador e da central"] },
      { name: "Infraestrutura", checklist: ["Passar tubulação e cabeamento", "Montar o rack ou a caixa do gravador"] },
      { name: "Instalação", checklist: ["Instalar câmeras, sensores e central", "Instalar fechaduras, leitores e cerca, se houver"] },
      { name: "Configuração", checklist: ["Configurar gravação e acesso remoto no aplicativo", "Cadastrar zonas, usuários e biometrias", "Testar cada ponto"] },
      { name: "Entrega", checklist: ["Treinar o cliente", "Entregar senhas e o termo de entrega", "Registrar fotos finais"] },
    ],
  },
  vidracaria_esquadrias: {
    label: "Vidraçaria e Esquadrias",
    landingPath: "/vidracaria-esquadrias",
    demoTenantId: "demo-vidracaria",
    productImageLimit: 3,
    defaultVisitType: { id: "medicao", label: "Medição", durationMin: 60 },
    stageTemplate: [
      { name: "Medição", checklist: ["Medir os vãos no local", "Conferir prumo, nível e esquadro", "Confirmar vidro, perfil e acabamento"] },
      { name: "Produção", checklist: ["Enviar vidros para a têmpera", "Cortar e montar os perfis", "Conferir as peças recebidas"] },
      { name: "Instalação", checklist: ["Instalar esquadrias e vidros", "Vedar e regular portas e janelas"] },
      { name: "Entrega", checklist: ["Limpar os vidros", "Orientar o cliente", "Registrar fotos finais"] },
    ],
  },
  marcenaria: {
    label: "Marcenaria e Móveis Planejados",
    landingPath: "/marcenaria",
    demoTenantId: "demo-marcenaria",
    productImageLimit: 3,
    defaultVisitType: { id: "medicao", label: "Medição", durationMin: 60 },
    stageTemplate: [
      { name: "Medição", checklist: ["Medir paredes, pé-direito e vãos", "Marcar pontos elétricos e hidráulicos", "Fotografar o ambiente"] },
      { name: "Projeto", checklist: ["Desenhar o projeto do ambiente", "Aprovar projeto, cores e acabamentos com o cliente"] },
      { name: "Produção", checklist: ["Cortar e fitar as chapas", "Furar e pré-montar os módulos", "Separar ferragens e acessórios"] },
      { name: "Montagem", checklist: ["Montar e fixar os módulos", "Instalar ferragens, puxadores e iluminação", "Regular portas e gavetas"] },
      { name: "Entrega", checklist: ["Limpar e vistoriar com o cliente", "Registrar fotos finais"] },
    ],
  },
} satisfies Record<string, WebNicheEntry>;

export type TenantNicheId = keyof typeof NICHE_REGISTRY;

export const TENANT_NICHES = Object.keys(NICHE_REGISTRY) as TenantNicheId[];

export function isTenantNiche(value: unknown): value is TenantNicheId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(NICHE_REGISTRY, value);
}

/** Nicho de quem não tem um válido: é o que o sistema sempre assumiu. */
export const DEFAULT_NICHE: TenantNicheId = "automacao_residencial";

export function nicheEntry(niche: unknown): WebNicheEntry {
  return NICHE_REGISTRY[isTenantNiche(niche) ? niche : DEFAULT_NICHE];
}

export function mapNiches<T>(pick: (entry: WebNicheEntry, niche: TenantNicheId) => T): Record<TenantNicheId, T> {
  return Object.fromEntries(
    TENANT_NICHES.map((niche) => [niche, pick(NICHE_REGISTRY[niche], niche)]),
  ) as Record<TenantNicheId, T>;
}

/** Caminhos das landings de nicho, na ordem do registro. */
export const NICHE_LANDING_PATHS = TENANT_NICHES.map((niche) => NICHE_REGISTRY[niche].landingPath);
