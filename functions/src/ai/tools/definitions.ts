import { SchemaType, type FunctionDeclaration } from "@google/generative-ai";

/**
 * All 29 FunctionDeclaration objects for the Lia AI assistant.
 * Descriptions in Portuguese as specified in 12-TOOLS.md.
 * Uses SchemaType enum values — never string literals.
 */
export const TOOL_DEFINITIONS: Record<string, FunctionDeclaration> = {
  // ─── Utilities (always available) ──────────────────────────────────────────

  get_tenant_summary: {
    name: "get_tenant_summary",
    description:
      "Retorna um resumo do tenant atual: plano, módulos ativos, uso do mês e limites. Use quando o usuário perguntar sobre o plano, limites ou o que pode fazer.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
      required: [],
    },
  },

  search_help: {
    name: "search_help",
    description:
      "Busca informações de ajuda sobre funcionalidades do ProOps. Use quando o usuário perguntar \"como fazer X\" ou \"o que é Y\".",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: {
          type: SchemaType.STRING,
          description: "Dúvida ou funcionalidade a pesquisar",
        },
      },
      required: ["query"],
    },
  },

  request_confirmation: {
    name: "request_confirmation",
    description:
      "OBRIGATÓRIO antes de qualquer ação financeira (create_transaction, transfer_between_wallets, pay_installment), ação destrutiva (DELETE) ou edição em massa (>10 registros). Envia um pedido de confirmação para o usuário via frontend. Só prossiga com a ação após receber confirmed=true no próximo turno. NUNCA execute operações financeiras ou delete sem chamar esta tool primeiro.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        action: {
          type: SchemaType.STRING,
          description:
            "Descrição clara e em português do que será executado. Ex: \"Deletar o contato João Silva e todos os seus dados\".",
        },
        affectedRecords: {
          type: SchemaType.ARRAY,
          description:
            "Lista de registros que serão afetados, com nome legível. Ex: [\"João Silva (contato)\", \"Proposta #42\"].",
          items: { type: SchemaType.STRING },
        },
        severity: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["low", "high"],
          description:
            "high para ações irreversíveis (delete permanente). low para edições em massa.",
        },
      },
      required: ["action", "affectedRecords", "severity"],
    },
  },

  // ─── Proposals ─────────────────────────────────────────────────────────────

  list_proposals: {
    name: "list_proposals",
    description:
      "Lista as propostas do tenant. Suporta filtro por status, busca por texto e ordenação.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        status: {
          type: SchemaType.STRING,
          description:
            "Filtrar por status: draft, sent, approved, rejected (opcional). Omita para listar todos.",
        },
        search: {
          type: SchemaType.STRING,
          description: "Busca por texto no título ou nome do cliente (opcional)",
        },
        limit: {
          type: SchemaType.NUMBER,
          description: "Número máximo de resultados. Default: 10. Máximo: 50.",
        },
        orderBy: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["createdAt", "updatedAt", "title", "clientName"],
          description:
            "Campo de ordenação. Valores: createdAt (data de criação), updatedAt (última atualização), title (título), clientName (nome do cliente). Default: createdAt.",
        },
        direction: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["asc", "desc"],
          description:
            "Direção da ordenação: asc (mais antigo primeiro) ou desc (mais recente primeiro). Default: desc.",
        },
      },
      required: [],
    },
  },

  get_proposal: {
    name: "get_proposal",
    description: "Retorna os detalhes completos de uma proposta específica.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        proposalId: {
          type: SchemaType.STRING,
          description: "ID da proposta",
        },
      },
      required: ["proposalId"],
    },
  },

  create_proposal: {
    name: "create_proposal",
    description:
      "Cria uma nova proposta comercial. IMPORTANTE: Verifique o limite de propostas na seção \"Limites e uso atual\" ANTES de chamar esta tool. Se o limite foi atingido, informe o usuário sem chamar a tool.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        clientId: {
          type: SchemaType.STRING,
          description:
            "ID do cliente. Se não souber o ID, use list_contacts para buscar primeiro.",
        },
        title: {
          type: SchemaType.STRING,
          description: "Título da proposta",
        },
        items: {
          type: SchemaType.ARRAY,
          description: "Produtos/serviços incluídos na proposta",
          items: {
            type: SchemaType.OBJECT,
            properties: {
              productId: {
                type: SchemaType.STRING,
                description: "ID do produto",
              },
              quantity: {
                type: SchemaType.NUMBER,
                description: "Quantidade",
              },
              unitPrice: {
                type: SchemaType.NUMBER,
                description: "Preço unitário em reais (ex: 1500.00)",
              },
              description: {
                type: SchemaType.STRING,
                description: "Descrição do item (opcional)",
              },
            },
            required: ["productId", "quantity", "unitPrice"],
          },
        },
        notes: {
          type: SchemaType.STRING,
          description: "Observações ou condições especiais (opcional)",
        },
        validUntil: {
          type: SchemaType.STRING,
          description: "Data de validade no formato dd/MM/yyyy (opcional)",
        },
        discount: {
          type: SchemaType.NUMBER,
          description:
            "Desconto percentual (0-100). Ex: 10 para 10% de desconto. (opcional)",
        },
      },
      required: ["clientId", "title", "items"],
    },
  },

  update_proposal: {
    name: "update_proposal",
    description:
      "Edita uma proposta existente. Só é possível editar propostas com status draft.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        proposalId: { type: SchemaType.STRING },
        title: {
          type: SchemaType.STRING,
          description: "Novo título (opcional)",
        },
        items: {
          type: SchemaType.ARRAY,
          description:
            "Lista atualizada de itens. Substitui os itens existentes (opcional).",
          items: {
            type: SchemaType.OBJECT,
            properties: {
              productId: { type: SchemaType.STRING },
              quantity: { type: SchemaType.NUMBER },
              unitPrice: { type: SchemaType.NUMBER },
              description: { type: SchemaType.STRING },
            },
            required: ["productId", "quantity", "unitPrice"],
          },
        },
        notes: { type: SchemaType.STRING },
        validUntil: {
          type: SchemaType.STRING,
          description: "dd/MM/yyyy",
        },
        discount: { type: SchemaType.NUMBER },
      },
      required: ["proposalId"],
    },
  },

  update_proposal_status: {
    name: "update_proposal_status",
    description:
      "Atualiza o status de uma proposta. Transições válidas: draft→sent, sent→approved, sent→rejected. Propostas aprovadas/rejeitadas não podem ter status alterado. ATENÇÃO: Aprovar uma proposta (sent→approved) cria automaticamente transações financeiras.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        proposalId: { type: SchemaType.STRING },
        newStatus: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["sent", "approved", "rejected"],
          description: "Novo status da proposta",
        },
        reason: {
          type: SchemaType.STRING,
          description: "Motivo da rejeição (obrigatório se newStatus = rejected)",
        },
      },
      required: ["proposalId", "newStatus"],
    },
  },

  delete_proposal: {
    name: "delete_proposal",
    description:
      "Deleta uma proposta permanentemente. OBRIGATÓRIO: Chame request_confirmation ANTES desta tool. Só execute se confirmed=true foi recebido no turno atual.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        proposalId: { type: SchemaType.STRING },
        confirmed: {
          type: SchemaType.BOOLEAN,
          description:
            "Deve ser true. Indica que request_confirmation foi chamada e o usuário confirmou.",
        },
      },
      required: ["proposalId", "confirmed"],
    },
  },

  // ─── Contacts ──────────────────────────────────────────────────────────────

  list_contacts: {
    name: "list_contacts",
    description:
      "Lista os clientes/contatos do tenant. Suporta busca por nome, email ou documento e ordenação.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        search: {
          type: SchemaType.STRING,
          description: "Busca por nome, email ou CPF/CNPJ",
        },
        limit: {
          type: SchemaType.NUMBER,
          description: "Default: 10. Máximo: 50.",
        },
        orderBy: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["createdAt", "name", "updatedAt"],
          description:
            "Campo de ordenação. Valores: createdAt (data de criação), name (nome), updatedAt (última atualização). Default: createdAt.",
        },
        direction: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["asc", "desc"],
          description:
            "Direção da ordenação: asc (mais antigo primeiro) ou desc (mais recente primeiro). Default: desc.",
        },
      },
      required: [],
    },
  },

  get_contact: {
    name: "get_contact",
    description: "Retorna os detalhes completos de um contato/cliente específico.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        contactId: {
          type: SchemaType.STRING,
          description: "ID do contato",
        },
      },
      required: ["contactId"],
    },
  },

  create_contact: {
    name: "create_contact",
    description:
      "Cria um novo cliente/contato. IMPORTANTE: Verifique o limite de clientes antes de chamar.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        name: {
          type: SchemaType.STRING,
          description: "Nome completo ou razão social",
        },
        email: {
          type: SchemaType.STRING,
          description: "Email (opcional)",
        },
        phone: {
          type: SchemaType.STRING,
          description: "Telefone com DDD, ex: 11999999999 (opcional)",
        },
        document: {
          type: SchemaType.STRING,
          description: "CPF ou CNPJ sem formatação (opcional)",
        },
        address: {
          type: SchemaType.OBJECT,
          description: "Endereço (opcional)",
          properties: {
            street: { type: SchemaType.STRING },
            number: { type: SchemaType.STRING },
            complement: { type: SchemaType.STRING },
            city: { type: SchemaType.STRING },
            state: {
              type: SchemaType.STRING,
              description: "Sigla do estado, ex: SP",
            },
            zipCode: {
              type: SchemaType.STRING,
              description: "CEP sem formatação",
            },
          },
          required: [],
        },
        notes: {
          type: SchemaType.STRING,
          description: "Observações (opcional)",
        },
      },
      required: ["name"],
    },
  },

  update_contact: {
    name: "update_contact",
    description: "Atualiza os dados de um contato/cliente existente.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        contactId: {
          type: SchemaType.STRING,
          description: "ID do contato",
        },
        name: { type: SchemaType.STRING },
        email: { type: SchemaType.STRING },
        phone: { type: SchemaType.STRING },
        document: { type: SchemaType.STRING },
        address: {
          type: SchemaType.OBJECT,
          properties: {
            street: { type: SchemaType.STRING },
            number: { type: SchemaType.STRING },
            complement: { type: SchemaType.STRING },
            city: { type: SchemaType.STRING },
            state: { type: SchemaType.STRING },
            zipCode: { type: SchemaType.STRING },
          },
          required: [],
        },
        notes: { type: SchemaType.STRING },
      },
      required: ["contactId"],
    },
  },

  delete_contact: {
    name: "delete_contact",
    description:
      "Deleta um contato/cliente permanentemente. OBRIGATÓRIO: Chame request_confirmation ANTES desta tool. Só execute se confirmed=true foi recebido no turno atual.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        contactId: { type: SchemaType.STRING },
        confirmed: {
          type: SchemaType.BOOLEAN,
          description:
            "Deve ser true. Indica que request_confirmation foi chamada e o usuário confirmou.",
        },
      },
      required: ["contactId", "confirmed"],
    },
  },

  // ─── Products ──────────────────────────────────────────────────────────────

  list_products: {
    name: "list_products",
    description:
      "Lista os produtos do tenant. Suporta busca por nome, filtro por categoria e ordenação.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        search: {
          type: SchemaType.STRING,
          description: "Busca por nome do produto (opcional)",
        },
        limit: {
          type: SchemaType.NUMBER,
          description: "Default: 10. Máximo: 50.",
        },
        category: {
          type: SchemaType.STRING,
          description: "Filtrar por categoria (opcional)",
        },
        orderBy: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["createdAt", "name", "price", "updatedAt"],
          description:
            "Campo de ordenação. Valores: createdAt (data de criação), name (nome), price (preço), updatedAt (última atualização). Default: createdAt.",
        },
        direction: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["asc", "desc"],
          description:
            "Direção da ordenação: asc (mais antigo primeiro) ou desc (mais recente primeiro). Default: desc.",
        },
      },
      required: [],
    },
  },

  get_product: {
    name: "get_product",
    description: "Retorna os detalhes completos de um produto específico.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        productId: {
          type: SchemaType.STRING,
          description: "ID do produto",
        },
      },
      required: ["productId"],
    },
  },

  create_product: {
    name: "create_product",
    description:
      "Cria um novo produto no catálogo do tenant. OBRIGATÓRIO: Colete nome, preço, categoria e fabricante do usuário ANTES de chamar esta tool. Nunca assuma valores padrão para esses campos.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        name: {
          type: SchemaType.STRING,
          description: "Nome do produto",
        },
        price: {
          type: SchemaType.NUMBER,
          description: "Preço de venda em reais (ex: 1500.00)",
        },
        category: {
          type: SchemaType.STRING,
          description: "Categoria do produto (ex: Automação, Iluminação, Câmeras)",
        },
        manufacturer: {
          type: SchemaType.STRING,
          description: "Fabricante ou fornecedor do produto",
        },
        description: {
          type: SchemaType.STRING,
          description: "Descrição do produto (opcional)",
        },
      },
      required: ["name", "price", "category", "manufacturer"],
    },
  },

  update_product: {
    name: "update_product",
    description: "Atualiza os dados de um produto existente no catálogo.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        productId: {
          type: SchemaType.STRING,
          description: "ID do produto",
        },
        name: { type: SchemaType.STRING },
        description: { type: SchemaType.STRING },
        price: { type: SchemaType.NUMBER },
        category: { type: SchemaType.STRING },
        manufacturer: { type: SchemaType.STRING },
      },
      required: ["productId"],
    },
  },

  delete_product: {
    name: "delete_product",
    description:
      "Deleta um produto do catálogo permanentemente. OBRIGATÓRIO: Chame request_confirmation ANTES desta tool. Só execute se confirmed=true foi recebido no turno atual.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        productId: { type: SchemaType.STRING },
        confirmed: {
          type: SchemaType.BOOLEAN,
          description:
            "Deve ser true. Indica que request_confirmation foi chamada e o usuário confirmou.",
        },
      },
      required: ["productId", "confirmed"],
    },
  },

  // ─── Financial ─────────────────────────────────────────────────────────────

  list_transactions: {
    name: "list_transactions",
    description:
      "Lista transações financeiras. Suporta filtro por tipo, data e carteira.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        type: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["income", "expense"],
          description:
            "Filtrar por tipo: income (receita) ou expense (despesa). (opcional)",
        },
        walletId: {
          type: SchemaType.STRING,
          description: "Filtrar por carteira (opcional)",
        },
        startDate: {
          type: SchemaType.STRING,
          description: "Data inicial dd/MM/yyyy (opcional)",
        },
        endDate: {
          type: SchemaType.STRING,
          description: "Data final dd/MM/yyyy (opcional)",
        },
        limit: {
          type: SchemaType.NUMBER,
          description: "Default: 20. Máximo: 100.",
        },
      },
      required: [],
    },
  },

  create_transaction: {
    name: "create_transaction",
    description:
      "Cria uma transação financeira de entrada (receita) ou saída (despesa).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        type: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["income", "expense"],
          description: "income para receita, expense para despesa",
        },
        description: {
          type: SchemaType.STRING,
          description: "Descrição da transação",
        },
        amount: {
          type: SchemaType.NUMBER,
          description: "Valor em reais (ex: 1500.00). Sempre positivo.",
        },
        walletId: {
          type: SchemaType.STRING,
          description:
            "ID da carteira onde lançar. Use list_wallets se não souber.",
        },
        date: {
          type: SchemaType.STRING,
          description: "Data da transação em dd/MM/yyyy",
        },
        category: {
          type: SchemaType.STRING,
          description: "Categoria da transação",
        },
        installments: {
          type: SchemaType.NUMBER,
          description: "Número de parcelas (opcional, default 1). Máximo: 60.",
        },
        proposalId: {
          type: SchemaType.STRING,
          description: "ID da proposta relacionada (opcional, para vincular)",
        },
      },
      required: ["type", "description", "amount", "walletId", "date"],
    },
  },

  list_wallets: {
    name: "list_wallets",
    description:
      "Lista as carteiras financeiras do tenant com saldos atuais.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
      required: [],
    },
  },

  create_wallet: {
    name: "create_wallet",
    description: "Cria uma nova carteira financeira para o tenant.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        name: {
          type: SchemaType.STRING,
          description: "Nome da carteira (deve ser único por tenant)",
        },
        type: {
          type: SchemaType.STRING,
          description: "Tipo da carteira (ex: conta_corrente, poupanca, cartao_credito)",
        },
        color: {
          type: SchemaType.STRING,
          description: "Cor da carteira em hex ou nome (ex: #3B82F6)",
        },
        description: {
          type: SchemaType.STRING,
          description: "Descrição da carteira (opcional)",
        },
        initialBalance: {
          type: SchemaType.NUMBER,
          description: "Saldo inicial em reais (opcional, default 0)",
        },
      },
      required: ["name", "type", "color"],
    },
  },

  transfer_between_wallets: {
    name: "transfer_between_wallets",
    description: "Transfere valor entre duas carteiras do tenant.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        fromWalletId: {
          type: SchemaType.STRING,
          description: "ID da carteira de origem",
        },
        toWalletId: {
          type: SchemaType.STRING,
          description: "ID da carteira de destino",
        },
        amount: {
          type: SchemaType.NUMBER,
          description: "Valor a transferir em reais",
        },
        description: {
          type: SchemaType.STRING,
          description: "Descrição da transferência (opcional)",
        },
      },
      required: ["fromWalletId", "toWalletId", "amount"],
    },
  },

  delete_transaction: {
    name: "delete_transaction",
    description:
      "Deleta uma transação financeira permanentemente. OBRIGATÓRIO: Chame request_confirmation ANTES desta tool. Só execute se confirmed=true foi recebido no turno atual.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        transactionId: { type: SchemaType.STRING },
        confirmed: {
          type: SchemaType.BOOLEAN,
          description:
            "Deve ser true. Indica que request_confirmation foi chamada e o usuário confirmou.",
        },
      },
      required: ["transactionId", "confirmed"],
    },
  },

  pay_installment: {
    name: "pay_installment",
    description: "Marca uma parcela específica de uma transação como paga.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        transactionId: { type: SchemaType.STRING },
        installmentNumber: {
          type: SchemaType.NUMBER,
          description: "Número da parcela (começa em 1)",
        },
        paidAt: {
          type: SchemaType.STRING,
          description:
            "Data de pagamento em dd/MM/yyyy (opcional, default hoje)",
        },
      },
      required: ["transactionId", "installmentNumber"],
    },
  },

  // ─── CRM ───────────────────────────────────────────────────────────────────

  list_crm_leads: {
    name: "list_crm_leads",
    description:
      "Lista propostas do pipeline CRM/Kanban, filtradas por coluna de status.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        status: {
          type: SchemaType.STRING,
          description: "Filtrar por coluna de status do kanban (opcional)",
        },
        limit: {
          type: SchemaType.NUMBER,
          description: "Default: 20. Máximo: 50.",
        },
      },
      required: [],
    },
  },

  update_crm_status: {
    name: "update_crm_status",
    description:
      "Move uma proposta para outra coluna do pipeline CRM/Kanban.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        proposalId: {
          type: SchemaType.STRING,
          description: "ID da proposta a mover",
        },
        newStatusId: {
          type: SchemaType.STRING,
          description: "ID da coluna de destino no kanban",
        },
      },
      required: ["proposalId", "newStatusId"],
    },
  },

  // ─── WhatsApp (Enterprise) ─────────────────────────────────────────────────

  send_whatsapp_message: {
    name: "send_whatsapp_message",
    description:
      "Envia uma mensagem via WhatsApp Business para um contato cadastrado. RESTRIÇÕES: Só para contatos com número cadastrado. Respeita templates aprovados pela Meta. Não use para mensagens em massa sem request_confirmation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        contactId: {
          type: SchemaType.STRING,
          description:
            "ID do contato (deve ter número de WhatsApp cadastrado)",
        },
        message: {
          type: SchemaType.STRING,
          description: "Texto da mensagem (máximo 4.096 caracteres)",
        },
        templateName: {
          type: SchemaType.STRING,
          description:
            "Nome do template aprovado pela Meta (opcional, para mensagens fora da janela de 24h)",
        },
      },
      required: ["contactId", "message"],
    },
  },
};
