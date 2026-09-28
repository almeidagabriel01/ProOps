/**
 * Nichos da plataforma e o que cada um define no BACKEND: a fonte única.
 *
 * O id é a chave deste registro e é gravado no tenant no cadastro; depois
 * disso nunca muda (rules e API recusam). Nicho novo = uma entrada aqui, e o
 * compilador cobra todas as tabelas derivadas.
 *
 * Arquivo puro, sem import: o front mantém um espelho dos campos que ele
 * também usa (`apps/web/src/lib/niches/registry.ts`), e a paridade dos dois
 * com o `firebase/firestore.rules` é garantida por
 * `apps/web/src/__tests__/niche-registry-parity.test.ts`.
 */

export interface VisitType {
  id: string;
  label: string;
  durationMin: number;
}

export interface StageTemplate {
  name: string;
  checklist: string[];
}

export interface NicheRegistryEntry {
  /** Tenant de demonstração que a conta free do nicho navega. */
  demoTenantId: string;
  /** Imagens por produto do catálogo (serviço sempre tem uma). */
  productImageLimit: number;
  /** Tipo de visita com que o link de agendamento nasce. */
  defaultVisitType: VisitType;
  /**
   * Etapas com que a obra nasce. A empresa ajusta em Configurações; é ponto
   * de partida, não regra.
   */
  stageTemplate: StageTemplate[];
  /** Como a IA se refere ao ramo da empresa nos textos que gera. */
  aiLabel: string;
}

export const NICHE_REGISTRY = {
  automacao_residencial: {
    demoTenantId: "demo",
    productImageLimit: 1,
    defaultVisitType: { id: "visita_tecnica", label: "Visita técnica", durationMin: 60 },
    stageTemplate: [
    {
      name: "Infraestrutura",
      checklist: ["Conferir tubulação e caixas", "Passar cabeamento", "Montar o quadro/rack"],
    },
    {
      name: "Instalação",
      checklist: ["Instalar os equipamentos", "Ligar e identificar os circuitos"],
    },
    {
      name: "Configuração",
      checklist: ["Programar cenas e automações", "Configurar o aplicativo", "Testar ambiente por ambiente"],
    },
    {
      name: "Entrega",
      checklist: ["Treinar o cliente", "Limpar e organizar a obra", "Registrar fotos finais"],
    },
  ],
    aiLabel: "automação residencial",
  },
  cortinas: {
    demoTenantId: "demo-cortinas",
    productImageLimit: 3,
    defaultVisitType: { id: "medicao", label: "Medição", durationMin: 60 },
    stageTemplate: [
    {
      name: "Medição",
      checklist: [
        "Medir vãos e altura",
        "Conferir a alvenaria e o ponto elétrico",
        "Confirmar tecido, lona e acionamento",
      ],
    },
    { name: "Produção", checklist: ["Enviar pedido", "Conferir peças recebidas"] },
    {
      name: "Instalação",
      checklist: [
        "Fixar trilhos, suportes e braços",
        "Instalar persianas, cortinas e toldos",
        "Regular e testar o acionamento",
      ],
    },
    { name: "Entrega", checklist: ["Orientar o cliente", "Registrar fotos finais"] },
  ],
    aiLabel: "persianas, cortinas, toldos e pergolados",
  },
  seguranca_eletronica: {
    demoTenantId: "demo-seguranca",
    productImageLimit: 1,
    defaultVisitType: { id: "vistoria_tecnica", label: "Vistoria técnica", durationMin: 60 },
    stageTemplate: [
    {
      name: "Levantamento",
      checklist: [
        "Mapear os pontos de câmera e sensores",
        "Definir a rota dos cabos e a energia",
        "Confirmar o local do gravador e da central",
      ],
    },
    {
      name: "Infraestrutura",
      checklist: ["Passar tubulação e cabeamento", "Montar o rack ou a caixa do gravador"],
    },
    {
      name: "Instalação",
      checklist: [
        "Instalar câmeras, sensores e central",
        "Instalar fechaduras, leitores e cerca, se houver",
      ],
    },
    {
      name: "Configuração",
      checklist: [
        "Configurar gravação e acesso remoto no aplicativo",
        "Cadastrar zonas, usuários e biometrias",
        "Testar cada ponto",
      ],
    },
    {
      name: "Entrega",
      checklist: ["Treinar o cliente", "Entregar senhas e o termo de entrega", "Registrar fotos finais"],
    },
  ],
    aiLabel: "segurança eletrônica (CFTV, alarme, controle de acesso, cerca elétrica e portaria)",
  },
  vidracaria_esquadrias: {
    demoTenantId: "demo-vidracaria",
    productImageLimit: 3,
    defaultVisitType: { id: "medicao", label: "Medição", durationMin: 60 },
    stageTemplate: [
      {
        name: "Medição",
        checklist: [
          "Medir os vãos no local",
          "Conferir prumo, nível e esquadro",
          "Confirmar vidro, perfil e acabamento",
        ],
      },
      {
        name: "Produção",
        checklist: ["Enviar vidros para a têmpera", "Cortar e montar os perfis", "Conferir as peças recebidas"],
      },
      {
        name: "Instalação",
        checklist: ["Instalar esquadrias e vidros", "Vedar e regular portas e janelas"],
      },
      { name: "Entrega", checklist: ["Limpar os vidros", "Orientar o cliente", "Registrar fotos finais"] },
    ],
    aiLabel: "vidraçaria e esquadrias de alumínio (vidro temperado, box, sacadas, janelas, portas, espelhos e fechamentos)",
  },
  marcenaria: {
    demoTenantId: "demo-marcenaria",
    productImageLimit: 3,
    defaultVisitType: { id: "medicao", label: "Medição", durationMin: 60 },
    stageTemplate: [
      {
        name: "Medição",
        checklist: [
          "Medir paredes, pé-direito e vãos",
          "Marcar pontos elétricos e hidráulicos",
          "Fotografar o ambiente",
        ],
      },
      {
        name: "Projeto",
        checklist: ["Desenhar o projeto do ambiente", "Aprovar projeto, cores e acabamentos com o cliente"],
      },
      {
        name: "Produção",
        checklist: ["Cortar e fitar as chapas", "Furar e pré-montar os módulos", "Separar ferragens e acessórios"],
      },
      {
        name: "Montagem",
        checklist: [
          "Montar e fixar os módulos",
          "Instalar ferragens, puxadores e iluminação",
          "Regular portas e gavetas",
        ],
      },
      { name: "Entrega", checklist: ["Limpar e vistoriar com o cliente", "Registrar fotos finais"] },
    ],
    aiLabel: "móveis planejados e marcenaria sob medida (cozinhas, dormitórios, closets, painéis e armários)",
  },
} satisfies Record<string, NicheRegistryEntry>;

export type TenantNicheId = keyof typeof NICHE_REGISTRY;

export const TENANT_NICHES = Object.keys(NICHE_REGISTRY) as TenantNicheId[];

export function isTenantNiche(value: unknown): value is TenantNicheId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(NICHE_REGISTRY, value);
}

/** Nicho de quem não tem um válido: é o que o sistema sempre assumiu. */
export const DEFAULT_NICHE: TenantNicheId = "automacao_residencial";

export function nicheEntry(niche: unknown): NicheRegistryEntry {
  return NICHE_REGISTRY[isTenantNiche(niche) ? niche : DEFAULT_NICHE];
}

/** Uma tabela por nicho a partir do registro (ex.: o limite de imagens). */
export function mapNiches<T>(pick: (entry: NicheRegistryEntry) => T): Record<TenantNicheId, T> {
  return Object.fromEntries(
    TENANT_NICHES.map((niche) => [niche, pick(NICHE_REGISTRY[niche])]),
  ) as Record<TenantNicheId, T>;
}
