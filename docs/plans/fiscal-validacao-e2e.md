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
| Certificado A1 (`.pfx`) + senha | do CNPJ do sócio | ✅ **em mãos desde 27/08/2026** |
| `FISCAL_SECRET_KMS_KEY` | os três `.env` | ✅ chave dedicada, round-trip validado |
| Empresa já emite nota hoje | — | ✅ NFS-e nº 14 de 27/07/2026, Machado/MG |
| Campos fiscais no catálogo | `CatalogFiscalFields` | ✅ produto e serviço |
| Plano do Focus ativo | painel do Focus | ⏳ **conferir antes de começar** |

## Dados do primeiro emitente (Winicius — teste de homologação)

Lidos do próprio certificado e da NFS-e de referência, não digitados de memória.

| Campo | Valor | Fonte |
|---|---|---|
| CNPJ | 50.759.330/0001-33 | CN do certificado **e** DANFSe — conferem |
| Razão social | 50.759.330 WINICIUS GONCALVES ARAUJO DIAS | DANFSe |
| Regime | Simples Nacional (CRT 1) | DANFSe — "Optante, Microempresa" |
| Inscrição municipal | 3411114782 | DANFSe **e** guia de ISSQN |
| Inscrição estadual | 0046217750023 | ✅ **confirmada** pela DANFE da NF-e nº 6 |
| Endereço | Rua Major Feliciano, 549 — Centro | guia de ISSQN |
| Município / CEP / IBGE | Machado/MG · 37750-000 · 3139003 | DANFSe |
| CNAE | 4321-5/00 | guia de ISSQN |
| Série DPS / próximo nº | 70000 / 14 | DANFSe (DPS nº 13 foi a última) |
| Série NF-e / próximo nº | 0 / 7 | chave da NF-e nº 6 (DV validado) |
| Certificado válido até | **17/10/2026** | lido do `.pfx` |

Serviço de referência: código LC 116 **31.01**, tributação nacional **310102**
("Serviços técnicos em eletrônica, eletrotécnica e congêneres"), alíquota de ISS
**0** — no Simples Nacional o ISS sai no DAS, e a DANFSe traz a alíquota em branco.

> **A inscrição estadual não bloqueia este teste.** `checkIssuerReadinessForType`
> só exige IE quando `type === "nfe"`; para NFS-e o que ela exige é a inscrição
> **municipal**, que dois documentos independentes confirmam. Comece pela NFS-e.

> **Risco confirmado e resolvido em 27/08/2026.** A suspeita estava certa e era pior
> que o previsto: a NFS-e Nacional tem recurso próprio (`/v2/nfsen`) e um payload que
> não se parece com o municipal — plano, com sufixo `_tomador`, e com
> `codigo_tributacao_nacional_iss` em vez de `codigo_tributacao_nacional`. O cadastro
> da empresa também usa flags e numeração próprias (`habilita_nfsen_*`,
> `serie_nfsen_*`). Implementado atrás de `FiscalNfsePadrao` no emitente, default
> `nacional`. Ver `focus-payload.nfsen.test.ts`, cujos valores esperados vêm da
> NFS-e nº 14 real.

## ✅ 28/08/2026 — PRIMEIRA NOTA AUTORIZADA

NF-e nº 1, série 1, homologação SEFAZ-MG, R$ 275,00. O ciclo inteiro funcionou
sem intervenção: emissão → provedor → SEFAZ → autorização → gatilho → tela, com
DANFE e XML espelhados no nosso Storage.

**O emitente virou `ready`**, o que abre o portão de produção pelo caminho
normal — sem precisar do escape.

A numeração de homologação é **separada** da de produção: a chave saiu com série
1 / número 1, e a sequência real (série 0, próximo 7) segue intacta.

Rejeições de conteúdo até chegar lá — a SEFAZ nomeia um campo por vez:

| Erro | Correção |
|---|---|
| `598` razão social do destinatário | literal da NT 2011/002 em homologação |
| `745` NF-e sem grupo do PIS | grupos PIS/COFINS em todo item, CST por regime |

### O que ainda NÃO foi validado

- **NFS-e Nacional** — bloqueada por `E0037`, externo: Machado só credenciou
  produção. O caminho da DPS foi construído e corrigido contra o schema real
  três vezes, mas nunca chegou a ser autorizado.
- **Produção** — nenhuma nota com valor fiscal foi emitida.

## Estado em 28/08/2026 — caminho técnico validado ponta a ponta

O ciclo completo funciona: emissão → provedor → Ambiente Nacional → resposta →
**webhook** → tela, sem intervenção. Confirmado com uma rejeição, que percorre
exatamente o mesmo caminho de uma autorização.

Sequência de rejeições reais até aqui, cada uma corrigindo uma camada:

| Erro | Camada | Correção |
|---|---|---|
| `erro_validacao_schema` (regTrib/trib) | leiaute | `regApTribSN` + `regEspTrib` + `indTotTrib` |
| `E0008` data posterior ao processamento | fuso | `dhEmi` em −03:00, não UTC |
| `E0037` município inexistente | **externo** | Machado não está na homologação nacional |

Três bugs do gatilho, todos silenciosos, todos com o mesmo sintoma ("nota presa
em processando"):

1. registrado no evento `nfse`, emissão em `nfsen` — nunca notificaria
2. host de cadastro + token da conta — criava hook de **produção**
3. o alerta de falha existia no código e nunca chegava à tela (três vezes)

**Bloqueio restante é externo**, não de código: Machado/MG está ativo no sistema
nacional em produção (NFS-e nº 14, e o painel do Focus confirma) mas não no
ambiente de homologação. Saídas: perguntar ao Focus, ou emitir uma nota real de
valor baixo e cancelar — o escape do portão (`force`) e o botão de cancelar
existem exatamente para isso.

> **Ainda não testado contra a API real.** O que foi verificado empiricamente até
> aqui são as URLs (quais endpoints existem em cada host). Os campos do payload vêm
> da documentação e da nota de referência, não de uma emissão aceita.

## Conferência contra a NF-e nº 6 (autorizada em 27/02/2026)

Chave `31260250759330000133550000000000061664528859`, DV validado. Venda para
pessoa física do mesmo município, R$ 1.372,00, dois equipamentos de rede.

O que ela confirmou, além da numeração:

| Campo | Na nota real | O que o módulo deriva |
|---|---|---|
| CFOP | 5102 | `deriveCfop(venda, MG, MG)` → 5102 ✅ |
| CSOSN | 102 (col. "0102" = origem 0 + CSOSN 102) | `deriveSituacaoTributaria(CRT 1)` → csosn 102 ✅ |
| Origem | 0 | `normalizeOrigem(undefined)` → 0 ✅ |
| Unidade | UN | `deriveUnidadeComercial(undefined)` → UN ✅ |
| Indicador IE do destinatário | 9 — Não Contribuinte | derivado assim para CPF ✅ |
| Natureza | VENDA | `DEFAULT_NATUREZA` ✅ |

Fixado em `natureza-operacao.nota-real.test.ts`. CFOP, CSOSN e origem são
justamente os campos que decidimos **não** guardar no produto — se a derivação
estivesse errada, estaria errada em toda venda e só apareceria como rejeição.

NCMs reais dos produtos vendidos, úteis para o catálogo de teste:
`85176241` (sistema Wi-Fi mesh) e `85176239` (switch).

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
GCLOUD_PROJECT=erp-softcode \nFISCAL_SECRET_KMS_KEY="projects/erp-softcode/locations/southamerica-east1/keyRings/proops-oauth/cryptoKeys/fiscal-secrets" \nnpx tsx src/scripts/kms-fiscal-smoke.ts
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
em texto puro.

**Corrigido em 25/08/2026:** `CALENDAR_TOKEN_KMS_KEY` adicionada aos três `.env`,
com round-trip validado nos dois projetos. Falta o **deploy** para a variável
chegar aos serviços. Ligar a agenda ainda exige mais que isso — ver
`docs/plans/google-calendar-ativacao.md`.

### A armadilha do deploy

Os crons `processInvoiceRetries`, `checkFiscalCertificateExpiry` e
`syncReceivedInvoices` são **funções novas**. Função nova nasce com exatamente o
que o arquivo `.env` tiver no momento do deploy — e se faltar, nasce com env
vazio **permanentemente**, porque todo deploy seguinte preserva o vazio. Foi
assim que `onUserSignupNotify` e `pdf` foram para produção sem `RESEND_API_KEY`.

Antes de deployar, atualizar os secrets do GitHub:

```bash
gh secret set FUNCTIONS_ENV_PRODUCTION --env production \n  --repo almeidagabriel01/ProOps < apps/functions/.env.erp-softcode-prod
gh secret set FUNCTIONS_ENV_STAGING --env staging \n  --repo almeidagabriel01/ProOps < apps/functions/.env.erp-softcode
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
