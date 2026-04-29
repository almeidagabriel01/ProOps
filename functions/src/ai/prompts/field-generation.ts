// Niche values mirroring src/types/index.ts TenantNiche (kept local to avoid cross-project deps)
type NicheKey = "automacao_residencial" | "cortinas" | (string & {});

// Discriminated union of all supported field generation requests
export type GenerateFieldRequest =
  | {
      field: "product.description";
      context: { name: string; category?: string; manufacturer?: string; niche: NicheKey };
    }
  | {
      field: "product.category";
      context: { name: string; description?: string; niche: NicheKey };
    }
  | {
      field: "proposal.notes";
      context: {
        title: string;
        clientName: string;
        products: { name: string; quantity: number }[];
        totalValue: number;
        niche: NicheKey;
      };
    }
  | {
      field: "proposal.pdfSection";
      context: {
        title: string;
        sectionType: "cover" | "scope" | "terms";
        products?: { name: string; quantity: number }[];
        niche: NicheKey;
      };
    }
  | {
      field: "item.description";
      context: { name: string; category?: string; niche: NicheKey };
    };

export type GenerateFieldRequestField = GenerateFieldRequest["field"];

// Max output tokens per field type
export const MAX_OUTPUT_TOKENS: Record<GenerateFieldRequestField, number> = {
  "product.description": 200,
  "product.category": 80,
  "proposal.notes": 500,
  "proposal.pdfSection": 800,
  "item.description": 200,
};

const NICHE_LABELS: Record<string, string> = {
  automacao_residencial: "automação residencial",
  cortinas: "cortinas e persianas",
};

function nicheLabel(niche: string): string {
  return NICHE_LABELS[niche] ?? niche;
}

// Patterns that suggest prompt injection attempts
const INJECTION_PATTERNS = [
  /ignore\s+(previous|prior|above)\s+instructions/i,
  /you\s+are\s+now/i,
  /act\s+as\s+(a\s+)?different/i,
  /forget\s+(your|all)\s+(previous|instructions)/i,
  /system\s*:\s*you/i,
];

export function containsInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(text));
}

function truncate(s: string | undefined, max = 500): string {
  if (!s) return "-";
  return s.length > max ? s.slice(0, max) : s;
}

export function buildPrompt(req: GenerateFieldRequest): { system: string; user: string } {
  switch (req.field) {
    case "product.description":
      return {
        system: `Você é redator técnico especializado no nicho de ${nicheLabel(req.context.niche)}. Escreva em PT-BR. Produza 2-3 frases objetivas focando nos diferenciais e uso do produto. Sem prefixo como "Descrição:". Sem aspas. Sem markdown.`,
        user: `Produto: ${truncate(req.context.name)}\nCategoria: ${truncate(req.context.category)}\nFabricante: ${truncate(req.context.manufacturer)}`,
      };

    case "product.category":
      return {
        system: `Você é classificador de produtos para o nicho de ${nicheLabel(req.context.niche)}. Responda em PT-BR com o nome da categoria mais adequada para o produto, em no máximo 5 palavras. Apenas o nome da categoria, sem explicação, sem pontuação final.`,
        user: `Produto: ${truncate(req.context.name)}\nDescrição: ${truncate(req.context.description)}`,
      };

    case "proposal.notes": {
      const productList = req.context.products
        .slice(0, 10)
        .map((p) => `- ${truncate(p.name, 100)} (×${p.quantity})`)
        .join("\n");
      return {
        system: `Você é assistente comercial para empresas de ${nicheLabel(req.context.niche)}. Escreva em PT-BR um parágrafo de observações para a proposta: contexto do projeto, próximos passos sugeridos e mensagem cordial de fechamento. Entre 3-5 frases. Sem markdown.`,
        user: `Proposta: ${truncate(req.context.title)}\nCliente: ${truncate(req.context.clientName)}\nValor total: R$ ${req.context.totalValue.toFixed(2)}\nItens:\n${productList}`,
      };
    }

    case "proposal.pdfSection": {
      const sectionLabels: Record<string, string> = {
        cover: "capa / apresentação",
        scope: "escopo do projeto",
        terms: "condições e garantias",
      };
      const productList = (req.context.products ?? [])
        .slice(0, 10)
        .map((p) => `- ${truncate(p.name, 100)} (×${p.quantity})`)
        .join("\n");
      return {
        system: `Você é redator de propostas comerciais para empresas de ${nicheLabel(req.context.niche)}. Escreva em PT-BR a seção de ${sectionLabels[req.context.sectionType]} para um PDF profissional. Tom formal e confiante. Sem títulos ou subtítulos repetindo o nome da seção. Sem markdown.`,
        user: `Título da proposta: ${truncate(req.context.title)}${productList ? `\nItens:\n${productList}` : ""}`,
      };
    }

    case "item.description":
      return {
        system: `Você é redator técnico para o nicho de ${nicheLabel(req.context.niche)}. Escreva em PT-BR 1-2 frases descrevendo o item de forma objetiva para uma proposta comercial. Sem prefixo. Sem aspas. Sem markdown.`,
        user: `Item: ${truncate(req.context.name)}\nCategoria: ${truncate(req.context.category)}`,
      };
  }
}
