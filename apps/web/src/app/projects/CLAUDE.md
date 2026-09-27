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
- **O aviso e o convite passam por uma fila** (`lib/project-on-approval.ts`)
  até o `ProjectOnApprovalHost`, montado uma vez no `protected-app-shell`. A
  proposta é aprovada em três lugares (lista, formulário e quadro do CRM), e o
  formulário navega logo depois de salvar: um diálogo aberto por ele morreria
  na troca de página. Todo caminho que muda status chama
  `announceProjectOnApproval(result, proposta)`.
- **Um diálogo pós-aprovação por vez** (`lib/approval-dialog-queue.ts`): o
  convite da nota fiscal e a pergunta do projeto nunca abrem juntos, e a nota
  vem primeiro, inclusive enquanto a consulta "dá para emitir?" ainda está em
  andamento. Criar o projeto leva para a tela da obra; se a pergunta viesse
  antes, o convite da nota atrás dela se perderia na troca de página. Quem já
  está na tela não é trocado por outro que chegou depois.
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
| `_components/stage-card.tsx` | Etapa: situação, checklist, fotos |
| `_components/delivery-card.tsx` | Link de entrega e o aceite |
| `_components/project-settings-dialog.tsx` | Criação automática e roteiro de etapas |
| `_lib/projects.ts` | Rótulos, progresso (espelha o backend), filtros, atraso |
| `components/features/projects/proposal-project-button.tsx` | Atalho na proposta |
| `app/share/project/[token]/` | Página pública da entrega |
| Backend | `api/services/projects/`, `api/controllers/projects.controller.ts`, `shared-projects.controller.ts`, `api/routes/projects.routes.ts` |

## Pendente de propósito

- Evento da agenda ligado ao projeto (visita, instalação) e o portal do cliente
  com o andamento: ficam para a Onda 4.
