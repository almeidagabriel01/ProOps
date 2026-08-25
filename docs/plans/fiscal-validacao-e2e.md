# Roteiro de validação ponta a ponta — Módulo Fiscal

> Documento operacional. Serve para a primeira validação real, com certificado
> em mãos, e para toda revalidação depois de mexer no módulo.
>
> Estado em 25/08/2026: emissão completa e recepção na Fase 1, ambas construídas
> **contra a especificação, sem nunca ter batido na API real**. Espere uma ou
> duas rodadas de ajuste — o mapeamento está concentrado em
> `focus-payload.ts`, `focus-response.ts` e `received-invoice-mapper.ts`
> justamente para isso ser correção localizada.

---

## Pré-requisitos

| Item | Onde | Estado |
|---|---|---|
| `FOCUS_NFE_MASTER_TOKEN` | `apps/functions/.env.erp-softcode` | ✅ preenchido |
| Certificado A1 (`.pfx`) + senha | do CNPJ do sócio | ⏳ com o contador |
| `FISCAL_SECRET_KMS_*` | `.env.erp-softcode` | ⚠️ **verificar** |
| Empresa já emite nota hoje | — | ✅ (credenciamento SEFAZ/prefeitura feito) |

**KMS — resolvido em 25/08/2026.** Chaves dedicadas criadas e validadas:

| Ambiente | Chave | Round-trip testado |
|---|---|---|
| dev | `projects/erp-softcode/.../cryptoKeys/fiscal-secrets` | ✅ |
| prod | `projects/erp-softcode-prod/.../cryptoKeys/fiscal-secrets` | ✅ |

A service account do Cloud Run de cada projeto tem
`roles/cloudkms.cryptoKeyEncrypterDecrypter` na respectiva chave. Revalidar a
qualquer momento:

```bash
cd apps/functions
GCLOUD_PROJECT=erp-softcode FISCAL_SECRET_KMS_KEY="projects/erp-softcode/locations/southamerica-east1/keyRings/proops-oauth/cryptoKeys/fiscal-secrets" npx tsx src/scripts/kms-fiscal-smoke.ts
```

Sem a variável, salvar a senha do certificado devolve **500 e não persiste
nada** — comportamento correto (falhar alto em vez de gravar em texto puro), mas
trava o wizard no passo A2 sem mensagem óbvia.

### ⚠️ Achado colateral: o Calendar nunca teve KMS em ambiente publicado

Ao configurar o fiscal, descobri que **nenhuma variável KMS existia em dev nem
em produção** — nem a do fiscal, nem a do Calendar. A chave
`calendar-refresh-token` estava criada nos dois projetos, com IAM correto, e o
código de criptografia existe desde a fase H1. Só a env var nunca chegou aos
serviços.

Ninguém percebeu porque `GOOGLE_CALENDAR_SYNC_ENABLED=false` nos dois ambientes.
Se fosse ligado hoje, conectar uma agenda falharia: `encryptToken` lançaria
`CALENDAR_TOKEN_KMS_KEY_NOT_CONFIGURED`, o `catch` do callback redirecionaria com
`?error=oauth_failed` e nada seria gravado.

O lado bom é que **falha fechado**: não existe caminho que grave o refresh token
em texto puro. Mas **antes de ligar o Calendar** é preciso adicionar
`CALENDAR_TOKEN_KMS_KEY` aos três `.env` e aos secrets do GitHub — senão a
funcionalidade sobe quebrada.

### A armadilha do deploy

Os crons `processInvoiceRetries`, `checkFiscalCertificateExpiry` e
`syncReceivedInvoices` são **funções novas**. Função nova nasce com exatamente o
que o arquivo `.env` tiver no momento do deploy — e se faltar, nasce com env
vazio **permanentemente**, porque todo deploy seguinte preserva o vazio. Foi
assim que `onUserSignupNotify` e `pdf` foram para produção sem `RESEND_API_KEY`.

Antes de deployar, atualizar os secrets do GitHub:

```bash
gh secret set FUNCTIONS_ENV_PRODUCTION --env production --repo almeidagabriel01/ProOps   < apps/functions/.env.erp-softcode-prod
gh secret set FUNCTIONS_ENV_STAGING --env staging --repo almeidagabriel01/ProOps   < apps/functions/.env.erp-softcode
```

---|---|---|
| `.env.local` | ✅ preenchida | ❌ ausente |
| `.env.erp-softcode` | ❌ ausente | ❌ ausente |
| `.env.erp-softcode-prod` | ❌ ausente | ❌ ausente |

O Calendar funciona em produção porque a variável foi definida num deploy local
antigo e o **Cloud Run preserva as env vars já existentes no serviço** — mesmo
que o arquivo local não as tenha mais. Está documentado em
`.claude/rules/ci-cd.md`.

**Isso vira uma armadilha para o módulo fiscal**, e é diferente do caso do
Calendar: os crons `processInvoiceRetries`, `checkFiscalCertificateExpiry` e
`syncReceivedInvoices` são **funções novas**. Função nova criada sem env var
nasce com env vazio, **permanentemente** — todo deploy seguinte preserva o vazio.
Foi exatamente assim que `onUserSignupNotify` e `pdf` foram para produção sem
`RESEND_API_KEY`.

Antes de qualquer deploy, garantir em **`.env.local`, `.env.erp-softcode` e
`.env.erp-softcode-prod`**:

```
FISCAL_SECRET_KMS_KEY=<nome completo do recurso da chave>
```

Pode apontar para a mesma chave do Calendar (basta copiar o valor de
`CALENDAR_TOKEN_KMS_KEY`) — funciona e desbloqueia. O ideal é uma chave própria,
para que rotacionar a fiscal não invalide os refresh tokens de agenda; foi por
isso que os prefixos são separados.

E atualizar os secrets do GitHub, senão o CI recria o problema:

```bash
gh secret set FUNCTIONS_ENV_PRODUCTION --env production --repo almeidagabriel01/ProOps \
  < apps/functions/.env.erp-softcode-prod
```

---

## Fase A — Emissão

### A1. Cadastro fiscal

1. `/settings/fiscal`
2. Digite o CNPJ → **Buscar**

**Esperado:** razão social, endereço, CNAE e **código IBGE** preenchidos sozinhos.

**Se falhar:** a busca é conveniência, não bloqueio — preencha à mão. Mas se
falhar, o `FOCUS_NFE_MASTER_TOKEN` provavelmente está errado, e isso vai travar
o passo A2 também. Confira antes de seguir.

3. Complete: Inscrição Estadual, Inscrição Municipal, regime tributário
4. Confirme o CEP com blur no campo → o **código IBGE** deve preencher

> ⚠️ O código IBGE é um dos motivos mais comuns de rejeição quando falta. Ele
> não é digitável no fluxo normal: vem do campo `ibge` do ViaCEP.

5. Ligue **NF-e** e/ou **NFS-e**
6. **Salvar configuração**

**Esperado:** status `Incompleto`. **Nunca** `Pronto para emitir` — só uma nota
de teste autorizada promove.

### A2. Certificado e registro da empresa

1. Preencha a **senha do certificado** e a **validade**
2. **Enviar certificado .pfx**

**Esperado:** status vira `Aguardando nota de teste`, e no painel do Focus a
empresa aparece em **Tokens** com token de homologação próprio.

**Erros mapeados** (aparecem já traduzidos):

| Erro | Significado |
|---|---|
| "senha incorreta" | A senha não abre o `.pfx` |
| "não pertence ao CNPJ" | Certificado de outra empresa |
| "prazo de validade vencido" | A1 expirado |

**Se der 500 sem mensagem clara:** é o KMS. Volte aos pré-requisitos.

3. Confirme no Firestore que os tokens da empresa foram gravados **cifrados**:

```
fiscal_settings/{tenantId} →
  focusTokenHomologacaoEnc: "kms:v1:..."   ← deve começar com kms:v1:
  certificadoSenhaEnc:      "kms:v1:..."
  webhookSecret:            "<hex de 48 chars>"
```

> Se algum aparecer em texto puro, **pare** — é falha de segurança, não de
> integração.

4. Confirme o `webhookStatus` no mesmo documento: deve ser `registered`.
   `partial` ou `failed` significa que o gatilho não subiu — a nota vai
   funcionar, mas só resolve pelo cron de 15 min.

### A3. Primeira nota

1. Uma proposta **aprovada**, com cliente que tenha CPF/CNPJ e endereço completo
2. Botão **Emitir NF**

**Cenário esperado na primeira tentativa:** o diálogo de **lacunas**. É o
comportamento correto — o catálogo ainda não tem NCM nem código de serviço.

3. Resolva o que a checklist pedir. Para NCM, use o da nota que o contador mandou.
4. Emitir de novo

**Esperado:** toast "Nota enviada", e em `/invoices` a nota em **Processando**.

### A4. Autorização

**Esperado:** em segundos a minutos, a nota vira **Autorizada** com número, série,
chave de acesso, PDF e XML.

**Se ficar em Processando por mais de 15 minutos:**

| Verificar | Como |
|---|---|
| O gatilho subiu? | `webhookStatus` em `fiscal_settings` |
| O Focus tentou chamar? | Painel do Focus → Requisições |
| Nossa URL é alcançável? | Em dev local o Focus **não alcança** `localhost` |

> **Em desenvolvimento local o webhook nunca chega** — a URL aponta para o
> emulador. Isso é esperado: o cron `processInvoiceRetries` resolve em até 15
> minutos, e é justamente para isso que ele existe. Para testar o webhook de
> verdade, use o deploy de dev.

5. Confirme o arquivamento no Storage:

```
tenants/{tenantId}/fiscal/{invoiceId}/danfe.pdf
tenants/{tenantId}/fiscal/{invoiceId}/nota.xml
```

> Isso é a guarda legal de 5 anos + ano corrente. Se não aparecer, o
> arquivamento falhou em silêncio — é best-effort de propósito, mas precisa
> funcionar antes de produção.

### A5. Cancelamento

1. Cancele a nota com justificativa de **15+ caracteres**
2. Tente com menos de 15 → deve ser barrado **antes** de sair a requisição

---

## Fase B — Recepção (opcional nesta rodada)

Só faz sentido se a empresa do sócio **recebe** notas de fornecedor.

### B1. Habilitar

1. Em `/settings/fiscal`, ligue a recepção (`habilitaManifestacao`)
2. Reenvie o certificado para atualizar o cadastro no Focus

> ⚠️ **Cada nota recebida consome uma unidade do pacote mensal.** Uma empresa
> com muitas compras pode consumir bastante logo na primeira sincronização,
> porque ela traz o histórico.

### B2. Sincronizar

```
POST /v1/fiscal/received-invoices/sync
```

**Esperado:** `{ fetched, applied, cursor }` com `cursor > 0`.

3. Rode de novo imediatamente.

**Esperado:** `applied: 0` e o mesmo `cursor`. Se aplicar de novo, o controle de
versão está quebrado.

### B3. Manifestação

1. `GET /v1/fiscal/received-invoices` → notas em status `resumo`, **sem itens**
2. Confirme uma: `POST /v1/fiscal/received-invoices/{chave}/manifestacao` com
   `{"tipo":"confirmacao"}`

**Esperado:** status vira `completa` e os **itens aparecem, com NCM**.

> É a confirmação que libera o XML completo. Antes dela a Receita entrega só o
> resumo — não é limitação do provedor.

3. Teste `nao_realizada` sem justificativa → deve ser barrado

---

## Checklist de saída

Antes de considerar validado:

- [ ] Nota autorizada em homologação, com PDF e XML
- [ ] PDF e XML espelhados no nosso Storage
- [ ] Segredos gravados com prefixo `kms:v1:` — nenhum em texto puro
- [ ] `webhookStatus: registered`
- [ ] Cancelamento funcionando, com justificativa validada
- [ ] Diálogo de lacunas aparecendo quando falta dado fiscal
- [ ] Nenhum segredo na resposta de `GET /v1/fiscal/settings`

---

## Antes de produção

Itens que **não** bloqueiam a validação em homologação, mas bloqueiam produção:

1. **Numeração de série** — em produção precisa continuar de onde a empresa
   parou, senão a SEFAZ recusa por duplicidade. Em homologação a numeração é
   independente e não importa.
2. **Ambiente** — trocar para `producao` é opt-in por tenant, deliberadamente.
3. **Revisão manual** — regra do repositório para qualquer coisa que gere
   cobrança ou tenha efeito jurídico.
4. **`FOCUS_NFE_MASTER_TOKEN` e `FISCAL_SECRET_KMS_*` em `.env.erp-softcode-prod`**
   e nos secrets do GitHub (`FUNCTIONS_ENV_PRODUCTION`), senão o primeiro deploy
   cria as functions novas sem env var — e elas nascem quebradas em silêncio.

> O item 4 já aconteceu neste repositório antes, com `RESEND_API_KEY`. Está
> documentado em `.claude/rules/ci-cd.md`.

---

## Se o payload não for aceito

O cenário mais provável na primeira tentativa. Onde mexer:

| Sintoma | Arquivo |
|---|---|
| Campo recusado na emissão | `focus-payload.ts` |
| Resposta lida errado | `focus-response.ts` |
| Nota de entrada mal mapeada | `received-invoice-mapper.ts` |
| Erro classificado errado como permanente/retentável | `focus-error.ts` |

Referência de campos:
- NF-e: https://campos.focusnfe.com.br/nfe/NotaFiscalXML.html
- NFS-e Nacional: https://campos.focusnfe.com.br/nfse_nacional/EmissaoDPSXml.html

Use `dry_run=1` no cadastro de empresa para validar sem persistir.
