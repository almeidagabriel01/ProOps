/**
 * Traduz rejeições da SEFAZ e da prefeitura para linguagem de instalador.
 *
 * O padrão do mercado é repassar o erro cru. "Rejeição 805" não significa nada
 * para quem instala cortina, e o help center do provedor também não vai
 * significar. Cada entrada aqui explica **o que aconteceu**, **por que** e
 * oferece **uma ação de um clique** — que é a diferença entre o usuário
 * resolver sozinho e abrir um chamado.
 *
 * A lista cobre as rejeições mais frequentes levantadas no benchmark; qualquer
 * código fora dela cai no fallback, que mostra a mensagem original em vez de
 * esconder informação.
 */

export interface RejectionAction {
  label: string;
  /** Rota interna para onde levar o usuário. */
  href?: string;
  /** Campo a focar quando a rota abrir. */
  focusField?: string;
}

export interface HumanizedRejection {
  titulo: string;
  explicacao: string;
  acao?: RejectionAction;
  /** Mensagem crua do fisco, sempre disponível para o contador. */
  original?: string;
}

interface RejectionEntry {
  titulo: string;
  explicacao: string;
  acao?: RejectionAction;
  /** Casa também por trecho da mensagem, para quando o código não vem. */
  matches?: RegExp;
}

/**
 * Indexado pelo código numérico da SEFAZ quando existe. As entradas sem código
 * são casadas por `matches` contra o texto da rejeição.
 */
const REJECTIONS: Record<string, RejectionEntry> = {
  "805": {
    titulo: "O cliente está marcado como isento de inscrição estadual",
    explicacao:
      "A Receita do estado do cliente não aceita 'isento'. Quem não é contribuinte de ICMS — pessoa física, por exemplo — deve ser marcado como 'não contribuinte'.",
    acao: { label: "Corrigir cadastro do cliente", focusField: "indicadorIe" },
  },
  "209": {
    titulo: "A inscrição municipal do emitente é inválida",
    explicacao:
      "A prefeitura não reconheceu a inscrição municipal cadastrada. Confira o número no portal da prefeitura — o formato varia de município para município.",
    acao: {
      label: "Revisar dados fiscais",
      href: "/settings/fiscal",
      focusField: "inscricaoMunicipal",
    },
  },
  "213": {
    titulo: "O CNPJ do emitente não confere",
    explicacao:
      "O CNPJ informado na configuração fiscal é diferente do CNPJ do certificado digital. Os dois precisam ser da mesma empresa.",
    acao: { label: "Revisar dados fiscais", href: "/settings/fiscal", focusField: "cnpj" },
  },
  "215": {
    titulo: "A nota foi montada fora do padrão aceito",
    explicacao:
      "Algum campo saiu em formato inválido. Isso costuma ser um dado do cadastro com caractere estranho — acento em campo que não aceita, ou símbolo na descrição.",
  },
  "225": {
    titulo: "Falha na estrutura da nota",
    explicacao:
      "A nota não passou na validação de esquema da SEFAZ. Se persistir depois de revisar os cadastros, é caso de suporte.",
  },
  "228": {
    titulo: "A data de emissão está muito no passado",
    explicacao:
      "A SEFAZ recusa notas com data de emissão antiga demais. Emita novamente para gerar com a data de hoje.",
  },
  "239": {
    titulo: "Versão de layout não suportada",
    explicacao:
      "A SEFAZ deste estado não aceita a versão de layout enviada. É um ajuste do provedor, não do seu cadastro — acione o suporte.",
  },
  "252": {
    titulo: "Fora do prazo de cancelamento",
    explicacao:
      "O prazo para cancelar essa nota já passou — em geral 24 horas, até 7 dias em alguns estados. O caminho agora é emitir uma nota de devolução.",
  },
  "494": {
    titulo: "Chave de acesso inexistente",
    explicacao:
      "A SEFAZ não encontrou a nota referenciada. Se ela foi emitida há poucos minutos, aguarde e tente de novo.",
  },
  "539": {
    titulo: "Já existe uma nota com essa numeração",
    explicacao:
      "A numeração da sua série saiu de sincronia com a SEFAZ — normalmente porque notas foram emitidas por outro sistema. Ajuste o próximo número nas configurações fiscais.",
    acao: {
      label: "Ajustar numeração",
      href: "/settings/fiscal",
      focusField: "proximoNumeroNfe",
    },
  },
  CERTIFICADO_VENCIDO: {
    titulo: "O certificado digital venceu",
    explicacao:
      "O e-CNPJ A1 tem validade de 12 meses. Sem ele nenhuma nota é assinada. Renove com a sua certificadora e envie o novo arquivo.",
    acao: { label: "Enviar novo certificado", href: "/settings/fiscal" },
    matches: /certificado.*(vencid|expirad|prazo de validade)/i,
  },
  CERTIFICADO_SENHA: {
    titulo: "A senha do certificado está incorreta",
    explicacao:
      "O arquivo .pfx foi recebido, mas a senha não abriu. Confira com quem emitiu o certificado.",
    acao: { label: "Reenviar certificado", href: "/settings/fiscal" },
    matches: /senha.*(certificado|incorret)/i,
  },
  CERTIFICADO_CNPJ: {
    titulo: "O certificado é de outro CNPJ",
    explicacao:
      "O certificado enviado pertence a uma empresa diferente da configurada. Use o e-CNPJ da mesma empresa que vai emitir.",
    acao: { label: "Revisar dados fiscais", href: "/settings/fiscal", focusField: "cnpj" },
    matches: /certificado.*n[ãa]o pertence/i,
  },
  SEM_CREDENCIAMENTO: {
    titulo: "A empresa não está autorizada a emitir por sistema",
    explicacao:
      "Além do certificado, é preciso pedir liberação para emitir por webservice — na SEFAZ do estado, para nota de produto, ou na prefeitura, para nota de serviço. É um pedido único, feito uma vez.",
    matches: /(credenciad|n[ãa]o autorizad|sem permiss[ãa]o para emitir)/i,
  },
  MUNICIPIO_IBGE: {
    titulo: "O município do cliente não confere",
    explicacao:
      "A SEFAZ valida o município contra a tabela do IBGE. Refaça a busca de CEP no cadastro do cliente para preencher o código correto.",
    acao: { label: "Corrigir cadastro do cliente", focusField: "endereco.municipio" },
    matches: /munic[íi]pio.*(inv[áa]lid|divergent|n[ãa]o.*ibge)/i,
  },
  DESTINATARIO_DIVERGENTE: {
    titulo: "Os dados do cliente não batem com a Receita",
    explicacao:
      "O CPF ou CNPJ existe, mas o nome ou o endereço difere do cadastro da Receita. Confira o documento e a razão social.",
    matches: /(destinat[áa]rio|tomador).*(divergent|n[ãa]o confere|inv[áa]lid)/i,
  },
};

const MESSAGE_MATCHERS = Object.values(REJECTIONS).filter(
  (entry): entry is RejectionEntry & { matches: RegExp } => Boolean(entry.matches),
);

/**
 * Converte código e mensagem do fisco numa explicação acionável.
 *
 * A mensagem original é sempre preservada em `original` — o contador do cliente
 * costuma precisar dela, e escondê-la trocaria um problema por outro.
 */
export function humanizeRejection(
  code: string | undefined,
  message: string | undefined,
): HumanizedRejection {
  const original = String(message || "").trim() || undefined;
  const cleanCode = String(code || "").trim();

  const byCode = cleanCode ? REJECTIONS[cleanCode] : undefined;
  if (byCode) {
    return {
      titulo: byCode.titulo,
      explicacao: byCode.explicacao,
      ...(byCode.acao ? { acao: byCode.acao } : {}),
      ...(original ? { original } : {}),
    };
  }

  if (original) {
    const byMessage = MESSAGE_MATCHERS.find((entry) => entry.matches.test(original));
    if (byMessage) {
      return {
        titulo: byMessage.titulo,
        explicacao: byMessage.explicacao,
        ...(byMessage.acao ? { acao: byMessage.acao } : {}),
        original,
      };
    }
  }

  // Sem tradução conhecida: mostrar o que veio é melhor que esconder.
  return {
    titulo: "A nota foi rejeitada",
    explicacao:
      original ||
      "O fisco recusou a emissão e não detalhou o motivo. Tente novamente; se persistir, acione o suporte.",
    ...(cleanCode ? { original: `Código ${cleanCode}${original ? ` — ${original}` : ""}` } : {}),
  };
}
