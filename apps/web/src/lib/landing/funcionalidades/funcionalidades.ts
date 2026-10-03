import {
  Bot,
  CalendarDays,
  ClipboardCheck,
  Contact,
  FileText,
  KanbanSquare,
  Link2,
  Package,
  Palette,
  PenLine,
  Receipt,
  Smartphone,
  TrendingUp,
  UserCog,
  Wallet,
} from "lucide-react";

import { FUNCIONALIDADE_SLUGS, type FuncionalidadeSlug } from "./slugs";
import type { Funcionalidade, GrupoDeFuncionalidades } from "./tipos";

/**
 * As funcionalidades do ERP como o cliente pensa nelas: "o financeiro", "o
 * aceite online", "as obras". Cada uma tem página própria em
 * `/funcionalidades/<slug>` e reúne recursos do catálogo (`CATALOGO`), que é
 * onde mora o detalhe e o plano de cada coisa.
 *
 * Todo recurso do catálogo pertence a exatamente uma funcionalidade; o teste
 * `catalogo.test.ts` reprova recurso órfão ou repetido.
 *
 * O texto aqui é promessa de produto: cada frase sai dos `detalhes` dos
 * recursos que a funcionalidade reúne. Nada de velocidade, número de clientes
 * ou resultado que ninguém mediu (`landing-claims.test.ts` varre este arquivo).
 */
const CONTEUDO: Record<FuncionalidadeSlug, Omit<Funcionalidade, "slug">> = {
  crm: {
    titulo: "CRM e funil de vendas",
    resumo: "Leads com a próxima ação marcada e as propostas num quadro que se arrasta.",
    icone: KanbanSquare,
    grupo: "vender",
    principal: "leads",
    recursos: ["leads", "funil-de-propostas", "metas"],
    pagina: {
      titulo: "Nenhum lead esquecido no",
      destaque: "meio do caminho",
      intro:
        "Todo contato novo entra no funil com a origem, o valor estimado e o próximo passo marcado. Quando vira negócio, o lead se converte em cliente e a proposta já abre para ele. As propostas seguem num quadro com as colunas que a sua equipe usa.",
      passos: [
        {
          titulo: "O contato entra como lead",
          texto: "Com origem, valor estimado e a próxima ação: ligação, visita ou reunião, na linha do tempo do lead.",
        },
        {
          titulo: "Avança de etapa",
          texto: "Novo, Em contato, Qualificado, Convertido ou Perdido, com o histórico de cada conversa.",
        },
        {
          titulo: "Vira cliente e proposta",
          texto: "Converter o lead cria o cliente e abre a proposta. A meta do mês acompanha o que foi aprovado.",
        },
      ],
    },
    relacionadas: ["contatos", "propostas"],
  },
  contatos: {
    titulo: "Clientes e contatos",
    resumo: "Cliente, fornecedor, vendedor e arquiteto numa ficha só, com tudo o que envolve cada um.",
    icone: Contact,
    grupo: "vender",
    principal: "contatos",
    recursos: ["contatos", "importacao", "busca-global"],
    pagina: {
      titulo: "Tudo sobre o cliente em",
      destaque: "uma ficha só",
      intro:
        "Propostas, financeiro, notas e anotações de cada contato no mesmo lugar. Cliente, fornecedor, vendedor e arquiteto convivem na mesma lista, e quem já está numa planilha entra por importação.",
      passos: [
        {
          titulo: "Traga a sua base",
          texto: "Importe a planilha em .xlsx ou .csv: as colunas são ligadas pelo nome, e os repetidos aparecem antes de gravar.",
        },
        {
          titulo: "Abra a ficha",
          texto: "Propostas, lançamentos, notas e as próximas ações da equipe sobre aquele contato.",
        },
        {
          titulo: "Ache em qualquer tela",
          texto: "Um atalho de busca encontra o contato ou a proposta sem sair de onde você está.",
        },
      ],
    },
    relacionadas: ["crm", "pos-venda"],
  },
  catalogo: {
    titulo: "Catálogo e preço por medida",
    resumo: "Produtos e serviços com custo e margem, preço pela medida do vão e pacotes prontos.",
    icone: Package,
    grupo: "vender",
    principal: "produtos",
    recursos: ["produtos", "servicos", "preco-por-medida", "solucoes", "ambientes"],
    pagina: {
      titulo: "O preço certo sai do",
      destaque: "catálogo",
      intro:
        "Cada produto guarda custo, margem, preço de venda, estoque e os dados da nota. Nos segmentos que vendem por medida, o preço sai da largura e da altura do vão. Pacotes montados uma vez entram inteiros na proposta.",
      passos: [
        {
          titulo: "Cadastre uma vez",
          texto: "Custo e margem calculam o preço de venda, ou você digita. Fotos, fabricante e NCM ficam no produto.",
        },
        {
          titulo: "Defina como cobra",
          texto: "Por unidade, por metro quadrado, por faixa de altura ou por metro linear, conforme o seu segmento.",
        },
        {
          titulo: "Monte pacotes",
          texto: "Um sistema ou um local com os produtos padrão entra inteiro na proposta, e você ajusta só o que muda.",
        },
      ],
    },
    relacionadas: ["propostas", "notas-fiscais"],
  },
  propostas: {
    titulo: "Propostas",
    resumo: "Cliente, itens, pagamento e PDF num assistente que salva o rascunho sozinho.",
    icone: FileText,
    grupo: "vender",
    principal: "propostas",
    recursos: ["propostas", "envio-da-proposta", "numeracao"],
    pagina: {
      titulo: "A proposta montada em",
      destaque: "passos",
      intro:
        "Um assistente leva do cliente aos itens, às condições de pagamento e ao PDF, salvando o rascunho no caminho. Os itens se agrupam por local e por sistema, com subtotal, e a proposta sai pelo WhatsApp ou pelo e-mail da sua empresa com o link pronto.",
      passos: [
        {
          titulo: "Escolha o cliente e os itens",
          texto: "Do catálogo, agrupados por local e por sistema, com subtotal por grupo.",
        },
        {
          titulo: "Defina o pagamento",
          texto: "Entrada e parcelas na própria proposta, com anexos e campos personalizados.",
        },
        {
          titulo: "Envie pelo seu WhatsApp",
          texto: "O botão abre o WhatsApp ou o e-mail da empresa com a mensagem e o link. O código sequencial dá nome ao PDF.",
        },
      ],
    },
    relacionadas: ["aceite-online", "pdf-da-proposta"],
  },
  "aceite-online": {
    titulo: "Aceite online",
    resumo: "O cliente abre no celular, pede ajustes ou aceita com nome e CPF, e você é avisado.",
    icone: PenLine,
    grupo: "vender",
    principal: "aceite-online",
    recursos: ["link-da-proposta", "aceite-online", "pedido-de-mudancas", "alertas-de-proposta"],
    pagina: {
      titulo: "O cliente aceita pelo",
      destaque: "link",
      intro:
        "A proposta chega como um link com a sua marca. O cliente lê no celular, baixa o PDF, pede mudanças com o motivo escrito ou aceita com nome e CPF ou CNPJ. Você sabe quando ele abriu e quem está esperando resposta.",
      passos: [
        {
          titulo: "Você envia o link",
          texto: "A proposta com a sua marca, para ler no celular e baixar o PDF.",
        },
        {
          titulo: "O cliente abre",
          texto: "Você é avisado na hora, e lembrado se ele viu e não respondeu em três dias.",
        },
        {
          titulo: "Aceita ou pede ajustes",
          texto: "O aceite fica registrado com data e documento. Confirmado, nascem os lançamentos, as comissões e a obra.",
        },
      ],
    },
    relacionadas: ["propostas", "pos-venda"],
  },
  "pdf-da-proposta": {
    titulo: "PDF com a sua marca",
    resumo: "Capa, seções, fontes e cores da proposta com a prévia ao lado, e cópia no Google Drive.",
    icone: Palette,
    grupo: "vender",
    principal: "editor-de-pdf",
    recursos: ["editor-de-pdf", "cores-da-marca", "google-drive"],
    pagina: {
      titulo: "O PDF com a cara da",
      destaque: "sua empresa",
      intro:
        "Temas prontos para partir de um desenho que já funciona, e um editor com a prévia ao lado para capa, seções, fontes e cores. Você escolhe o que aparece: fotos, preços, medidas e subtotais. Cada PDF pode ir sozinho para a pasta do cliente no Google Drive da empresa.",
      passos: [
        {
          titulo: "Parta de um tema",
          texto: "Um desenho pronto, vestido com a cor principal da empresa.",
        },
        {
          titulo: "Ajuste as seções",
          texto: "Mostre ou esconda fotos, preços, medidas e subtotais, e reaproveite modelos de texto.",
        },
        {
          titulo: "Arquive no Drive",
          texto: "O PDF cai na pasta do cliente, criada pela ProOps no Drive da empresa.",
        },
      ],
    },
    relacionadas: ["propostas", "aceite-online"],
  },
  obras: {
    titulo: "Obras",
    resumo: "A venda aprovada vira obra, com as etapas do seu segmento, checklist, fotos e aceite da entrega.",
    icone: ClipboardCheck,
    grupo: "entregar",
    principal: "projetos",
    recursos: [
      "projetos",
      "visita-da-etapa",
      "aceite-da-entrega",
      "ordens-de-servico",
      "equipamentos-do-cliente",
      "contratos-de-manutencao",
      "pmoc",
    ],
    pagina: {
      titulo: "Da venda aprovada à",
      destaque: "entrega aceita",
      intro:
        "Aprovada a proposta, a obra já nasce com as etapas do seu segmento. Cada etapa tem checklist, fotos e o técnico responsável, e marcar a visita já põe na agenda. No fim, o cliente confere pelo link e aceita a entrega com nome e documento.",
      passos: [
        {
          titulo: "A obra nasce da venda",
          texto: "Com as etapas padrão do seu segmento, que você edita no modelo.",
        },
        {
          titulo: "A equipe avança etapa por etapa",
          texto: "Checklist, fotos e visita marcada, e todo mundo vê as mudanças na hora.",
        },
        {
          titulo: "O cliente aceita a entrega",
          texto: "Pelo link da obra, com nome e documento. A obra fecha e a equipe é avisada.",
        },
      ],
    },
    relacionadas: ["agenda", "pos-venda"],
  },
  agenda: {
    titulo: "Agenda e tarefas",
    resumo: "A agenda da empresa com o Google Agenda, um link para o cliente marcar visita e tarefas com menção.",
    icone: CalendarDays,
    grupo: "entregar",
    principal: "agenda",
    recursos: ["agenda", "google-agenda", "link-de-agendamento", "tarefas"],
    pagina: {
      titulo: "A semana da equipe em",
      destaque: "uma agenda",
      intro:
        "Mês, semana, dia e lista, com arrastar para remarcar e cor por compromisso. A agenda conversa com o Google Agenda de cada pessoa, o cliente escolhe um horário livre pelo link de agendamento e as tarefas avisam quem foi mencionado.",
      passos: [
        {
          titulo: "O cliente pede a visita",
          texto: "Pelo link, escolhe o tipo de visita e um horário livre, dentro das regras que você definiu.",
        },
        {
          titulo: "Você confirma",
          texto: "O pedido chega na Agenda, e o cliente recebe a resposta por e-mail.",
        },
        {
          titulo: "A equipe recebe no celular",
          texto: "A visita aparece no Google Agenda de quem vai, e as tarefas lembram no dia do prazo.",
        },
      ],
    },
    relacionadas: ["obras", "crm"],
  },
  "pos-venda": {
    titulo: "Pós-venda por link",
    resumo: "Portal do cliente, recibo, cobrança por Pix e boleto e acompanhamento da obra, sem senha.",
    icone: Link2,
    grupo: "entregar",
    principal: "portal-do-cliente",
    recursos: ["portal-do-cliente", "link-do-recibo", "pagamento-online", "link-da-obra"],
    pagina: {
      titulo: "O cliente acompanha tudo sem",
      destaque: "ligar para perguntar",
      intro:
        "Cada cliente tem um link fixo com as propostas, os pagamentos, as obras e as notas dele. Cada parcela tem o próprio link com recibo, e com o pagamento online ele paga por Pix ou boleto ali mesmo. A obra também tem link, com as etapas, as fotos e a próxima visita.",
      passos: [
        {
          titulo: "Envie o portal",
          texto: "Um link por cliente, que você revoga quando quiser.",
        },
        {
          titulo: "O cliente paga pelo link",
          texto: "Pix com QR code ou boleto, e a baixa entra sozinha no financeiro.",
        },
        {
          titulo: "E acompanha a obra",
          texto: "Etapas, checklist, fotos e a próxima visita, sem as anotações internas da equipe.",
        },
      ],
    },
    relacionadas: ["aceite-online", "financeiro", "obras"],
  },
  financeiro: {
    titulo: "Financeiro",
    resumo: "A venda aprovada já lança a entrada, as parcelas e as comissões. Você só dá baixa.",
    icone: Wallet,
    grupo: "receber",
    principal: "lancamentos",
    recursos: ["lancamentos", "carteiras", "comissoes", "painel"],
    pagina: {
      titulo: "O financeiro nasce da",
      destaque: "venda",
      intro:
        "Confirmado o aceite, a entrada e as parcelas já estão lançadas, e a comissão do vendedor e do arquiteto acompanha as mesmas datas. As carteiras mostram o saldo de contas, caixa e cartões, e o painel do dia reúne o que vence e o resultado do mês.",
      passos: [
        {
          titulo: "A venda lança sozinha",
          texto: "Entrada, parcelas e comissões, com as parcelas de cada venda agrupadas.",
        },
        {
          titulo: "Você dá baixa",
          texto: "Uma a uma ou em lote, e o saldo da carteira se atualiza.",
        },
        {
          titulo: "O painel mostra o mês",
          texto: "O que vence, o que precisa de atenção, o vendido e o ticket médio.",
        },
      ],
    },
    relacionadas: ["fluxo-de-caixa-e-dre", "pos-venda"],
  },
  "fluxo-de-caixa-e-dre": {
    titulo: "Fluxo de caixa e DRE",
    resumo: "O saldo dos próximos meses em três cenários, o DRE do período e um link para o contador.",
    icone: TrendingUp,
    grupo: "receber",
    principal: "fluxo-de-caixa",
    recursos: ["fluxo-de-caixa", "dre", "link-do-contador"],
    pagina: {
      titulo: "Os próximos meses antes de",
      destaque: "eles chegarem",
      intro:
        "O fluxo de caixa parte do saldo das carteiras, soma o que entra e desconta o que sai, em três cenários: pessimista, realista e otimista. O DRE mostra receita, impostos, custos e despesas por caixa ou por competência, e o contador abre tudo por um link, sem login.",
      passos: [
        {
          titulo: "Projete o caixa",
          texto: "Ajuste o percentual recebido e os dias de atraso de cada cenário.",
        },
        {
          titulo: "Feche o período",
          texto: "Cada categoria ligada a uma linha do DRE, com até 12 meses lado a lado.",
        },
        {
          titulo: "Mande para o contador",
          texto: "Um link com o DRE, os lançamentos e as notas em PDF e XML, exportáveis para Excel.",
        },
      ],
    },
    relacionadas: ["financeiro", "notas-fiscais"],
  },
  "notas-fiscais": {
    titulo: "Notas fiscais",
    resumo: "NF-e e NFS-e emitidas da proposta ou do lançamento, e as notas de entrada chegando sozinhas.",
    icone: Receipt,
    grupo: "receber",
    principal: "notas-fiscais",
    recursos: ["notas-fiscais", "certificado", "notas-de-entrada"],
    pagina: {
      titulo: "A nota sai da venda, sem",
      destaque: "digitar de novo",
      intro:
        "Nota de produto e de serviço, no padrão nacional e no municipal, emitida a partir da proposta aprovada ou do lançamento. PDF e XML ficam guardados, com carta de correção e cancelamento. O certificado A1 avisa antes de vencer, e as notas que os fornecedores emitem para o seu CNPJ chegam sozinhas.",
      passos: [
        {
          titulo: "Configure uma vez",
          texto: "Certificado A1 e dados fiscais num passo a passo de quatro etapas.",
        },
        {
          titulo: "Emita da venda",
          texto: "A nota puxa o cliente e os itens da proposta ou do lançamento.",
        },
        {
          titulo: "Receba as de entrada",
          texto: "As notas emitidas para o seu CNPJ chegam de hora em hora e viram despesa com um clique.",
        },
      ],
    },
    relacionadas: ["fluxo-de-caixa-e-dre", "catalogo"],
  },
  lia: {
    titulo: "Lia, a IA da ProOps",
    resumo: "Peça em português: ela cria a proposta, lança, dá baixa ou move o lead, e só grava com o seu ok.",
    icone: Bot,
    grupo: "gerir",
    principal: "lia-acoes",
    recursos: ["lia-acoes", "lia-textos"],
    pagina: {
      titulo: "A Lia faz,",
      destaque: "você confirma",
      intro:
        "Converse em português com a Lia dentro do ERP. Ela cria propostas, cadastra contatos e produtos, lança e dá baixa em parcelas e move leads, sempre mostrando antes o que vai fazer. Também escreve descrições de produto, observações e seções do PDF para você revisar.",
      passos: [
        {
          titulo: "Peça",
          texto: "Do jeito que você falaria: a Ana pagou a parcela 2, dá baixa pra mim.",
        },
        {
          titulo: "Confira",
          texto: "A Lia mostra o que vai mudar e espera a sua confirmação.",
        },
        {
          titulo: "Pronto",
          texto: "Ela grava com as permissões de quem pediu: o que a pessoa não pode, a Lia também não faz.",
        },
      ],
    },
    relacionadas: ["financeiro", "propostas"],
  },
  "equipe-e-seguranca": {
    titulo: "Equipe e segurança",
    resumo: "Permissão por tela para cada pessoa, login em duas etapas e avisos que cada um escolhe.",
    icone: UserCog,
    grupo: "gerir",
    principal: "equipe",
    recursos: ["equipe", "duas-etapas", "notificacoes"],
    pagina: {
      titulo: "Cada pessoa vê",
      destaque: "o que precisa",
      intro:
        "Ver, criar, editar e excluir definidos por tela para cada pessoa da equipe, com perfis prontos para começar. A mudança vale na hora, sem novo login. O login pode pedir um segundo passo, pelo aplicativo autenticador ou por código no WhatsApp, e cada pessoa escolhe o que recebe no sino e por e-mail.",
      passos: [
        {
          titulo: "Convide a equipe",
          texto: "Parta de um perfil pronto para cada função.",
        },
        {
          titulo: "Ajuste por tela",
          texto: "Ver, criar, editar e excluir, tela por tela, valendo na hora.",
        },
        {
          titulo: "Proteja o login",
          texto: "Aplicativo autenticador ou código no WhatsApp, com códigos de recuperação.",
        },
      ],
    },
    relacionadas: ["lia", "no-dia-a-dia"],
  },
  "no-dia-a-dia": {
    titulo: "No dia a dia",
    resumo: "O ERP no celular, consultas pelo WhatsApp, planilhas, arquivos e um tutorial para começar.",
    icone: Smartphone,
    grupo: "gerir",
    principal: "celular",
    recursos: ["celular", "whatsapp", "planilhas", "documentos", "tutorial"],
    pagina: {
      titulo: "O ERP também no",
      destaque: "celular",
      intro:
        "O ERP inteiro se adapta à tela pequena e pode ser instalado na tela inicial. Pelo WhatsApp dá para consultar propostas, o resumo do dia e o saldo sem abrir o computador. Planilhas internas cobrem o que foge do fluxo, os arquivos ficam junto do que eles contam, e um tutorial leva a equipe tela a tela.",
      passos: [
        {
          titulo: "Instale no celular",
          texto: "Na tela inicial, como um aplicativo, com a navegação embaixo.",
        },
        {
          titulo: "Consulte pelo WhatsApp",
          texto: "Propostas com PDF, resumo do dia e da semana, saldo e lançamentos, numa conversa.",
        },
        {
          titulo: "Comece sem treinamento",
          texto: "O tutorial guiado e o painel de ajuda de cada tela explicam o que ela faz.",
        },
      ],
    },
    relacionadas: ["equipe-e-seguranca", "lia"],
  },
};

/** As funcionalidades na ordem da lista. */
export const FUNCIONALIDADES: readonly Funcionalidade[] = FUNCIONALIDADE_SLUGS.map((slug) => ({
  slug,
  ...CONTEUDO[slug],
}));

/** Os grupos da lista, na ordem em que uma venda de projeto passa por eles. */
export const GRUPOS_DE_FUNCIONALIDADES: readonly GrupoDeFuncionalidades[] = [
  { id: "vender", titulo: "Vender", resumo: "Do primeiro contato à proposta aceita." },
  { id: "entregar", titulo: "Entregar", resumo: "A obra, a agenda e o cliente acompanhando pelo link." },
  { id: "receber", titulo: "Receber", resumo: "Parcelas, caixa, DRE e nota fiscal." },
  { id: "gerir", titulo: "Gerir a empresa", resumo: "A Lia, a equipe e o ERP no bolso." },
];

export function funcionalidade(slug: FuncionalidadeSlug): Funcionalidade {
  return { slug, ...CONTEUDO[slug] };
}

/** A funcionalidade que reúne um recurso do catálogo. */
export function funcionalidadeDoRecurso(recursoId: string): Funcionalidade {
  const dona = FUNCIONALIDADES.find((f) => f.recursos.includes(recursoId));
  if (!dona) throw new Error(`Recurso sem funcionalidade: ${recursoId}`);
  return dona;
}
