/**
 * O TEXTO DO SITE INSTITUCIONAL.
 *
 * Num arquivo só, e não espalhado pelos componentes, para que ajustar a
 * história da ProOps seja editar este arquivo e mais nada.
 *
 * O briefing de setembro de 2026 fechou tudo: a origem, as quatro datas, o que
 * cada princípio significa na prática, e os três números.
 *
 * `PLACEHOLDER` liga um selo âmbar em toda seção que ainda dependa de alguém.
 * Está em `false` porque não sobrou nenhuma. Ao acrescentar texto que seja
 * chute, ligue de volta e ponha um `<PlaceholderBadge>` na seção: o selo existe
 * para impedir que a página vá ao ar com número inventado parecendo real, e uma
 * empresa nova é conferida justamente pelos números.
 */
export const PLACEHOLDER = false;

// O número de suporte já tem dono no projeto: `lib/whatsapp-contacts` é a fonte,
// e a landing o consome por este módulo. Repetir os dígitos aqui seria a segunda
// cópia, e a que ninguém lembraria de trocar.
export { WHATSAPP_HREF } from "@/components/landing/_shared/whatsapp";
import { WHATSAPP_HREF as WPP } from "@/components/landing/_shared/whatsapp";

export interface Principio {
  titulo: string;
  /** Uma linha. É o que a raiz mostra, e só ela. */
  resumo: string;
  /** O argumento. Vive em /manifesto. */
  texto: string;
  /**
   * O exemplo concreto, que é o que separa um princípio de um adjetivo. Vive
   * em /manifesto, realçado logo abaixo do `texto`.
   *
   * Não é "o que o princípio custa": o custo dos três está na seção "A
   * contrapartida" daquela página, escrita de uma vez só.
   */
  detalhe: string;
}

export interface Marco {
  ano: string;
  titulo: string;
  /** Uma linha. É o que a linha do tempo horizontal da raiz mostra. */
  resumo: string;
  /** O relato. Vive em /sobre. */
  texto: string;
}

export interface Numero {
  /** Só o dígito: o contador scrubado precisa de número, não de string. */
  valor: number;
  prefixo?: string;
  sufixo?: string;
  /** Preenche com zero à esquerda, para a caixa não mudar de largura contando. */
  digitos?: number;
  rotulo: string;
}

export interface Pessoa {
  nome: string;
  papel: string;
  /** O que essa pessoa resolve, em uma frase. */
  fala: string;
  /** Formação, quando ela explica o papel. Vazio some da tela. */
  formacao?: string;
  /** Caminho em `public/founders`. Retrato, recortado em 4x5. */
  foto: string;
}

export interface Compromisso {
  titulo: string;
  texto: string;
}

export interface Canal {
  /** O motivo, como quem está escrevendo pensaria nele. */
  motivo: string;
  /** A fila que responde. Viaja junto com a mensagem, como assunto. */
  titulo: string;
  texto: string;
  /** O que o campo de mensagem pede, no lugar de um rótulo genérico. */
  convite: string;
  /** O prazo declarado para este assunto, em duas palavras. */
  prazo: string;
  /** O caminho direto, para quem não quer preencher formulário nenhum. */
  atalho: { rotulo: string; href: string; externo?: boolean };
}

/** A frase que a segunda cena revela palavra por palavra. */
export const FRASE_MANIFESTO =
  "A ProOps existe para que uma empresa que vende projeto pare de administrar o próprio sistema e volte a administrar o próprio negócio.";

/** As seis planilhas que a cena do problema junta numa base só. */
export const PLANILHAS: string[] = [
  "Orçamento_v7_FINAL.xlsx",
  "Clientes 2026",
  "Contas a receber",
  "Controle de obra",
  "Comissões",
  "Notas emitidas",
];

/**
 * Como a empresa trabalha. Três é o teto: uma quarta ninguém lê.
 *
 * Cada campo tem UM dono, e é assim que as duas superfícies deixam de se
 * repetir: a raiz mostra `resumo` e manda para /manifesto, que é a única que
 * mostra `texto` e `detalhe`.
 */
export const PRINCIPIOS: Principio[] = [
  {
    titulo: "Software que cabe no dia",
    resumo: "Projetado para a terça-feira à tarde, não para a demonstração.",
    texto:
      "Ferramenta boa é a que some no meio do trabalho. A gente projeta para o uso de terça-feira à tarde, não para a demonstração.",
    detalhe:
      "Em outro sistema você demora para aprender e continua demorando para emitir. Aqui o tempo fica todo no começo: cadastrar catálogo, preço e modelo dá trabalho uma vez, e depois uma proposta de 40 itens sai em 8 minutos, com poucos cliques.",
  },
  {
    titulo: "Uma base, não seis planilhas",
    resumo: "Proposta, cliente e dinheiro são a mesma história, contada em partes.",
    texto:
      "Proposta, cliente e dinheiro são a mesma história contada em partes. Separá-los em sistemas diferentes é o que faz o mês fechar errado.",
    detalhe:
      "É por isso que o ERP não para na proposta: catálogo, cliente, funil, contrato e recebimento são o mesmo caminho, e não quatro sistemas trocando arquivo entre si.",
  },
  {
    titulo: "O detalhe que ninguém vê",
    resumo:
      "O erro que custa caro nunca está na tela principal. Está no centavo e na data.",
    texto:
      "O erro que custa caro nunca está na tela principal. É um centavo que não fecha, uma data que cai no mês errado, um número que um funcionário não devia estar vendo.",
    detalhe:
      "Um recebimento do dia primeiro tem que entrar no fechamento do mês certo, e não no anterior porque o servidor está num fuso diferente do seu. Ninguém elogia isso. Mas basta acontecer uma vez para a pessoa voltar a conferir tudo na mão, e a partir daí o sistema já perdeu, por mais bonito que seja o resto.",
  },
];

/**
 * A linha do tempo, como ela aconteceu de verdade.
 *
 * Mesma divisão dos princípios: a raiz passa por `resumo`, e /sobre é a única
 * que conta a história em `texto`.
 *
 * Os quatro têm mês e ano confirmados pelos sócios.
 */
export const MARCOS: Marco[] = [
  {
    ano: "Nov 2025",
    titulo: "Uma proposta que levava horas",
    resumo:
      "A ProOps começou dentro de uma empresa de automação residencial, para resolver um problema de casa.",
    texto:
      "O Winicius tem uma empresa de automação residencial, e a reclamação dele era sempre a mesma: os sistemas de gestão que existiam para esse mercado eram limitados e difíceis de manusear, e montar uma proposta inteira para um cliente consumia horas. A ProOps começou aí, em novembro de 2025, como o ERP que resolveria exatamente isso. Não havia mercado em vista. Havia um problema específico que se repetia toda semana, na mesa ao lado.",
  },
  {
    ano: "Jan 2026",
    titulo: "Passou do combinado",
    resumo:
      "O sistema ficou maior e mais completo do que o problema que veio resolver.",
    texto:
      "O plano era cobrir a proposta. Com o tempo o ERP foi ficando melhor e mais completo do que a gente tinha imaginado, e foi cobrindo o resto do caminho: catálogo, cliente, funil, contrato, recebimento. Em algum momento ficou claro que aquilo tinha tomado outra proporção, e que já não era a ferramenta interna de uma empresa só.",
  },
  {
    ano: "Mar 2026",
    titulo: "A ProOps vira marca",
    resumo:
      "A ferramenta de dentro de casa virou produto, com nome, preço e outra empresa usando.",
    texto:
      "A decisão de comercializar veio depois do sistema, e não antes dele. É a ordem menos comum e é a que a gente prefere: o produto foi provado no uso diário de uma empresa de verdade antes de ter marca, site e preço. Hoje são duas empresas no ERP, e a primeira delas continua sendo a que deu origem a ele.",
  },
  {
    ano: "Ago 2026",
    titulo: "O aplicativo",
    resumo:
      "A mesma ideia de base única, levada para a vida financeira de cada pessoa.",
    texto:
      "Veio de um estudo do que já existia: de um lado, aplicativos de nota rápida ligados ao WhatsApp; do outro, sites de controle financeiro. Em todos faltava alguma coisa, e a coisa que faltava era sempre a outra metade. A resposta foi unificar: nota, lembrete e um financeiro completo no mesmo aplicativo, conversando entre si, com o WhatsApp como porta de entrada.",
  },
];

/**
 * Números publicáveis. Só entram depois de conferidos, e os três estão.
 *
 * Os três contam a mesma história em ordem: quem usa, quanto foi usado, e quão
 * rápido é. O de oito minutos é o mais importante dos três, porque é o único
 * que PROVA o primeiro princípio em vez de afirmá-lo.
 *
 * "Produtos no ar" saiu daqui: ele já é a ficha do herói de /produtos, e o
 * número que ele ocupava vale mais com o tempo de emissão. A grade da cena
 * segue o tamanho desta lista, então acrescentar ou tirar um item é seguro.
 */
export const NUMEROS: Numero[] = [
  { valor: 2, digitos: 2, rotulo: "Empresas usando o ERP" },
  { valor: 70, digitos: 2, rotulo: "Propostas já emitidas" },
  {
    valor: 8,
    digitos: 2,
    sufixo: " min",
    rotulo: "Para uma proposta de 40 itens",
  },
];

/**
 * Os três sócios. Nomes, papéis e formação reais.
 *
 * Sem selo de rascunho: esta é a única seção do site que já tem informação
 * confirmada, e é a que mais importa numa página institucional, porque é a
 * resposta para "de quem eu estou comprando".
 *
 * As fotos vivem em `public/founders`, em kebab-case: o nome original tinha
 * espaço e acento, e isso vira `%20` e `%C3%A7` numa URL, que funciona e depois
 * quebra no primeiro lugar que monta o caminho por concatenação.
 */
export const PESSOAS: Pessoa[] = [
  {
    nome: "Mauricio Krziminski",
    papel: "Cofundador, engenharia e produto",
    formacao: "Engenheiro de Software pela PUC-RS",
    fala: "Constrói o produto e conversa com quem usa. As duas coisas, de propósito: o que aparece numa reunião vira decisão de código na mesma semana.",
    foto: "/founders/mauricio-krziminski.webp",
  },
  {
    nome: "Gabriel Almeida",
    papel: "Cofundador, engenharia e produto",
    formacao: "Engenheiro de Software pelo Inatel",
    fala: "Cuida da parte técnica e da evolução dos dois produtos, e atende cliente junto. Quem implanta é quem escreveu o que está sendo implantado.",
    foto: "/founders/gabriel-almeida.jpeg",
  },
  {
    nome: "Winicius Gonçalves",
    papel: "Cofundador, comercial e financeiro",
    fala: "Comercial, marketing e financeiro da ProOps, e o primeiro usuário do ERP: foi na empresa dele, de automação residencial, que o sistema nasceu. É com ele que começa a conversa de quem ainda está decidindo.",
    foto: "/founders/winicius-goncalves.png",
  },
];

/** O que a ProOps se compromete a fazer com o dado de quem usa. */
export const COMPROMISSOS: Compromisso[] = [
  {
    titulo: "O dado é de quem digitou",
    texto:
      "Cada empresa acessa apenas os próprios dados, e a separação é aplicada em toda requisição, não só na tela.",
  },
  {
    titulo: "Conformidade com a LGPD",
    texto:
      "Tratamento de dado pessoal conforme a Lei Geral de Proteção de Dados, com exclusão sob demanda e registro de quem acessou o quê.",
  },
  {
    titulo: "Gente responde",
    texto:
      "Suporte com pessoa do outro lado, que conhece o produto e o negócio de quem está perguntando.",
  },
  {
    titulo: "Continuidade",
    texto:
      "Infraestrutura gerenciada, com redundância e rotina de backup, para que nada se perca enquanto a empresa cresce.",
  },
];

/**
 * Os três assuntos que chegam aqui, e a fila que responde cada um.
 *
 * Eram quatro. "Sou jornalista" saiu: uma empresa com um ano de estrada não
 * recebe pedido de imprensa, e um canal que nunca toca ocupa um quarto da
 * escolha mais importante da página. O e-mail geral continua no rodapé e na
 * ficha desta página, que é por onde esse caso raro entra.
 *
 * O `titulo` não é decoração: ele viaja como `segment` para
 * `/v1/public/contact-form` e é o que diz, no e-mail que chega, qual fila tem
 * que responder. Mudar o texto muda o assunto do e-mail.
 */
export const CANAIS: Canal[] = [
  {
    motivo: "Quero conhecer o produto",
    titulo: "Comercial",
    texto:
      "Uma conversa sobre o que a sua empresa faz hoje e onde o sistema entra. Sem compromisso e sem script.",
    convite: "O que a sua empresa vende, e o que hoje toma mais tempo do que devia?",
    prazo: "Resposta em até dois dias úteis",
    atalho: {
      rotulo: "Prefere agendar uma demonstração?",
      href: "/agendar",
    },
  },
  {
    motivo: "Já uso e preciso de ajuda",
    titulo: "Suporte",
    texto:
      "Atendimento de quem já é cliente, pelo canal mais rápido: mensagem, com a pessoa que conhece a sua conta.",
    convite: "O que aconteceu, e em qual tela?",
    prazo: "No mesmo dia útil",
    atalho: {
      rotulo: "Prefere o WhatsApp? É mais rápido.",
      href: WPP,
      externo: true,
    },
  },
  {
    motivo: "Quero propor uma parceria",
    titulo: "Parcerias",
    texto:
      "Integração, indicação e revenda. Conte o que você faz e onde acha que os dois produtos se encontram.",
    convite: "O que você faz, e onde acha que os dois produtos se encontram?",
    prazo: "Resposta em até dois dias úteis",
    atalho: {
      rotulo: "Prefere escrever direto?",
      href: "mailto:gestao@proops.com.br?subject=Parceria",
      externo: true,
    },
  },
];



/**
 * O herói da raiz: uma proposta acompanhada do cômodo ao dinheiro na conta.
 *
 * As legendas são uma por ato da cena (`_components/heroi/roteiro.ts`) e só uma
 * aparece de cada vez; a do trilho é a palavra curta do mesmo ato. Os números da
 * cena (itens, valores, código) não moram aqui: moram em `cena-planta.ts`,
 * porque são dado que o desenho e a conta leem, não frase.
 */
export const HEROI_RAIZ = {
  titulo: ["Da planta", "ao dinheiro", "na conta."],
  lead: "A ProOps faz software de gestão para a empresa que vende projeto, e para a pessoa por trás dela.",
  dica: "Role e acompanhe uma proposta, do cômodo ao pagamento.",
  legendas: {
    projeto: "Cada cômodo que a equipe especifica vira um item, com preço.",
    proposta: "Os itens montam a proposta sozinhos, com o código e o total certos.",
    aprovada: "O cliente assina, e a entrada e as parcelas já nascem no financeiro.",
    dinheiro: "E o aplicativo avisa, por mensagem, quando o dinheiro entra.",
  },
  trilho: {
    projeto: "Projeto",
    proposta: "Proposta",
    aprovada: "Aprovada",
    dinheiro: "Na conta",
  },
} as const;
