# 12-TOOLS — Definições de Tools da Lia

> Documentação de todas as tools disponíveis para a Lia.
> O código real fica em `functions/src/ai/tools/definitions.ts`.
> Use este arquivo como referência ao implementar novas tools.

---

## Princípios

1. **Cada tool chama um service existente** — nunca acessa o Firestore diretamente.
2. **Toda tool tem validação Zod** nos parâmetros antes de executar.
3. **Tools filtradas por módulo + role** — a Lia nunca recebe a definição de uma tool inativa.
4. **`tenantId` nunca é parâmetro** — sempre vem do contexto de auth.

---

## Matriz de disponibilidade

| Tool | Módulo necessário | Role mínimo | Plano mínimo |
|---|---|---|---|
| `get_tenant_summary` | — | member | starter |
| `search_help` | — | member | starter |
| `list_proposals` | proposals | member | starter |
| `get_proposal` | proposals | member | starter |
| `create_proposal` | proposals | member | starter |
| `update_proposal` | proposals | admin | starter |
| `update_proposal_status` | proposals | member | starter |
| `delete_proposal` | proposals | admin | starter |
| `list_contacts` | contacts | member | starter |
| `get_contact` | contacts | member | starter |
| `create_contact` | contacts | member | starter |
| `update_contact` | contacts | admin | starter |
| `delete_contact` | contacts | admin | starter |
| `list_products` | products | member | starter |
| `get_product` | products | member | starter |
| `create_product` | products | member | starter |
| `update_product` | products | admin | starter |
| `delete_product` | products | admin | starter |
| `list_transactions` | financial | member | pro |
| `create_transaction` | financial | member | pro |
| `list_wallets` | financial | member | pro |
| `create_wallet` | financial | admin | pro |
| `transfer_between_wallets` | financial | admin | pro |
| `delete_transaction` | financial | admin | pro |
| `pay_installment` | financial | admin | pro |
| `list_crm_leads` | crm | member | pro |
| `update_crm_status` | crm | member | pro |
| `send_whatsapp_message` | whatsapp | admin | enterprise |
| `request_confirmation` | — | member | starter |

---

## Definições completas

### Utilitárias (sempre disponíveis)

```typescript
const get_tenant_summary: ToolDefinition = {
  name: 'get_tenant_summary',
  description: 'Retorna um resumo do tenant atual: plano, módulos ativos, uso do mês e limites. Use quando o usuário perguntar sobre o plano, limites ou o que pode fazer.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

const search_help: ToolDefinition = {
  name: 'search_help',
  description: 'Busca informações de ajuda sobre funcionalidades do ProOps. Use quando o usuário perguntar "como fazer X" ou "o que é Y".',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Dúvida ou funcionalidade a pesquisar',
      },
    },
    required: ['query'],
  },
};

const request_confirmation: ToolDefinition = {
  name: 'request_confirmation',
  description: `
    OBRIGATÓRIO antes de qualquer ação destrutiva (DELETE) ou edição em massa (>10 registros).
    Envia um pedido de confirmação para o usuário via frontend.
    Só prossiga com a ação após receber confirmed=true no próximo turno.
    NUNCA execute delete sem chamar esta tool primeiro.
  `.trim(),
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Descrição clara e em português do que será executado. Ex: "Deletar o contato João Silva e todos os seus dados".',
      },
      affectedRecords: {
        type: 'array',
        description: 'Lista de registros que serão afetados, com nome legível. Ex: ["João Silva (contato)", "Proposta #42"].',
        items: { type: 'string' },
      },
      severity: {
        type: 'string',
        enum: ['low', 'high'],
        description: 'high para ações irreversíveis (delete permanente). low para edições em massa.',
      },
    },
    required: ['action', 'affectedRecords', 'severity'],
  },
};
```

### Propostas

```typescript
const list_proposals: ToolDefinition = {
  name: 'list_proposals',
  description: 'Lista as propostas do tenant. Suporta filtro por status e busca por texto.',
  parameters: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['draft', 'sent', 'approved', 'rejected'],
        description: 'Filtrar por status (opcional)',
      },
      search: {
        type: 'string',
        description: 'Busca por texto no título ou nome do cliente (opcional)',
      },
      limit: {
        type: 'number',
        description: 'Número máximo de resultados. Default: 10. Máximo: 50.',
      },
    },
    required: [],
  },
};

const get_proposal: ToolDefinition = {
  name: 'get_proposal',
  description: 'Retorna os detalhes completos de uma proposta específica.',
  parameters: {
    type: 'object',
    properties: {
      proposalId: { type: 'string', description: 'ID da proposta' },
    },
    required: ['proposalId'],
  },
};

const create_proposal: ToolDefinition = {
  name: 'create_proposal',
  description: `
    Cria uma nova proposta comercial.
    IMPORTANTE: Verifique o limite de propostas na seção "Limites e uso atual" ANTES de chamar esta tool.
    Se o limite foi atingido, informe o usuário sem chamar a tool.
  `.trim(),
  parameters: {
    type: 'object',
    properties: {
      clientId: {
        type: 'string',
        description: 'ID do cliente. Se não souber o ID, use list_contacts para buscar primeiro.',
      },
      title: {
        type: 'string',
        description: 'Título da proposta',
      },
      items: {
        type: 'array',
        description: 'Produtos/serviços incluídos na proposta',
        items: {
          type: 'object',
          properties: {
            productId: { type: 'string', description: 'ID do produto' },
            quantity: { type: 'number', description: 'Quantidade' },
            unitPrice: { type: 'number', description: 'Preço unitário em reais (ex: 1500.00)' },
            description: { type: 'string', description: 'Descrição do item (opcional)' },
          },
          required: ['productId', 'quantity', 'unitPrice'],
        },
      },
      notes: {
        type: 'string',
        description: 'Observações ou condições especiais (opcional)',
      },
      validUntil: {
        type: 'string',
        description: 'Data de validade no formato dd/MM/yyyy (opcional)',
      },
      discount: {
        type: 'number',
        description: 'Desconto percentual (0-100). Ex: 10 para 10% de desconto. (opcional)',
      },
    },
    required: ['clientId', 'title', 'items'],
  },
};

const update_proposal_status: ToolDefinition = {
  name: 'update_proposal_status',
  description: `
    Atualiza o status de uma proposta.
    Transições válidas: draft→sent, sent→approved, sent→rejected.
    Propostas aprovadas/rejeitadas não podem ter status alterado.
    ATENÇÃO: Aprovar uma proposta (sent→approved) cria automaticamente transações financeiras.
  `.trim(),
  parameters: {
    type: 'object',
    properties: {
      proposalId: { type: 'string' },
      newStatus: {
        type: 'string',
        enum: ['sent', 'approved', 'rejected'],
        description: 'Novo status da proposta',
      },
      reason: {
        type: 'string',
        description: 'Motivo da rejeição (obrigatório se newStatus = rejected)',
      },
    },
    required: ['proposalId', 'newStatus'],
  },
};

const update_proposal: ToolDefinition = {
  name: 'update_proposal',
  description: 'Edita uma proposta existente. Só é possível editar propostas com status draft.',
  parameters: {
    type: 'object',
    properties: {
      proposalId: { type: 'string' },
      title: { type: 'string', description: 'Novo título (opcional)' },
      items: {
        type: 'array',
        description: 'Lista atualizada de itens. Substitui os itens existentes (opcional).',
        items: {
          type: 'object',
          properties: {
            productId: { type: 'string' },
            quantity: { type: 'number' },
            unitPrice: { type: 'number' },
            description: { type: 'string' },
          },
          required: ['productId', 'quantity', 'unitPrice'],
        },
      },
      notes: { type: 'string' },
      validUntil: { type: 'string', description: 'dd/MM/yyyy' },
      discount: { type: 'number' },
    },
    required: ['proposalId'],
  },
};

const delete_proposal: ToolDefinition = {
  name: 'delete_proposal',
  description: `
    Deleta uma proposta permanentemente.
    OBRIGATÓRIO: Chame request_confirmation ANTES desta tool.
    Só execute se confirmed=true foi recebido no turno atual.
  `.trim(),
  parameters: {
    type: 'object',
    properties: {
      proposalId: { type: 'string' },
      confirmed: {
        type: 'boolean',
        description: 'Deve ser true. Indica que request_confirmation foi chamada e o usuário confirmou.',
      },
    },
    required: ['proposalId', 'confirmed'],
  },
};
```

### Clientes / Contatos

```typescript
const list_contacts: ToolDefinition = {
  name: 'list_contacts',
  description: 'Lista os clientes/contatos do tenant. Suporta busca por nome, email ou documento.',
  parameters: {
    type: 'object',
    properties: {
      search: { type: 'string', description: 'Busca por nome, email ou CPF/CNPJ' },
      limit: { type: 'number', description: 'Default: 10. Máximo: 50.' },
    },
    required: [],
  },
};

const create_contact: ToolDefinition = {
  name: 'create_contact',
  description: `
    Cria um novo cliente/contato.
    IMPORTANTE: Verifique o limite de clientes antes de chamar.
  `.trim(),
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Nome completo ou razão social' },
      email: { type: 'string', description: 'Email (opcional)' },
      phone: { type: 'string', description: 'Telefone com DDD, ex: 11999999999 (opcional)' },
      document: { type: 'string', description: 'CPF ou CNPJ sem formatação (opcional)' },
      address: {
        type: 'object',
        description: 'Endereço (opcional)',
        properties: {
          street: { type: 'string' },
          number: { type: 'string' },
          complement: { type: 'string' },
          city: { type: 'string' },
          state: { type: 'string', description: 'Sigla do estado, ex: SP' },
          zipCode: { type: 'string', description: 'CEP sem formatação' },
        },
      },
      notes: { type: 'string', description: 'Observações (opcional)' },
    },
    required: ['name'],
  },
};

// delete_contact segue o mesmo padrão de delete_proposal (confirmed obrigatório)
```

### Financeiro

```typescript
const list_transactions: ToolDefinition = {
  name: 'list_transactions',
  description: 'Lista transações financeiras. Suporta filtro por tipo, data e carteira.',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['income', 'expense'],
        description: 'Filtrar por tipo: income (receita) ou expense (despesa). (opcional)',
      },
      walletId: { type: 'string', description: 'Filtrar por carteira (opcional)' },
      startDate: { type: 'string', description: 'Data inicial dd/MM/yyyy (opcional)' },
      endDate: { type: 'string', description: 'Data final dd/MM/yyyy (opcional)' },
      limit: { type: 'number', description: 'Default: 20. Máximo: 100.' },
    },
    required: [],
  },
};

const create_transaction: ToolDefinition = {
  name: 'create_transaction',
  description: 'Cria uma transação financeira de entrada (receita) ou saída (despesa).',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['income', 'expense'],
        description: 'income para receita, expense para despesa',
      },
      description: { type: 'string', description: 'Descrição da transação' },
      amount: { type: 'number', description: 'Valor em reais (ex: 1500.00). Sempre positivo.' },
      walletId: { type: 'string', description: 'ID da carteira onde lançar. Use list_wallets se não souber.' },
      category: { type: 'string', description: 'Categoria da transação' },
      date: { type: 'string', description: 'Data da transação em dd/MM/yyyy' },
      installments: {
        type: 'number',
        description: 'Número de parcelas (opcional, default 1). Máximo: 60.',
      },
      proposalId: {
        type: 'string',
        description: 'ID da proposta relacionada (opcional, para vincular)',
      },
    },
    required: ['type', 'description', 'amount', 'walletId', 'date'],
  },
};

const list_wallets: ToolDefinition = {
  name: 'list_wallets',
  description: 'Lista as carteiras financeiras do tenant com saldos atuais.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

const transfer_between_wallets: ToolDefinition = {
  name: 'transfer_between_wallets',
  description: 'Transfere valor entre duas carteiras do tenant.',
  parameters: {
    type: 'object',
    properties: {
      fromWalletId: { type: 'string', description: 'ID da carteira de origem' },
      toWalletId: { type: 'string', description: 'ID da carteira de destino' },
      amount: { type: 'number', description: 'Valor a transferir em reais' },
      description: { type: 'string', description: 'Descrição da transferência (opcional)' },
    },
    required: ['fromWalletId', 'toWalletId', 'amount'],
  },
};

const pay_installment: ToolDefinition = {
  name: 'pay_installment',
  description: 'Marca uma parcela específica de uma transação como paga.',
  parameters: {
    type: 'object',
    properties: {
      transactionId: { type: 'string' },
      installmentNumber: { type: 'number', description: 'Número da parcela (começa em 1)' },
      paidAt: { type: 'string', description: 'Data de pagamento em dd/MM/yyyy (opcional, default hoje)' },
    },
    required: ['transactionId', 'installmentNumber'],
  },
};
```

### WhatsApp (Enterprise)

```typescript
const send_whatsapp_message: ToolDefinition = {
  name: 'send_whatsapp_message',
  description: `
    Envia uma mensagem via WhatsApp Business para um contato cadastrado.
    RESTRIÇÕES: Só para contatos com número cadastrado. Respeita templates aprovados pela Meta.
    Não use para mensagens em massa sem request_confirmation.
  `.trim(),
  parameters: {
    type: 'object',
    properties: {
      contactId: { type: 'string', description: 'ID do contato (deve ter número de WhatsApp cadastrado)' },
      message: { type: 'string', description: 'Texto da mensagem (máximo 4.096 caracteres)' },
      templateName: {
        type: 'string',
        description: 'Nome do template aprovado pela Meta (opcional, para mensagens fora da janela de 24h)',
      },
    },
    required: ['contactId', 'message'],
  },
};
```

---

## Adicionando novas tools

Ao implementar um novo módulo que a Lia deve suportar:

1. Adicionar a definição aqui neste arquivo
2. Atualizar a matriz de disponibilidade no topo
3. Adicionar o handler em `functions/src/ai/tools/executor.ts`
4. Adicionar o schema Zod em `functions/src/ai/tools/schemas.ts`
5. Registrar no `buildAvailableTools()` em `functions/src/ai/tools/index.ts`
6. Atualizar `12-LIA-PROMPT.md` se a tool precisar de instruções especiais
7. Adicionar caso de teste E2E correspondente