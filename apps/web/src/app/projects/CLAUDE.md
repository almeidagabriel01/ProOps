# CLAUDE.md — src/app/projects/ (Projetos de instalação)

O que acontece depois da venda: cada obra vira um projeto com etapas, checklist,
fotos, técnico responsável, prazo e o aceite do cliente na entrega, pelo link.
Onda 3 do roadmap de UX (2026-09-26).

## As seis perguntas, respondidas pelo dono do produto

| # | Pergunta | Decisão |
|---|---|---|
| 1 | Permissão | pageId próprio `projects` (`lib/permissions/pages.ts`): ver/criar/editar/excluir. Um técnico pode ter só Projetos, sem propostas nem financeiro |
| 2 | Plano | capacidade `projects`: Pro e Enterprise. Sem add-on no Starter |
| 3 | Demo | sim, só leitura: o seed põe um projeto em andamento no tenant `demo` |
| 4 | Rules | `projects`: leitura do tenant (e `isDemoRead`), escrita só pela API. `project_settings` e `shared_projects`: nenhum acesso do cliente |
| 5 | Tutorial | passo `/projects` no capítulo Vendas, logo depois de Propostas (segue a ordem do menu) |
| 6 | Nichos | nos dois, mesmo nome. Muda só o roteiro padrão: automação nasce com Infraestrutura, Instalação, Configuração e Entrega; cortinas com Medição, Produção, Instalação e Entrega |

**Na navegação** (revisto em 2026-09-27) Projetos não tem ícone próprio na
dock: mora no grupo de Propostas, com o seletor "Propostas | Projetos" no
cabeçalho das duas telas. Ver `components/layout/CLAUDE.md`, seção Grupo.

Outras decisões: na aprovação a ProOps **pergunta se a venda tem instalação**
(nem toda venda é obra; revisto em 2026-09-26, a primeira versão criava
sempre). Em "Configurar etapas" a empresa escolhe `ask` (padrão), `always` ou
`never`; o **técnico é um membro da equipe**; o
**aceite da entrega é pelo link**, com nome, CPF/CNPJ, data e IP; as etapas vêm
de um **roteiro por empresa**, com padrão por nicho; as **fotos são por etapa**
e contam no armazenamento do plano.

## Como funciona

- **Leitura direta no Firestore, escrita pela API** (`services/projects-service.ts`),
  como o CRM. A lista lê uma vez; o detalhe escuta em tempo real
  (`ProjectsService.subscribe`): o técnico marca o item no celular e o
  escritório vê na hora.
- **Um documento por obra, com as etapas dentro.** Toda mudança de etapa,
  checklist ou foto passa por `mutateStages` no backend, numa transação: duas
  pessoas marcando itens ao mesmo tempo não se sobrescrevem.
- **Id determinístico** `proposal_{proposalId}`: aprovar, reverter e aprovar de
  novo encontra o mesmo projeto. O `updateProposal` chama
  `resolveProjectOnApproval` na transição para aprovada e devolve
  `projectCreated` (modo `always`) ou `projectSuggested` (modo `ask`, sem obra
  ainda).
- **Uma janela só depois de aprovar: "Proposta aprovada"**
  (`ApprovalNextStepsHost`, em `components/features/proposal/`, montado uma vez
  no `protected-app-shell`). Cada próximo passo que couber na venda é uma linha
  opcional (emitir a nota, criar a obra, abrir o contrato da mensalidade), e
  "Fechar" dispensa todos. Até 2026-09-29 eram até três janelas seguidas,
  cada uma travando a tela. Criar a obra pela janela não sai dela (a linha
  vira "Obra criada" com "Abrir a obra"); só a obra criada sozinha (modo
  `always`) sem mais nada a decidir vira um aviso curto, sem janela.
- **O estado é por proposta, em módulo** (`lib/approval-next-steps.ts`): a
  proposta é aprovada em três lugares (lista, formulário e quadro do CRM), e o
  formulário navega logo depois de salvar; o host no shell sobrevive à troca
  de página. Todo caminho que muda status chama
  `announceProjectOnApproval(result, proposta)` (`lib/project-on-approval.ts`).
  A janela espera a consulta "dá para emitir?" (até 20s), para não abrir sem a
  nota e mudar de tamanho depois.
- **A tela da obra responde na hora** (`_lib/project-overlay.ts`): checklist,
  situação da etapa, responsável e datas entram numa camada de "pendente" por
  cima do que o listener entrega. A entrada sai quando o listener mostra o
  mesmo valor, ou quando o servidor recusa (a tela volta e avisa). Antes cada
  clique esperava a ida e volta da API.
- **Criar pela proposta** (`ProposalProjectButton`, na visualização): abre o
  projeto se existe, ou cria a partir de proposta aprovada. O backend recusa
  proposta que não está aprovada (409).
- **Fotos sobem pelo backend**, não direto no Storage: as regras do Storage só
  deixam master e admin gravarem, e o técnico é membro. O navegador reduz a
  foto (1600 px, WebP) e envia como data URL; o backend aceita JPG, PNG e WebP
  de até 700 KB, grava em `tenants/{id}/projects/{projeto}/{etapa}/` com token
  de download e recusa com 402 se o armazenamento do plano estiver cheio. A
  pasta `projects/` conta no teto (`shared/storage-usage.ts`).
- **O técnico responsável** vem de `GET /v1/projects/assignees`, porque as
  regras não deixam membro listar a equipe.
- **Configurações** ("Configurar etapas", só o administrador) ficam num
  diálogo da própria lista, não em `/settings`: são a criação automática e o
  roteiro de etapas. Mudar o roteiro não mexe nos projetos que já existem.
- **Visita da etapa na Agenda** (2026-09-27). Cada etapa tem "Marcar visita"
  (data, hora e duração, ou dia inteiro), com a permissão de editar Projetos, e
  não a da Agenda: é quem cuida da obra que marca. Vira um evento em
  `calendar_events` com `projectId`/`projectStageId`, título "Etapa: obra", o
  endereço da obra e o link para ela, e vai para o Google Agenda como qualquer
  outro. **A data mora no evento**: a etapa guarda só o espelho
  (`stage.schedule`), regravado em todo caminho que escreve o evento (marcar
  pela obra, editar ou excluir na Agenda, mudança vinda do Google;
  `mirrorStageScheduleFromEvent` só mexe se a etapa ainda aponta para aquele
  evento). O espelho existe porque o técnico pode não ter a Agenda, e porque o
  cliente vê a data na página da entrega e a próxima visita no portal.
  Cancelar na Agenda tira a data da etapa. O técnico da obra recebe
  `project_visit_scheduled` (direto, e-mail ligado) quando a visita é nova ou
  muda de horário, se não foi ele quem marcou. Excluir a obra apaga as visitas
  da Agenda. O vínculo nunca vem do corpo da requisição da Agenda
  (`pickEventLinks` só herda do evento existente). Rotas:
  `PUT|DELETE /v1/projects/:id/stages/:stageId/schedule`. Mesmas seis respostas
  do módulo: Pro e Enterprise, demonstração com uma visita de exemplo (seed),
  sem coleção nova, item no tutorial do passo Projetos, igual nos dois nichos.
- **Itens da obra** (2026-10-05, pedido de um cliente de automação). Os
  produtos da proposta, copiados para `project.items` na criação, para quem
  compra e quem instala marcar cada um: pendente, compra solicitada, em
  estoque, instalado (`statusAt`, `statusBy`, `statusByName`). A tela mostra
  "X de Y instalados", filtra pendentes e instalados, agrupa por grupo e local
  da proposta e marca em lote. Decisões do dono do produto:
  - **Versão simples:** cópia da proposta, status à mão. Não mexe em estoque
    nem no financeiro (não baixa nem soma estoque, não cria conta a pagar), e
    mudar a proposta depois não muda a lista.
  - **Nenhum valor.** O técnico lê o projeto direto do Firestore, então a
    cópia é por lista de campos permitidos (`buildProjectItemsFromProposal`,
    `PROJECT_ITEM_FIELDS` em `api/services/projects/project-items.ts`), nunca
    um spread da linha: preço, markup, total e pagamento ficam de fora, e um
    campo de preço novo na proposta não vaza sozinho. Testes afirmam isso na
    criação, na importação e na demonstração.
  - **Só produtos.** Serviço ("instalação") não se compra nem se instala como
    peça; o andamento dele é o das etapas. Linha inativa também fica de fora.
  - **Medida** (largura x altura, ou a medida linear) guardada na linha por
    medida, com a quantidade em peças; a tela só a mostra no nicho que cobra
    por medida (`pricing.dimensionModes`: persianas, vidraçaria, marcenaria e
    climatização), pelo mesmo rótulo da proposta.
  - **Permissão:** ver a lista é ver Projetos; marcar é editar Projetos
    (`PUT /v1/projects/:id/items/status`, numa transação; PUT e não PATCH
    porque o CORS e o `callApi` não conhecem PATCH). O preset "Técnico" da
    Equipe passou a ter Projetos com ver e editar, sem criar nem excluir, e o
    link "Ver proposta" só aparece para quem vê propostas.
  - **Obra antiga** (sem `items`): "Trazer itens da proposta"
    (`POST /v1/projects/:id/items/import`) lê a proposta pelo Admin SDK e grava
    a lista; só preenche lista vazia (409 se já existe). É o que dá a lista ao
    técnico sem ele ver a proposta. Projeto avulso não mostra a seção.
  - Plano, rules e tutorial: os de Projetos (sem capacidade nem coleção nova;
    uma linha a mais no checklist do passo). Demonstração: a obra de exemplo
    de cada nicho tem itens com situações variadas (`itemStatuses` no dataset,
    montados pela mesma função do backend no motor).
- **Entrega:** `POST /v1/projects/:id/delivery-link` gera (ou reaproveita) o
  link `/share/project/{token}`, enviado pelo WhatsApp ou e-mail da empresa. O
  cliente confere etapas, checklist e fotos (sem notas internas nem ids da
  equipe, `toClientProjectView`) e aceita; o projeto fica concluído e o sino
  avisa (`project_delivery_accepted`).

## Arquivos

| Arquivo | O quê |
|---|---|
| `page.tsx` | Lista com filtro (em andamento, meus, concluídos, todos) |
| `[id]/page.tsx` | A obra: andamento, situação, responsável, datas, etapas, entrega, observações |
| `_components/stage-card.tsx` | Etapa: situação, visita, checklist, fotos |
| `_components/stage-schedule-dialog.tsx` | Marcar ou remarcar a visita da etapa |
| `lib/projects/stage-schedule.ts` | Formato da data e montagem do envio (obra, entrega e portal) |
| `_components/delivery-card.tsx` | Link de entrega e o aceite |
| `_components/project-items-card.tsx` | Itens da obra: situação de cada produto, filtro, ação em lote |
| `_lib/project-items.ts` | Rótulos, contagem, agrupamento, medida por nicho e a camada de resposta imediata dos itens |
| `_components/project-settings-dialog.tsx` | Criação automática e roteiro de etapas |
| `_lib/projects.ts` | Rótulos, progresso (espelha o backend), filtros, atraso |
| `components/features/projects/proposal-project-button.tsx` | Atalho na proposta |
| `app/share/project/[token]/` | Página pública da entrega |
| `components/features/field-service/project-equipment-dialog.tsx` | "Registrar equipamentos": os produtos da proposta viram equipamentos do cliente (só com `fieldService`). Lê as linhas por `GET /v1/projects/:id/proposal-equipment` (Projetos ver + Equipamentos criar, sem preço), e não pelo SDK: quem registra costuma ser o técnico, que não deve ler a proposta |
| Backend | `api/services/projects/` (a visita em `project-schedule.ts`, puro, e `project-schedule-store.ts`; os itens em `project-items.ts`, puro), `api/controllers/projects.controller.ts`, `shared-projects.controller.ts`, `api/routes/projects.routes.ts` |

## Pendente de propósito

- Documento em PDF da obra: nem ordem de serviço para o técnico, nem termo de
  entrega. O aceite da entrega fica registrado pelo link (nome, data, IP). O
  chamado técnico depois da entrega é a ordem de serviço (`/service-orders`),
  que tem PDF próprio.
- Os equipamentos NÃO nascem sozinhos na entrega: quem registra escolhe, na
  obra, o que da proposta é aparelho (o split) e o que é material (a
  tubulação). Um campo por produto dizendo "é equipamento" automatizaria, mas
  exigiria mexer no formulário de produto inteiro por um ganho pequeno.
