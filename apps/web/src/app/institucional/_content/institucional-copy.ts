/**
 * TEXTO PENDENTE DO SITE INSTITUCIONAL.
 *
 * Tudo aqui é rascunho, à espera do briefing da empresa. Está num arquivo só,
 * e não espalhado pelos componentes, para que ajustar a história da ProOps seja
 * editar este arquivo e mais nada.
 *
 * `PLACEHOLDER` liga um selo visível em cada seção que ainda depende de você.
 * Deixe em `true` até o texto estar aprovado: é o que impede a página de ir ao
 * ar com número inventado parecendo número real.
 */
export const PLACEHOLDER = true;

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
  /** O que o princípio custa. Vive em /manifesto. */
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
  titulo: string;
  texto: string;
  acao: string;
  href: string;
  /** `true` abre em outra aba: WhatsApp, formulário do ERP. */
  externo?: boolean;
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
      "Substituir por um exemplo concreto: uma tela que foi refeita porque alguém levava seis cliques para fazer o que faz vinte vezes por dia.",
  },
  {
    titulo: "Uma base, não seis planilhas",
    resumo: "Proposta, cliente e dinheiro são a mesma história, contada em partes.",
    texto:
      "Proposta, cliente e dinheiro são a mesma história contada em partes. Separá-los em sistemas diferentes é o que faz o mês fechar errado.",
    detalhe:
      "Substituir por como essa decisão aparece no produto: o que acontece com o financeiro quando uma proposta é aprovada, sem ninguém digitar de novo.",
  },
  {
    titulo: "O detalhe que ninguém vê",
    resumo: "Fuso, centavo, acento, permissão. É onde a confiança se ganha ou se perde.",
    texto:
      "Fuso, centavo, acento, permissão. É onde o software perde a confiança de quem usa, e é onde a gente gasta o tempo.",
    detalhe:
      "Substituir por um detalhe real que custou uma semana e que nenhum cliente vai notar, porque notar seria o sintoma.",
  },
];

/**
 * Linha do tempo. Trocar por marcos reais quando o briefing chegar.
 *
 * Mesma divisão dos princípios: a raiz passa por `resumo`, e /sobre é a única
 * que conta a história em `texto`.
 */
export const MARCOS: Marco[] = [
  {
    ano: "20XX",
    titulo: "O começo",
    resumo: "A primeira linha de código, e o problema concreto que a motivou.",
    texto:
      "Substituir por como a ProOps nasceu e qual problema concreto motivou a primeira linha de código.",
  },
  {
    ano: "20XX",
    titulo: "O primeiro cliente",
    resumo: "Alguém confiou a operação da própria empresa ao sistema.",
    texto:
      "Substituir por quem foi, o que ele precisava e o que isso mudou no produto.",
  },
  {
    ano: "20XX",
    titulo: "O ERP completo",
    resumo: "Proposta, CRM e financeiro passaram a viver na mesma base.",
    texto:
      "Substituir pelo momento em que o sistema passou a cobrir proposta, CRM e financeiro na mesma base.",
  },
  {
    ano: "20XX",
    titulo: "O aplicativo",
    resumo: "A mesma ideia, levada para a vida financeira de cada pessoa.",
    texto:
      "Substituir pela decisão de levar a mesma ideia para a vida financeira pessoal.",
  },
];

/**
 * Números publicáveis. Só entram depois de conferidos.
 *
 * Zerados de propósito: um número inventado numa página institucional para de
 * ser rascunho e passa a ser afirmação, e é a primeira coisa que um cliente
 * confere. O contador é dirigido por scroll, então ele anima de 0 a 0 enquanto
 * estes valores forem zero, o que é exatamente o aviso que se quer.
 */
export const NUMEROS: Numero[] = [
  { valor: 0, digitos: 2, rotulo: "Empresas usando o ERP" },
  { valor: 0, digitos: 2, sufixo: " mil", rotulo: "Propostas emitidas" },
  {
    valor: 0,
    digitos: 2,
    sufixo: "%",
    rotulo: "Substituir por um número que importe",
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
    fala: "Comercial, marketing e financeiro da ProOps. É com ele que começa a conversa de quem ainda está decidindo.",
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

/** Canais de contato institucional. O formulário comercial é o do ERP. */
export const CANAIS: Canal[] = [
  {
    motivo: "Quero conhecer o produto",
    titulo: "Comercial",
    texto:
      "Uma conversa sobre o que a sua empresa faz hoje e onde o sistema entra. Sem compromisso e sem script.",
    acao: "Falar com o comercial",
    href: "/contato",
  },
  {
    motivo: "Já uso e preciso de ajuda",
    titulo: "Suporte",
    texto:
      "Atendimento de quem já é cliente, pelo canal mais rápido: mensagem, com a pessoa que conhece a sua conta.",
    acao: "Abrir o WhatsApp",
    href: WPP,
    externo: true,
  },
  {
    motivo: "Sou jornalista",
    titulo: "Imprensa",
    texto:
      "Dados da empresa, material de marca e entrevista. Respondemos em até dois dias úteis.",
    acao: "Escrever para a imprensa",
    href: "mailto:gestao@proops.com.br?subject=Imprensa",
  },
  {
    motivo: "Quero propor uma parceria",
    titulo: "Parcerias",
    texto:
      "Integração, indicação e revenda. Conte o que você faz e onde acha que os dois produtos se encontram.",
    acao: "Propor uma parceria",
    href: "mailto:gestao@proops.com.br?subject=Parceria",
  },
];


