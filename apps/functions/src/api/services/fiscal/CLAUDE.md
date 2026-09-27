# CLAUDE.md — functions/src/api/services/fiscal/

## Modulo Fiscal (Nota Fiscal)

- **Provedor unico: Focus NFe.** Cobre NF-e, NFC-e, NFS-e municipal e NFS-e Nacional no
  mesmo cadastro de empresa. Auth = HTTP Basic com o token no usuario e senha em branco.
- **Cadastro de empresa e consulta de CNPJ so existem em `api.focusnfe.com.br`.** Verificado
  batendo nos dois hosts: em homologacao `/v2/empresas` e `/v2/cnpjs` respondem **404**; em
  producao, 401. Nao e limitacao do provedor — o cadastro de empresas e unico, e o ambiente
  e expresso por qual token a empresa devolve e por quais flags `habilita_*` ela recebe,
  nunca pela URL. `/hooks` existe nos dois. A divisao coincide com a dos tokens:
  token da conta => `resolveRegistryBaseUrl()`; token da empresa => `resolveFocusBaseUrl(env)`.
  O sintoma quando isso quebra e enganoso: o Focus responde "Endpoint nao encontrado",
  que parece erro de rota nossa.
- **A NFS-e tem DOIS padroes, e recursos diferentes.** `FiscalNfsePadrao` (`nacional` |
  `municipal`, default nacional) fica no emitente e resolve o recurso em
  `resolveResourcePath`: nacional => `/v2/nfsen`, municipal => `/v2/nfse`. Os payloads
  **nao se parecem** — o nacional e plano (`cnpj_prestador`, `descricao_servico`,
  `razao_social_tomador`, `logradouro_tomador`...) e o municipal e aninhado
  (`prestador`/`tomador`/`servico`). O cadastro tambem muda: `habilita_nfsen_producao` /
  `habilita_nfsen_homologacao` + `serie_nfsen_*` + `proximo_numero_nfsen_*` no nacional,
  `habilita_nfse` + `serie_nfse_producao` no municipal.
- **`padraoNfse` NAO e um terceiro `FiscalDocumentType`.** Quase toda ramificacao por tipo
  no modulo pergunta "e nota de servico?", e as duas respondem sim — um terceiro valor no
  enum viraria bug silencioso em cada lugar que esquecesse de inclui-lo.
- **O padrao e gravado na propria nota** (`InvoiceDocument.padraoNfse`), nao so nas
  configuracoes do tenant: consultar e cancelar tem que usar o mesmo recurso com que ela
  nasceu. Se o tenant migrar de municipal para nacional, ler o padrao atual tornaria as
  notas antigas inalcancaveis.
- **`codigoTributacaoNacional` e obrigatorio no padrao nacional** e nao e derivavel do item
  da LC 116 — o codigo nacional tem um desdobro que a lista antiga nao carrega (31.01
  sozinho nao diz se e .01 ou .02). O gate cobra; `buildNfsenPayload` lanca
  `NFSEN_SEM_CODIGO_TRIBUTACAO_NACIONAL` como ultima linha de defesa.
- **Data e hora dos documentos vao no fuso de BRASILIA, nunca em UTC**
  (`fiscal-datetime.ts`). O Ambiente Nacional compara o RELOGIO DE PAREDE: uma DPS enviada
  com `dhEmi` em UTC foi rejeitada com **E0008** ("a data de emissao nao pode ser posterior
  a data do seu processamento") mesmo tendo sido emitida 5 segundos ANTES — `03:08+00:00`
  contra `00:08-03:00` do processamento. A competencia tem o mesmo problema por outro
  caminho: `slice(0, 10)` de um ISO em UTC adianta o dia em toda nota emitida depois das
  21h, erro que so aparece a noite. Sem horario de verao desde o Decreto 9.772/2019, entao
  −03:00 e fixo; se voltar, `fiscal-datetime.ts` e o unico arquivo a mudar.
- **Em HOMOLOGACAO a NF-e leva o nome do destinatario substituido pelo literal**
  `NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL` (NT 2011/002, obrigatorio
  desde 01/05/2011). Qualquer outro valor devolve rejeicao **598**. A regra so existe no
  ambiente de teste, entao nunca aparece em producao — e por isso mesmo e facil de esquecer.
  Nao vale para NFS-e: e regra da SEFAZ, nao do Ambiente Nacional.
- **A NF-e e o unico caminho testavel em homologacao para o primeiro emitente.** A NFS-e
  Nacional depende de o municipio ter aderido ao Padrao Nacional **em homologacao**, e a
  adesao e separada por ambiente: Machado/MG so credenciou producao (confirmado pelo Focus,
  rejeicao **E0037**). A NF-e vai para a SEFAZ estadual, que tem homologacao para todos os
  estados — entao o ciclo completo (emissao, autorizacao, gatilho, arquivamento, `ready`)
  da para validar por ali sem emitir nada com valor fiscal.
- **Todo item da NF-e leva os grupos PIS e COFINS**, mesmo zerados — sem eles a SEFAZ
  rejeita com **745** ("NF-e sem grupo do PIS"). O CST sai de `derivePisCofinsCst`, junto
  das outras derivacoes por regime: **99** no Simples (recolhimento unificado no DAS,
  destacar declararia contribuicao que a empresa nao apura ali) e **49** no Regime Normal,
  que apura de verdade mas com aliquota dependente de ser cumulativo ou nao — dado que o
  cadastro nao tem. 49 com zeros nao inventa valor; e o primeiro campo a revisar quando
  existir um tenant fora do Simples.
- **A inscricao municipal do prestador vai na DPS** (`inscricao_municipal_prestador`)
  sempre que existir. A exigencia e do MUNICIPIO, nao do leiaute: cada prefeitura registra
  no CNC da NFS-e se ela e obrigatoria, e Machado exige — rejeicao **E0116**. Mandar sempre
  que houver e mais barato que mapear onde e obrigatoria; omitir quando nao houver tambem
  importa, porque alguns municipios validam o formato de uma IM presente.
  **E0116 tambem sai quando a IM FOI enviada** e nao confere com o CNC do municipio
  (numero com outro formato, ou empresa ausente do cadastro de HOMOLOGACAO da prefeitura,
  que e separado do de producao). Visto em Balneario Camboriu com `<IM>` presente no XML.
  O texto cru manda "informar" o que ja foi informado, entao a tela traduz
  (`lib/fiscal/rejection-messages.ts`). Para separar os dois casos: abrir o XML ENVIO no
  painel do provedor e procurar `<IM>` dentro de `<prest>`.
- **`totTrib` e um CHOICE obrigatorio dentro de `trib`, e qual filho entra depende do
  regime.** As opcoes sao `vTotTrib`, `pTotTrib`, `indTotTrib` e `pTotTribSN` — exatamente
  uma. Para **ME/EPP** (`opSimpNac` 3) o indicador e PROIBIDO (rejeicao **E0712**) e o campo
  certo e `percentual_total_tributos_simples_nacional`, a aliquota efetiva do DAS; para
  **nao optante** o espelho vale (**E0713**: ali o `pTotTribSN` e que e proibido). MEI segue
  no indicador — nao testado, e mudar no escuro trocaria um caso que funciona por um palpite.
  O `indTotTrib` significa "opto por nao informar os tributos estimados" (Decreto
  8.264/2014): essa porta existe para os demais e esta fechada para ME/EPP.
  A aliquota muda com o faturamento e sai do DAS, entao e do tenant
  (`percentualTotalTributosSimplesNacional` em `fiscal_settings`, campo em
  `/settings/fiscal` visivel so no Simples) — nao uma pergunta por nota. Falta dela vira
  **lacuna** em `fiscal-readiness`, com nome e lugar para resolver, em vez de uma sigla que
  chega minutos depois; `buildNfsenPayload` ainda lanca
  `NFSEN_SEM_PERCENTUAL_SIMPLES_NACIONAL` como ultima linha de defesa.
- **A serie da DPS identifica o SISTEMA emissor, e tem faixa reservada:**
  `00001-49999` aplicativo proprio (nos), `50000-69999` mobile, `70000-79999` emissor web
  (o portal nfse.gov.br), `80000-89999` transcricao manual. Serie fora da faixa e rejeicao
  **E0010**. Consequencia boa e nao obvia: quem emite hoje pelo portal usa a faixa 70000 e
  **precisa** trocar de serie ao migrar — e como a numeracao e por serie, a nova comeca do 1
  sem risco de duplicidade com o que o portal ja emitiu. `lib/fiscal/serie-dps.ts` avisa no
  formulario.
- **A numeracao nao vai no payload de emissao**, nem no nacional nem no municipal: serie e
  proximo numero vivem no cadastro da empresa. Mandar o numero em cada emissao criaria duas
  fontes da verdade para a sequencia, que e o caminho mais curto para duplicidade.
- **DOIS niveis de token — confundir os dois quebra a integracao:**
  - **Token da conta** (`FOCUS_NFE_MASTER_TOKEN`, em env): gerencia o cadastro de empresas,
    consulta CNPJ e registra webhooks. **Nunca emite.**
  - **Token da empresa**: devolvido por `POST /v2/empresas` como `token_homologacao` /
    `token_producao`. E ele que assina as notas daquele CNPJ. Fica cifrado em KMS em
    `fiscal_settings` (`focusTokenHomologacaoEnc` / `focusTokenProducaoEnc`) e e lido por
    `getIssuingToken(tenantId, env)`. Isso e uma vantagem no multi-tenant: nenhum bug
    consegue emitir sob o CNPJ de outro tenant.
  - Nao existe token de homologacao no nivel da conta — ele nasce junto com a empresa.
- **Nenhum codigo de dominio importa o SDK do provedor.** Tudo passa pela interface
  `FiscalProvider` (`api/services/fiscal/`); os nomes de campo do Focus vivem so em
  `focus-payload.ts` (saida) e `focus-response.ts` (entrada). Motivo: a Nuvem Fiscal foi
  desativada em 31/07/2026 com 90 dias de aviso.
- **`fiscal_settings/{tenantId}`** — colecao propria com `allow read, write: if false`,
  NAO um map em `tenants/{id}`: aquele doc e legivel por qualquer membro do tenant e o
  Firestore nao tem regra por campo. Guarda CNPJ, IE/IM, regime, serie/numeracao e a senha
  do certificado A1 cifrada em KMS (`FISCAL_SECRET_KMS_*`, chave separada da do Calendar).
- **O certificado A1 (.pfx) nunca e persistido** — sobe uma vez para o provedor, que o
  custodia e valida (senha, titularidade do CNPJ, validade), e sai da memoria.
- **Ambiente default e `homologacao`**, e a troca tem endpoint proprio
  (`PUT /v1/fiscal/environment`), nao um campo do formulario de configuracao. Salvar a
  configuracao **preserva** o ambiente: antes disso o campo ausente virava "" e resolvia
  para homologacao, entao qualquer salvamento derrubaria um emitente ativo de volta para
  teste em silencio — ele acharia que esta emitindo e nao estaria.
- **`ready` sobrevive a um salvamento de configuracao.** Ate 2026-08-31 qualquer save
  rebaixava `ready` para `registered`, em silencio — e como emissao automatica e convite
  pos-aprovacao dependem de `ready`, corrigir um e-mail desligava os dois sem aviso;
  mexer no proprio `autoIssueRule` desligava o que se acabara de configurar. Agora so
  rebaixa quando o **CNPJ muda**, que e o unico caso em que a prova nao se transfere:
  `ready` significa "uma nota ja foi autorizada por ESTE CNPJ". Comparacao com os digitos
  normalizados dos dois lados, senao o CNPJ mascarado do formulario parece troca de
  empresa a cada salvamento. Guard: `fiscal-settings.ready.test.ts`.
- **O portao e `status === "ready"`**, marcado por `markIssuerReady` na PRIMEIRA nota
  autorizada. Homologacao prova que o nosso codigo monta a nota certa; so a autorizacao
  prova que o emitente esta credenciado na SEFAZ/prefeitura. Existe escape (`force`), com
  confirmacao explicita na UI, para quem ja emite por outro sistema — Bling, Omie e Tiny
  nem travam a troca, entao travar sem saida seria mais rigido que o mercado inteiro.
- **O aviso de modo de teste fica na tela de NOTAS**, nao em configuracoes (padrao do
  Bling): e ali que a pessoa olha o que emitiu, e e ali que "isso nao vale nada ainda"
  precisa estar visivel. E o texto nao diz "homologacao" — para quem instala automacao
  isso nao significa nada, "modo de teste" significa.
- Emissao e **assincrona**: pre-validacao sincrona no provedor, depois fila. `ref` (nossa)
  e query param obrigatorio — reenviar a MESMA ref e idempotente no provedor.
- **A `ref` NAO impede emitir a mesma proposta duas vezes.** Ela nasce de
  `db.collection("invoices").doc()`, ou seja, um id novo a cada chamada: dois cliques
  em "Emitir NF" produzem duas notas distintas, ambas aceitas pelo fisco. Quem cobre
  isso e `previewFromProposal`, que consulta `listInvoicesByProposal` e devolve
  `jaEmitidas` (so **autorizada** e **em processamento** — rejeitada, cancelada, com
  erro e rascunho ficam de fora, porque nao sao documento valido e reemitir depois
  delas e o caminho normal). A UI **avisa e deixa seguir**: existe motivo legitimo
  para uma segunda nota, entao bloquear seria errado; o que faltava era o usuario
  saber.
- **Campos fiscais sao opcionais no cadastro e exigidos na emissao.** Ninguem precisa parar
  para classificar o catalogo inteiro antes de usar o ERP; o gate e `fiscal-readiness.ts`,
  que roda na emissao e lista TODAS as lacunas de uma vez (emitente, cliente, itens).
- **CFOP, CST/CSOSN e unidade comercial NAO ficam no produto** — sao derivados na emissao
  (`natureza-operacao.ts`). CFOP e propriedade da *operacao*: a mesma cortina e 5102 dentro
  do estado e 6102 fora. Guardar no produto forcaria correcao manual em toda venda
  interestadual. CST/CSOSN sai do regime do emitente; a unidade sai do `inventoryUnit`.
- **O gatilho usa o token da EMPRESA daquele ambiente, na base daquele ambiente** — mesma
  regra da emissao. **O token e o que define o ambiente do gatilho no provedor**: registrar
  com o token da conta cria um hook de PRODUCAO (o painel mostra "Utilizar Token: Token
  Principal de Producao · Ambiente: Producao") que nunca notifica uma nota de homologacao.
  `listWebhooks` tambem — listar com o token errado faz o reconcile enxergar os hooks de
  outro ambiente e apagar os errados, ou nenhum.
- **Trocar de ambiente RE-REGISTRA os gatilhos.** Como o token da empresa define onde o
  gatilho vale, mudar o ambiente sem re-registrar deixaria a emissao num lugar e a
  notificacao escutando no outro — as notas voltariam a depender do cron, sem erro e sem
  explicacao. Best-effort e isolado num try/catch proprio: o ambiente JA foi gravado quando
  o registro roda, e deixar a excecao escapar devolveria erro para uma troca que aconteceu.
- **"Ja existe um gatilho para este evento, empresa e url" NAO e falha.** O Focus
  registra por (CNPJ, evento, URL) e recusa duplicata — se ele diz que ja existe, o
  gatilho **esta no ar com a URL que queremos**. Tratar como erro mostrava
  "Notificacao automatica nao registrada" sobre uma integracao funcionando, com um
  botao "Tentar de novo" que nunca resolveria: cada tentativa recria a mesma
  duplicata e recebe a mesma recusa. `isDuplicateWebhookError` conta como
  registrado. Acontece quando o `reconcile` nao apagou o hook antigo — `listWebhooks`
  falhou (o catch de la so registra warning) ou devolveu a lista de outro ambiente.
- **Falha de registro de gatilho e visivel na UI** (`webhookStatus` em `fiscal_settings`,
  exibido no card fiscal) com botao de reenviar (`POST /v1/fiscal/webhooks/retry`). Antes o
  status era gravado e nunca mostrado, e a unica forma de repetir o registro era reenviar o
  certificado — recadastrando a empresa inteira no provedor para recriar um hook.
- **O gatilho e registrado pelo nome do EVENTO do provedor, que tem TRES valores**
  (`nfe`, `nfse`, `nfsen`) enquanto o dominio tem dois. `registerFiscalWebhooks` deriva o
  evento de `resolveResourcePath` — o mesmo que escolhe o recurso de emissao —, e o receptor
  traduz de volta em `EVENT_TO_TYPE`. Registrar `nfse` e emitir em `nfsen` **nao da erro em
  lugar nenhum**: o registro e aceito, a emissao e aceita, e a notificacao nunca chega; a
  nota fica presa em `processing` ate o cron. Foi assim com a primeira nota real, que ja
  estava rejeitada no Ambiente Nacional enquanto a UI mostrava "Processando".
- **Webhook do Focus NAO tem cabecalho de autenticacao** (diferente do Asaas, que assina com
  `asaas-access-token`). A propria URL e a credencial: `/webhooks/focus/:tenantId/:secret/:type`,
  com o segredo comparado em tempo constante. Segredo invalido responde **200**, nao 401 — e
  falha permanente, e 401 faria o Focus retentar 5 vezes em 24h a toa.
- **O cron `processInvoiceRetries` (15 min) nao e redundancia, e o unico backstop.** O Focus
  retenta a notificacao em 1min, 30min, 1h, 3h e 24h e depois **nunca mais dispara**. Uma queda
  de entrega nessa janela deixaria a nota presa em `processing` para sempre.
- **A nota nasce de um documento de negocio**, nunca de formulario em branco:
  `POST /v1/fiscal/invoices/from-proposal/:id` e `from-transaction/:id`. Uma proposta
  **mista gera DUAS notas** — NF-e da mercadoria e NFS-e da mao de obra —, separadas por
  `ProposalProduct.itemType`. Faltando qualquer dado fiscal, **nenhuma** e enviada: meia
  venda mista faturada e pior que nenhuma.
- **Botoes e gatilhos automaticos chamam as MESMAS funcoes** (`invoice-issue.service.ts`),
  entao nao existe caminho automatico que pule uma validacao do manual.
- **`GET /v1/fiscal/invoices/preview/from-proposal/:id` responde sem emitir.** Reaproveita
  `assembleInvoices` — que monta os documentos e acumula as lacunas mas nao despacha — e
  por isso da exatamente a mesma resposta que a emissao daria, em vez de uma segunda
  implementacao da regra que poderia divergir em silencio. Devolve `canIssue`, `reason`,
  `gaps`, `documentos` (dois numa venda mista) e `jaEmitidas`.
- **Aprovar uma proposta CONVIDA a emitir**, e isso e comportamento padrao, nao
  configuracao: aprovar e faturar sao o mesmo momento para quem vende. O convite e
  **condicional** — so aparece se o preview disser `canIssue` e nao houver nota valida
  dessa proposta. Convidar e depois mostrar uma checklist de pendencias transformaria o
  atalho em armadilha, e convidar sobre proposta ja faturada seria convite a duplicar.
  Recusar nao deixa pendencia: o botao "Emitir NF" continua na lista.
  Ligado em `useProposalInvoicePrompt`, consumido pela lista de propostas e pelo arraste
  do kanban. **Falta o formulario da proposta**, que redireciona logo apos salvar.
- **`autoIssueRule` continua sem UI, de proposito.** O convite pos-aprovacao entrega a
  conveniencia sem que nada seja emitido sem confirmacao; expor `on_payment` /
  `on_proposal_approved` acrescentaria emissao sem humano no circuito. O codigo dos
  gatilhos segue ligado em `asaas-webhook.controller.ts` e `proposals.controller.ts`,
  alcancavel so por escrita direta no Firestore.
- **Gatilhos sao opt-in e best-effort.** `tryAutoIssue` so dispara se
  `autoIssueRule` bater E `status === "ready"`, e **nunca lanca**: o pagamento ja foi
  confirmado e a proposta ja foi aprovada — falhar a nota nao pode desfazer a venda.
  Ganchos: `handlePaymentSuccess` (asaas-webhook) e `syncApprovedProposalTransactions`.
- **O PDF da NFS-e vem em `url_danfse`, nao em `caminho_danfe`.** A NF-e devolve
  `caminho_danfe` RELATIVO a base; a NFS-e — nos dois padroes — devolve `url_danfse`
  ABSOLUTO (S3, fora do host da API). Ler so o campo da NF-e fez toda NFS-e autorizada
  nascer sem `pdfUrl`: sem botao de baixar na lista e com o arquivamento legal guardando
  apenas o XML. O fixture do teste de NFS-e omitia o campo, entao a suite concordava com o
  bug.
- **Link de documento pode chegar DEPOIS, e `canApplyStatus` nao pode barrar isso.** A
  guarda existe contra regressao de STATUS; consultar uma nota autorizada devolve
  `authorized` de novo, a transicao e recusada e o update inteiro era descartado — links
  inclusive. Uma nota que nasceu sem `pdfUrl` ficava sem ele para sempre, e nenhum botao da
  UI a recuperava. Agora, quando o status nao muda, os campos de link AUSENTES sao
  preenchidos e o retorno e `applied: true` para o arquivamento rodar. Link de documento
  nao regride: ou falta, ou existe e e imutavel — por isso preencher e completar o
  registro, nao reverter estado. Guard: `invoice.backfill-links.test.ts`.
  **Preencher no service nao bastava:** nada disparava a consulta numa nota autorizada —
  `pollPendingInvoices` so varre `processing`/`error`, e o botao "Consultar agora" da UI so
  aparecia em `processing`. A lista mostra agora um botao de buscar o PDF **na propria
  celula onde o download ficaria**, quando a nota esta autorizada e sem `pdfUrl`; ele some
  sozinho assim que o link chega.
- **IBS/CBS na NFS-e: em 2026 o Simples nao destaca nada.** O preenchimento so passa a ser
  obrigatorio para Simples/MEI em **01/01/2027**; em 2026 os dois seguem recolhidos por
  dentro do DAS, e o unico campo novo esperado e o **codigo NBS** (opcional no catalogo,
  enviado como `codigo_nbs` quando o servico tem `nbs`). No DANFSe v2.0 (NT 008/2026) o
  bloco de valores tem TRES linhas — "Valor Liquido da NFS-e", "Total do IBS/CBS" e "Valor
  Liquido da NFS-e + IBS/CBS" — e a NT manda preencher com traço o que nao vem no XML. A
  terceira linha e um TOTAL A PAGAR, nao um valor de imposto.
- **O DANFSe NAO e mais gerado pelo Ambiente Nacional.** A API nacional de geracao foi
  suspensa em **03/08/2026** (NT 008/2026): desde entao cada sistema emissor renderiza o
  proprio PDF a partir do XML. O PDF que baixamos e **do Focus**; o que o contador ve no
  portal e do emissor web. Dois renderizadores lendo o mesmo XML podem divergir num campo
  CALCULADO — e divergem: com o grupo IBSCBS ausente, o portal zera
  "Valor Liquido da NFS-e + IBS/CBS" e o Focus repete o valor liquido. **O XML e o
  documento que vale; o DANFSe e representacao.**
- **O Focus confirmou que a divergencia do DANFSe e de RENDERIZADOR, e que ela se
  resolve sozinha** (suporte, 2026-09-04): o DANFSe deles segue o **leiaute 1.01**, em que
  informar IBS/CBS e obrigatorio, entao a linha "Valor Liquido da NFS-e + IBS/CBS" vem
  preenchida; o PDF do ambiente nacional ainda esta no leiaute antigo porque a Receita
  **prorrogou os novos campos para 01/10**. Em "Total do IBS/CBS" eles imprimem "-" porque
  os valores *nao existem* na nota — que e diferente de existirem valendo zero, exatamente
  o que a NT 008/2026 manda. Quando o ambiente nacional atualizar o PDF, o campo passa a
  ser preenchido pelo `vTotNF` e os dois espelhos ficam iguais. **Nada a mudar no nosso
  codigo**: a nota esta correta, e a terceira linha e um TOTAL A PAGAR, nao um imposto.
- **01/10/2026 e data de RECHECAGEM.** O `vTotNF` que igualaria os dois espelhos so passa
  a existir quando os grupos de IBS/CBS forem enviados. Fica em aberto se, a partir dessa
  data, a DPS passa a exigir o grupo de emitente do **Simples (ME/EPP, opcao 3)** — o que
  esta documentado aqui e que para Simples/MEI a obrigatoriedade comeca em **01/01/2027**,
  e as duas datas nao podem ser confundidas. Confirmar antes de 01/10: uma exigencia nova
  sem o grupo vira rejeicao em toda NFS-e.
- **Existe grupo IBSCBS na DPS e nos NAO o enviamos** — `ibs_cbs_situacao_tributaria`
  (CST) e `ibs_cbs_classificacao_tributaria` (cClassTrib) no Focus, mais `regApIBSCBSSN`
  para o Simples na NT 009. Na DPS so se declara a SITUACAO; aliquota e valor sao
  calculados pelo Ambiente Nacional e voltam na nota autorizada. A validacao de
  obrigatoriedade esta suspensa (NT 004 v2.00) e para Simples/MEI a regra so vale em
  **01/01/2027** — por isso a nota passou sem o grupo. **Nao chutar CST/cClassTrib:** sao
  codigos de classificacao fiscal, e um valor errado num documento fiscal e pior que a
  ausencia. Os codigos tem zeros a esquerda significativos (`000001` != `1`).
- **DANFE e XML sao espelhados no nosso Storage** (`tenants/{id}/fiscal/{invoiceId}/`) assim
  que a nota e autorizada. Nao e conveniencia: guarda legal de **5 anos + ano corrente**
  (Ajuste SINIEF 07/2005), e depender do link do provedor deixaria o acervo do cliente fora
  do nosso controle. Best-effort e idempotente — falhar nao pode desfazer uma nota valida;
  o cron reencontra e tenta de novo.
- **Download passa pelo backend**, nunca por link direto: `storage.rules` nega a pasta
  `fiscal/` ao client e `application/xml` nem esta na allowlist de content-type.
- **Lancamento avulso nao emite** — sem proposta vinculada nao ha itens, e o sistema
  falha com `LANCAMENTO_SEM_PROPOSTA` em vez de inventar uma linha.
- **A CC-e e CUMULATIVA: a ultima sobrescreve as anteriores perante o fisco.** Cada nova
  carta precisa repetir tudo o que ainda vale — mandar so a novidade apaga a correcao
  anterior, sem erro nenhum, e ninguem descobre antes de uma fiscalizacao. Por isso
  `correctInvoice` **persiste** o texto em `InvoiceDocument.correcoes` (so DEPOIS de o
  fisco aceitar) e o dialogo abre pre-preenchido com a ultima. Limite de **20** eventos
  por NF-e; passar disso e a rejeicao **594**, entao a UI barra antes de gastar a chamada.
- **Texto livre em documento fiscal nao aceita Unicode inteiro.** O XSD da NF-e usa o
  padrao `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}` — **U+0020 a U+00FF**, sem espaco na
  primeira nem na ultima posicao. Latin-1 acentuado passa (`ç`, `é`, `ã`); o que nao passa
  e o que teclado e editor produzem sozinhos: travessao `—`, aspas curvas, reticencias,
  espaco nao separavel e **quebra de linha** (U+000A esta ABAIXO de U+0020, e o campo da
  CC-e e um `<textarea>` de 5 linhas). A rejeicao vem da SEFAZ como erro de schema citando
  o codepoint — mensagem que nao ajuda ninguem a entender que o problema e um traco.
  `sanitizeFiscalText` (`fiscal-text.ts`) converte o que tem equivalente e descarta o
  resto; **`trimmed()` de `focus-payload.ts` passa por ele**, entao descricao de item,
  nome do destinatario e informacoes adicionais estao cobertos junto com a CC-e — o mesmo
  defeito derrubaria uma nota inteira por causa de um produto chamado
  "Cortina Blackout — 2,40m". Na CC-e o saneamento roda no controller **antes** de medir o
  tamanho (o corte muda o comprimento) e de novo no service, e o texto GRAVADO e o saneado:
  como a carta e cumulativa e o dialogo reabre pre-preenchido, guardar o texto cru
  reenviaria o caractere recusado. Foi assim que a primeira carta real foi recusada — com
  um travessao copiado do proprio placeholder do dialogo.
  O front tem copia (`lib/fiscal/texto-fiscal.ts`) so para o contador e o aviso serem
  honestos, com paridade garantida por `apps/web/src/__tests__/fiscal-text-parity.test.ts`.
- **Recusa da CC-e nao chega como erro HTTP.** Mesmo caso do cancelamento: o provedor
  responde 200 e a recusa vem no corpo. `correctInvoice` ignorava o retorno, entao
  "sucesso" na tela significava apenas "nao deu erro de rede" — e uma carta fantasma no
  historico e repetida pela proxima correcao, por ser cumulativa. A checagem agora e por
  **prova de FALHA**, nao de sucesso: `status === "rejected"` ou `rejectionMessage`
  presentes lancam; status desconhecido segue adiante e vira `logger.warn`. Exigir um
  status especifico de sucesso recusaria toda correcao caso o provedor mude o formato da
  resposta.
- **A CC-e tem documentos PROPRIOS, arquivados a parte.** `caminho_xml_carta_correcao`,
  `caminho_pdf_carta_correcao` e `numero_carta_correcao` na resposta — nomes **confirmados
  em dev em 2026-09-04**, com a carta trazendo numero e os dois arquivos; espelhados em
  `tenants/{id}/fiscal/{invoiceId}/cce-{indice}.{ext}` por `archiveCorrectionDocuments`.
  O indice e 1-based e vem da posicao no historico: a ultima prevalecer perante o fisco
  **nao apaga** as anteriores, que foram eventos distintos com protocolo e guarda legal
  proprios. Se a resposta vier sem os caminhos, a correcao e registrada assim mesmo (o
  evento existe na SEFAZ de qualquer jeito) e sai um `logger.warn` com as CHAVES recebidas
  — e o que permite descobrir o nome certo sem adivinhar e sem expor valor nenhum.
- **Os arquivos do provedor sao PUBLICOS — nao exigem token.** O caminho vem relativo a
  API (`caminho_xml_nota_fiscal` -> `/arquivos_development/...` em homologacao) e
  `toAbsoluteUrl` o resolve contra a base, mas o arquivo em si abre no navegador sem
  autenticacao nenhuma (verificado em 2026-09-04 com o XML de uma NF-e autorizada). Ou
  seja: os botoes de PDF/XML da nota, que sao `href` direto, **funcionam** — nos dois
  tipos de documento —, e o `download` do arquivamento nunca precisou de credencial.
  Nao mandar token ali e deliberado: seria expor a credencial da empresa a uma URL que
  nao a pede.
- **O download do documento da CC-e passa pelo backend**
  (`GET /fiscal/invoices/:id/correcoes/:indice/:kind`), lendo do NOSSO Storage via
  `readArchivedDocument` — que ate entao era funcao orfa, sem rota. O motivo NAO e
  autenticacao (o link do provedor funcionaria): e que o acervo tem guarda legal de 5
  anos e nao pode depender de link de terceiro. E ler a nossa copia exige backend —
  `storage.rules` nega a pasta `fiscal/` ao client, e `application/xml` nem esta na
  allowlist de content-type do bucket.
- **O que a CC-e NAO corrige** (Ajuste SINIEF 01/07): base de calculo, aliquota,
  quantidade, valor da operacao, qualquer tributo, dado que mude remetente ou
  destinatario, e data de emissao ou de saida. Escrever algo assim **nao da erro** — gera
  uma carta registrada e inutil, com falsa sensacao de resolvido. O dialogo diz isso antes
  do campo de texto. So NF-e tem CC-e; na NFS-e o caminho e cancelar e substituir, e a
  regra e de cada prefeitura.
- **Cancelamento recusado LANCA, nao passa em silencio.** O provedor responde **200 mesmo
  quando o fisco recusa** — o corpo traz `erro_cancelamento` e a nota continua autorizada.
  Sem checar `result.status !== "cancelled"`, o resultado caia em `error`, `canApplyStatus`
  bloqueava a transicao (autorizada nao regride), nada mudava, e a UI mostrava "cancelada"
  sobre uma nota que seguia valendo. O motivo mais comum e prazo: 24h para NF-e na maioria
  dos estados, por municipio na NFS-e. A UI confere o status devolvido tambem — nao confia
  no 200.
- **Status nunca regride** (`canApplyStatus`): webhook nao e ordenado e o cron pode correr junto.
  A unica transicao permitida a partir de terminal e autorizada → cancelada.
- **O unico campo que o usuario realmente digita e o NCM** (por produto) e o codigo LC 116 +
  aliquota ISS (por servico). `POST /v1/fiscal/ncm-suggestions` sugere o NCM via Lia
  (Gemini), reaproveitando cota, rate limiter e gate de plano do modulo de IA. A sugestao
  nunca e aplicada sozinha — a classificacao fiscal e responsabilidade do cliente.
  Na UI esses campos vivem em `components/features/fiscal/catalog-fiscal-fields.tsx`, uma
  secao **recolhida por padrao** no cadastro de produto e de servico. Recolhida de
  proposito: sao opcionais no cadastro e exigidos so na emissao, e quem cadastra um produto
  no dia a dia nao deve tropecar neles.
- **O destinatario tem endereco fiscal PROPRIO** (`clients/{id}.enderecoFiscal`), separado do
  campo `address` livre. Aquele e uma string unica, boa para o dia a dia e inutil para a
  SEFAZ, que valida logradouro, numero, bairro, UF e o codigo IBGE; dividir a string daria
  erro em toda ambiguidade de virgula. **So a NF-e exige endereco** — a NFS-e se contenta com
  nome e documento. Campos: `enderecoFiscal`, `inscricaoEstadual`, `indicadorIe`,
  `consumidorFinal`, todos opcionais e todos na allowlist de `clients.controller.ts`.
  `indicadorIe` vazio e **derivado** do documento (`deriveIndicadorIe`): CPF nunca vira
  "isento", que e a rejeicao 805.
- **Campo fiscal numerico em branco vira `null`, nunca 0.** `Number("")` e 0, e 0 e uma
  aliquota de ISS *valida* (Simples Nacional recolhe o ISS no DAS), entao deixar passar
  faria a nota sair com uma aliquota que o usuario nunca escolheu. `origem` e a excecao
  deliberada: ali 0 = nacional e o default documentado. Coberto por
  `fiscal-catalog-fields.test.ts`.

## Modulo Fiscal — Notas de ENTRADA (recepcao)

Complementa a emissao e e **independente** dela. Aqui NAO somos o emitente: nao
controlamos numeracao, nao assinamos e nao cancelamos. Recebemos, arquivamos e
permitimos a manifestacao.

- **So Enterprise** (`fiscalReceiving`). O add-on fiscal de Starter/Pro emite com franquia
  de 100 notas/mes (`invoice-quota.service.ts`, conta autorizada, em processamento e
  cancelada no mes de Brasilia) e NAO recebe: cada nota recebida consome unidade sem
  clique, entao nao cabe numa franquia. Sem a capacidade, `saveFiscalSettings` grava o flag
  desligado e o cron pula o tenant com `fiscal_receiving_sem_plano`. **Limite conhecido:**
  o provedor so desliga a recepcao quando o cadastro da empresa e reenviado (exige o
  certificado); ate la ele segue recebendo e cobrando. O aviso no log existe para isso.
- **Opt-in por tenant** via `habilitaManifestacao` (flag `habilita_manifestacao` no cadastro
  da empresa no Focus). Nasce **desligada** porque **cada nota recebida consome uma unidade
  do pacote mensal** — a regra do Focus e "cada nota emitida OU RECEBIDA conta como uma
  unidade". O campo e enviado sempre, inclusive `false`, para o cadastro nao precisar ser
  refeito quando a recepcao for ligada. **Ate 2026-09-03 o formulario nao mandava esse
  campo**, entao o modulo inteiro era inalcancavel: backend pronto, cron rodando, colecoes
  criadas, e nenhuma forma de ligar. O mapeamento formulario -> payload virou funcao pura
  (`lib/fiscal/settings-payload.ts`) justamente porque a falha dele e silenciosa — campo
  que nao entra ali some sem erro em lugar nenhum.
- **"Data de inicio de recebimento" e CONTROLE DE CUSTO, e e IRREVERSIVEL.** Tooltip do
  painel do Focus, verbatim: *"notas com data de emissao anterior a esta data serao
  descartadas e voce so sera cobrado pelas notas posteriores. Ao deixar em branco, iremos
  recuperar todas as notas que estiverem disponiveis. Apos alterado, este campo nao podera
  ser modificado."* Ou seja: **em branco, a primeira sincronizacao puxa todo o historico
  disponivel e cobra por nota**. O campo e `data_inicio_recebimento_nfe`
  (irmaos: `_cte`, `_nfsen`).
  O **cliente nao tem painel do Focus** — a conta e da ProOps, as empresas sao cadastradas
  sob ela. Entao deixar isso como operacao manual nossa significaria que todo tenant que
  ligasse a recepcao ficaria no escuro sobre de quando as notas vem, com o pior default
  possivel. O campo esta em `/settings/fiscal`, aparece com a recepcao ligada, **sugere
  hoje** e diz o custo de recuar (traz o historico do fornecedor — util pelos NCM — mas
  cada nota trazida consome uma unidade do pacote).
- **A data CONGELA quando a empresa ja existe no provedor** (`providerIssuerId`), nao no
  primeiro salvamento: antes de enviar o certificado nada foi comunicado e um erro de
  digitacao ainda tem conserto. Depois disso `saveFiscalSettings` ignora a entrada e a tela
  mostra o campo travado — guardar aqui um valor diferente do que esta la seria a pior
  versao do problema: a tela mostrando uma data, a cobranca seguindo outra, e nada
  denunciando. A condicao e derivada no backend (`dataInicioRecebimentoBloqueada` na view
  publica) para nao existir uma segunda copia da regra na tela.
  Guards: `fiscal-settings.data-recebimento.test.ts` e
  `fiscal-settings-card.recebimento.test.tsx`.
- **A recepcao e ligada nos DOIS ambientes.** O provedor tem
  `habilita_manifestacao` **e** `habilita_manifestacao_homologacao`, do mesmo jeito que
  separa `habilita_nfsen_producao` / `_homologacao`. Ate 2026-09-04 so a de producao era
  enviada, entao um emitente em homologacao ligava a recepcao e nao recebia nada — sem erro
  em lugar nenhum.
- **A UI vive na MESMA tela das emitidas** (`/invoices`, visao "Recebidas" do seletor no
  cabecalho), nao numa rota propria: sao as duas metades do mesmo modulo e compartilham o
  `pageId` "invoices" e o `requirePlanCapability("fiscal")`. O vocabulario e que muda — aqui nao ha numeracao
  nossa, nada e assinado por nos e nao existe cancelamento.
- **O dialogo de manifestacao descreve a CONSEQUENCIA, nao o termo tecnico** ("Confirmo a
  compra", nao "ciencia da operacao"): quem instala automacao nao sabe o jargao mas sabe
  dizer se comprou. Nada vem pre-selecionado e a escolha e zerada ao abrir para outra nota
  — herdar seria o caminho mais curto para manifestar a nota errada.
- **Sincronizacao incremental por `versao`.** Cada nota recebida tem um campo `versao`, unico
  por CNPJ e incrementado a cada alteracao (cancelamento, carta de correcao). O cursor fica em
  `received_invoice_cursors/{tenantId}` e **so avanca depois da gravacao** — se o processo
  morrer no meio, o proximo ciclo refaz o lote em vez de pular notas.
- `shouldApplyReceivedVersion` recusa versao igual ou menor: aceitar uma menor sobrescreveria
  um cancelamento com o estado anterior e a nota voltaria a parecer valida.
- **Antes da manifestacao a Receita entrega so um RESUMO.** O XML completo — com itens, NCM e
  impostos — so vem depois da **confirmacao**. Nao e limitacao do provedor: e como o fisco
  desenhou, para o destinatario assumir formalmente a operacao antes de ter o documento.
- **Manifestacao nunca e automatica.** Confirmar e declaracao formal perante a Receita;
  desconhecer uma operacao legitima tem consequencia fiscal. So `nao_realizada` exige
  justificativa (15 a 255 caracteres).
- **A sinergia que justifica o modulo:** o NCM — unico campo da emissao sem default e sem
  derivacao — vem nos itens da nota de entrada. A recepcao alimenta o catalogo fiscal que a
  emissao precisa.
- Cron `syncReceivedInvoices` roda **de hora em hora**, nao a cada 15 min como o de emissao:
  nota de entrada nao tem urgencia de segundos, o destinatario tem dias para se manifestar.
- **O detalhe da nota mostra a CHAVE DE ACESSO**, nao so valor e fornecedor. E com
  ela que se consulta a nota no portal da Receita, e e o que o contador pede — sem
  exibir, o dado existe no nosso banco e fica inalcancavel para quem precisa dele. O
  dialogo abre em TODA nota, inclusive antes da manifestacao: ali ainda nao ha itens,
  e o texto explica que o detalhamento so vem depois da confirmacao (etapa do
  processo, nao falta de dado).
- **Testar a tela em dev sem fornecedor:**
  `npx tsx src/scripts/seed-received-invoices.ts --tenant=<id>` cria 4 notas
  ficticias (resumo sem resposta, confirmada com itens e NCM, so ciencia,
  cancelada). Recusa rodar em producao; `--clean` remove so o que ele criou.
  Chaves comecam com "99", que nao e UF nenhuma, entao nao colidem com nota real.
  **Nao cobre a manifestacao** — ela faz POST no provedor e seria recusada para
  uma chave inexistente; o comportamento de interface dela esta em
  `manifest-invoice-dialog.test.tsx`. Cobre lista, itens/NCM, lancamento, aviso
  de duplicata e o estado "Lancada", que sao caminhos 100% nossos.
- **A nota vira despesa sob CLIQUE, nunca sozinha**
  (`POST /fiscal/received-invoices/:chave/lancamento`). Quem compra costuma **ja ter
  lancado a compra a mao** quando pagou o fornecedor, e um segundo lancamento nao e um
  registro a mais — e o saldo da carteira errado, que so aparece na conciliacao semanas
  depois. Por isso nao ha gatilho automatico nem configuracao para ligar um.
- **Duas guardas distintas, com desfechos distintos:**
  - `transactionId` ja gravado na nota => `already_launched`, devolve o id. Uma nota gera
    UM lancamento; dois cliques seguidos ou dois usuarios na mesma tela nao duplicam.
  - Despesa de valor equivalente na janela de **45 dias** => `needs_confirmation` com os
    candidatos, HTTP **409**. A UI **avisa e deixa seguir** (`force`): comprar duas vezes o
    mesmo valor do mesmo fornecedor e comum, e bloquear seria pior que avisar.
- **Intervalo sem `orderBy` = ASC, e o indice do projeto e DESC.** A consulta de
  duplicatas usa `where(date >=) + where(date <=)`; sem `orderBy` explicito o Firestore
  assume ASC e pede um indice NOVO, enquanto `(tenantId, type, date DESC)` ja existe.
  O sintoma so aparece em runtime (`FAILED_PRECONDITION`), no primeiro clique de alguem
  — foi assim no primeiro "Lancar". Guard: `received-invoice-transaction.index.test.ts`
  grava a cadeia que o servico monta e confere contra `firestore.indexes.json`, direcao
  inclusive. **Reusar indice existente e sempre mais barato que declarar um novo**:
  indice novo custa build, armazenamento e um deploy que ninguem lembra de fazer.
- **A busca por duplicata casa por VALOR e periodo, nao por fornecedor.** O lancamento
  manual raramente traz a razao social — quem digita escreve "material obra" ou o apelido.
  Casar por nome nao acharia quase nada e daria a falsa sensacao de que nao ha duplicata.
  A janela e larga porque o lancamento manual costuma ser feito no dia do PAGAMENTO, nao
  no da emissao: boleto de fornecedor vence em 28 ou 30 dias. Tolerancia de 2 centavos —
  quem digita a mao arredonda. Usa o indice `(tenantId, type, date)`, que ja existia.
- **O lancamento passa pelo `TransactionService`, nao escreve o doc direto**: e ele que
  valida a permissao financeira, ajusta saldo de carteira em transacao atomica e dispara o
  trigger de totais. Escrever na mao pularia os tres.
- **Nota cancelada pelo fornecedor nao vira despesa** — documento sem validade nao gera
  obrigacao financeira.
- O botao de uma nota ja lancada **vira atalho para a despesa**, nao some: sumir seria a
  pessoa procurando onde o lancamento foi parar. Guards:
  `received-invoice-transaction.test.ts` e `launch-received-invoice-button.test.tsx`.
