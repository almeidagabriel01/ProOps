/**
 * TEXTO PENDENTE DA PÁGINA INSTITUCIONAL.
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

export interface Principio {
  titulo: string;
  texto: string;
}

export interface Marco {
  ano: string;
  titulo: string;
  texto: string;
}

export interface Numero {
  valor: string;
  rotulo: string;
}

/** Como a empresa trabalha. Três é o teto: uma quarta ninguém lê. */
export const PRINCIPIOS: Principio[] = [
  {
    titulo: "Software que cabe no dia",
    texto:
      "Ferramenta boa é a que some no meio do trabalho. A gente projeta para o uso de terça-feira à tarde, não para a demonstração.",
  },
  {
    titulo: "Uma base, não seis planilhas",
    texto:
      "Proposta, cliente e dinheiro são a mesma história contada em partes. Separá-los em sistemas diferentes é o que faz o mês fechar errado.",
  },
  {
    titulo: "O detalhe que ninguém vê",
    texto:
      "Fuso, centavo, acento, permissão. É onde o software perde a confiança de quem usa, e é onde a gente gasta o tempo.",
  },
];

/** Linha do tempo. Trocar por marcos reais quando o briefing chegar. */
export const MARCOS: Marco[] = [
  {
    ano: "20XX",
    titulo: "O começo",
    texto:
      "Substituir por como a ProOps nasceu e qual problema concreto motivou a primeira linha de código.",
  },
  {
    ano: "20XX",
    titulo: "O primeiro cliente",
    texto:
      "Substituir por quem foi, o que ele precisava e o que isso mudou no produto.",
  },
  {
    ano: "20XX",
    titulo: "O ERP completo",
    texto:
      "Substituir pelo momento em que o sistema passou a cobrir proposta, CRM e financeiro na mesma base.",
  },
  {
    ano: "20XX",
    titulo: "O aplicativo",
    texto:
      "Substituir pela decisão de levar a mesma ideia para a vida financeira pessoal.",
  },
];

/** Números publicáveis. Só entram depois de conferidos. */
export const NUMEROS: Numero[] = [
  { valor: "00", rotulo: "Empresas usando o ERP" },
  { valor: "00 mil", rotulo: "Propostas emitidas" },
  { valor: "00%", rotulo: "Substituir por um número que importe" },
];
