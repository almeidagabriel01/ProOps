# CLAUDE.md — functions/src/api/services/drive/

## Integracao com o Google Drive

Entrega a proposta na pasta do cliente, no Drive DO TENANT. **So de ida** — nada e lido
de la. Nasceu de um pedido de cliente cuja dor era "nao manter duas organizacoes": ele ja
guarda projeto, memorial e planta numa pasta por cliente, e so faltava a proposta gerada
pelo ERP chegar la sem baixar e subir a mao.

- **Consentimento SEPARADO do Google Agenda**, com o MESMO app OAuth. O refresh token vale
  para os escopos concedidos quando ele nasceu, entao acrescentar `drive.file` a lista do
  Calendar invalidaria todo consentimento existente — cada cliente com a Agenda conectada
  passaria a receber "insufficient authentication scopes" ate reconectar. Colecoes proprias
  (`google_drive_integrations`, `drive_oauth_states`), DENY nas rules, refresh token cifrado
  com a MESMA chave KMS do Calendar (`CALENDAR_TOKEN`): e a mesma classe de segredo, e uma
  chave propria exigiria provisionamento manual sem separar risco de verdade.
- **Escopo `drive.file`, jamais `drive`/`drive.readonly`.** O Google classifica `drive.file`
  como **nao sensivel**; os amplos sao **restritos** e disparam o assessment CASA, refeito a
  cada 12 meses enquanto o app existir. A consequencia de projeto: **nao conseguimos listar
  as pastas do usuario** — so o que nos mesmos criamos.
- **A pasta raiz e CRIADA por nos, nao apontada pelo usuario.** Existiu um caminho pelo
  Google Picker — a forma "correta" de escolher uma pasta existente sem sair do escopo nao
  sensivel — e ele foi **removido em 2026-09-04**. Custava API key propria, Picker API
  habilitada, origens JavaScript e cookies de terceiros, e falhava de formas que dependem do
  NAVEGADOR DO CLIENTE (no Brave abria em janela separada e o retorno nunca chegava). Exigir
  um navegador especifico para configurar o modulo nao e aceitavel. Criar nao e substituto
  pior: no `drive.file` o acesso segue o ARQUIVO, nao o caminho, entao o usuario **move a
  pasta para dentro da estrutura que ja tem**, renomeia e compartilha, e continuamos
  enxergando ela. Consequencia pratica: o modulo **nao tem nenhuma variavel `NEXT_PUBLIC_*`**
  nem chave de API — so o OAuth do backend.
- **A entrega dispara quando a proposta SAI DO RASCUNHO** (status mapeado para `sent` ou
  aprovado), nao "ao gerar o PDF". O PDF e gerado sob demanda, toda vez que alguem abre a
  proposta para conferir — subir em cada geracao encheria a pasta do cliente de rascunho,
  destruindo a organizacao que a integracao promete. Classifica pelo `mappedStatus`/
  `category` da coluna, nunca pelo rotulo (cada empresa renomeia). Nunca lanca: o status ja
  mudou e a venda nao pode ser desfeita porque o Google recusou um upload.
- **Id gravado nao e prova de que a pasta existe** — a licao que se repetiu QUATRO vezes
  neste modulo (raiz duplicada, PDF duplicado, pasta de cliente apagada, raiz apagada).
  `ensureClientFolder`, `createRootFolder` **e o `GET /drive/google/status`** conferem antes
  de usar (`files.get` com `trashed`) e recria se sumiu. O usuario apaga pasta no Drive,
  inclusive sem querer — e **lixeira nao e apagada**: a API responde normalmente com
  `trashed: true`, criar dentro dela nao da erro, e a proposta simplesmente sumia. Erro na
  consulta conta como inutilizavel: recriar a toa incomoda menos que nao entregar.
- **Desconectar PRESERVA a pasta raiz.** Apagar o documento inteiro parecia mais limpo e
  estava errado: a pasta nao e segredo, e esquecer o id dela fazia reconectar criar uma
  SEGUNDA "ProOps - Propostas" ao lado da primeira, porque o sistema nao tinha como saber
  que ja existia uma. O que some e o refresh token, que tambem e revogado no
  Google (falha na revogacao so e registrada). Consequencia: **"conectado" significa
  TER TOKEN** (`refreshTokenEnc`), nunca "o documento existe" — checar a existencia do doc
  diria conectado para quem acabou de desconectar. Se a pessoa reconectar com outra conta
  Google, a pasta antiga fica inacessivel e e recriada; nao ha estado preso.
  Existe tambem uma marca (`appProperties.proopsRoot`) em toda raiz que criamos, como
  segunda defesa — mas a garantia e o documento sobreviver.
- **Um arquivo por proposta, marcado com `appProperties.proposalId`.** O `driveFileId`
  gravado na proposta nao basta: duas chamadas simultaneas leem o campo vazio e as duas
  criam, deixando dois PDFs identicos na pasta sem erro em lugar nenhum (aconteceu no
  primeiro teste real). Antes de criar, procura pela marca — `drive.file` deixa listar o que
  o proprio app criou. **Nao casar por NOME**: duas propostas do mesmo cliente podem ter o
  mesmo titulo e uma sobrescreveria a outra.
- **`invalid_grant` nao e erro 500.** Acontece quando o usuario revoga o acesso na conta
  Google, troca a senha, ou o refresh token passa 6 meses sem uso — e tentar de novo nunca
  resolve. Responde 409 com "reconecte", marca `lastError` na integracao, e a tela de
  configuracao avisa ANTES de a pessoa tentar usar, em vez de ela descobrir com a proposta ja
  aprovada.
- **`GOOGLE_DRIVE_REDIRECT_URI` e sobrescrita de ambiente.** O default deriva de `APP_URL`,
  que **em dev e a URL de preview da Vercel, nao localhost** — conectar a partir de
  `localhost:3000` sem essa variavel da `redirect_uri_mismatch`. `resolveDriveAppOrigin()`
  usa a origem DELA tambem para o redirect final: sem isso o usuario terminava o
  consentimento sendo jogado para outro ambiente.
- **A entrega no Drive roda fora da request**, pela fila `drive_delivery_jobs` (abaixo).

  Tres mitigacoes entraram em 2026-09-08, depois de a operacao estourar o teto de
  30s do proxy com o backend seguindo em frente — o usuario via "Request timeout"
  sobre uma mudanca de status que tinha dado certo, e o financeiro so aparecia
  depois de um F5:
  1. **`buildVersionHash` ignora o que nao entra no PDF** (`status`, `commissions`,
     `searchTokens`, `primarySystem`/`primaryEnvironment` e, o pior deles,
     `driveFileId`/`driveSyncError`, que a PROPRIA entrega grava na proposta e
     assim invalidavam o cache do PDF recem-gerado). Antes, toda troca de status
     reabria o Chromium.
  2. **`syncApprovedProposalTransactions` roda ANTES da entrega no Drive.** O erro
     dele e guardado e relancado depois da entrega: precisa chegar ao cliente, mas
     nao pode cancelar um upload que nada tem a ver com ele. Assim, uma request que
     estoure o tempo do cliente ja deixou os lancamentos gravados.
  3. **Os DOIS tetos de tempo reconhecem o custo.** O que barrava de verdade era
     o middleware de timeout do proprio Express (`resolveProtectedRouteTimeoutMs`
     em `api/index.ts`): 20s para toda rota protegida, com excecao apenas do
     download de PDF. Ele responde 408 "Request timeout" e **deixa o handler
     correndo**, entao a aprovacao valia e o usuario via erro. Escrita de
     proposta passou a ter orcamento proprio de 60s
     (`PROTECTED_PROPOSAL_WRITE_TIMEOUT_MS`), e o proxy da 80s a
     `PUT/POST /v1/proposals*` (`mayRenderPdfInline` em
     `app/api/backend/[...path]/route.ts`). A ordem importa: o backend tem que
     responder ANTES de o cliente abortar, senao a mensagem util vira erro
     generico de rede. Guard: `api/protected-route-timeout.test.ts`.
  4. **A entrega so acontece quando ha motivo.** "Sair do rascunho" e uma
     TRANSICAO, e o codigo olhava so o destino: como o formulario manda `status`
     em todo salvamento, editar uma proposta ja aprovada reentregava o arquivo e
     pagava um Chromium inteiro dentro da request. Agora entrega quando a
     proposta acabou de ficar entregavel, quando mudou algum campo que aparece
     NO PDF, ou quando nunca houve entrega bem-sucedida (`driveFileId` ausente).
     A definicao de "aparece no PDF" e unica, em
     `PDF_IRRELEVANT_PROPOSAL_FIELDS` (`api/services/proposal-pdf.service.ts`),
     compartilhada com o hash de versao. Guard:
     `api/services/pdf-irrelevant-fields.test.ts`.
  5. `updateProposal` loga `proposal_update_timing` com `totalMs`,
     `approvedSyncMs` e `driveEnqueueMs`. Sem isso, "salvar proposta esta
     lento" e adivinhacao: as duas etapas fazem I/O externo e so uma renderiza
     PDF.

  **A entrega saiu da request de vez (2026-09-08).** As mitigacoes acima
  reduziam a frequencia, nao o custo: a transicao para aprovada ainda pagava um
  Chromium com o usuario esperando. Agora `updateProposal` so grava um job e
  responde:

  - `drive_delivery_jobs/{tenantId}_{proposalId}` — id DETERMINISTICO, entao
    salvar cinco vezes seguidas nao vira cinco renders do mesmo PDF; o `set`
    com merge reabre o job existente e zera as tentativas, porque ha mudanca
    nova a entregar. Admin SDK only nas rules.
  - Cron `processDriveDeliveries`, **a cada 3 minutos**. Nao e o piso do Cloud
    Scheduler (1 min) porque o custo nao esta na fatura, e sim nas LEITURAS: uma
    varredura de fila vazia e cobrada como uma leitura do Firestore, entao de
    minuto em minuto seriam 1.440/dia contra 480 aqui — e o baseline medido do
    projeto e ~1.666/dia (mediana), ou seja, o cron de 1 minuto quase dobrava o
    consumo e deslocava a linha de base do alerta de leituras. Backoff de
    1/5/15/60 min, desistindo em `MAX_DRIVE_DELIVERY_ATTEMPTS = 5` com o motivo
    gravado em `lastError`.
  - **Os recursos NAO sao os do padrao de cron.** `SCHEDULE_OPTIONS` traz
    `cpu: 0.25` (0,083 em dev), calibrado para cron que so le Firestore; aqui
    roda Chromium, entao o cron sobrescreve para `cpu: 1` e `memory: 1GiB`, os
    mesmos da funcao `pdf`. Tambem `concurrency: 1`: com cadencia de tres minutos
    e render que pode passar disso, dois ciclos simultaneos pegariam o mesmo
    job e renderizariam o mesmo PDF duas vezes. Lote de 20 por ciclo, para
    caber nos 540s.
  - **O job so nasce quando ha Drive conectado** (`isDriveConnected`, mesma
    condicao do `skipped: "sem_integracao"`). Sem isso o cron criava e
    descartava um documento a cada aprovacao, e o usuario nao ficava sabendo de
    nada: `skipped` e TERMINAL, entao conectar o Drive depois nao entrega a
    proposta ja aprovada entao, so a proxima ou um novo salvamento dela.
  - A resposta de `PUT /v1/proposals/:id` devolve `driveDeliveryQueued` **e**
    `driveNotConnected`, e a tela so avisa "vai para o Drive" quando o primeiro
    e verdade: deduzir no frontend prometeria a entrega para quem nem conectou a
    integracao. O segundo vira o convite para conectar, e sai **so para quem tem
    a capacidade `driveSync` no plano** (`shouldSuggestDriveConnection`) — sem
    esse filtro, todo tenant de plano sem a integracao levaria upsell a cada
    aprovacao de proposta.
  - **O prazo prometido na tela e o do cron.** `DRIVE_DELIVERY_PENDING_HINT`
    diz "em ate 3 minutos", que e o intervalo do agendamento; o render e o
    upload somam segundos por cima disso, entao ponta a ponta o pior caso fica
    perto de 5 min. Guard: `apps/web/src/__tests__/drive-delivery-hint.test.ts`
    le o `schedule` real e falha se a cadencia mudar sem o texto mudar junto.
  - Indice `(status, nextRunAt ASC)`, com `orderBy` explicito — mesmo par de
    `payout_attempts`.
  - **Cron agendado nao dispara no emulador**, entao existe
    `POST /internal/cron/drive-deliveries` com `x-cron-secret` para exercitar a
    entrega em dev. Sem ele o fluxo seria intestavel localmente.
  - Nao foi Cloud Tasks (roadmap 4.2) porque exige fila provisionada e o
    suporte no emulador e instavel; o desenho aqui e o mesmo de
    `payout_attempts` e `wallet_cascade_jobs`, que ja existem no projeto.
  - Consequencia a lembrar: a proposta chega ao Drive em ate ~5 min, nao na
    hora. Ninguem observa a pasta em tempo real, e perder a entrega e que era
    inaceitavel — por isso o trabalho e DOCUMENTO, nao promessa solta.
  Guards: `api/services/drive/drive-delivery-queue.test.ts`.
  - **`syncProposalToDrive` DEVOLVE o desfecho** (`delivered` | `skipped` |
    `failed`), em vez de `void`. Ela continua nao lancando, mas engolir o erro e
    retornar vazio fazia a fila ler "nao lancou" como "entregue": o job virava
    `delivered`, o retry nunca disparava, e o operador via `processed: 1` sobre
    uma entrega que nao aconteceu. `skipped` (sem integracao, proposta sem
    cliente) e terminal e NAO retenta: retentar produziria sempre o mesmo nada.
  - Entrega bem-sucedida **limpa** o `driveSyncError` da proposta; sem isso o
    documento ficava com o registro de uma falha ja resolvida.
