# Runbook de Posse do GCP — ProOps

Referência operacional da transferência dos projetos Firebase/GCP do ERP para a
conta Google da ProOps, iniciada e majoritariamente concluída em **30/08/2026**.

Este documento existe para que qualquer pessoa (ou sessão de assistente) que
pegue o assunto do zero saiba **o que já foi feito, o que falta, e o que nunca
deve ser feito**. Leia a seção "Armadilhas" antes de executar qualquer coisa.

---

## Ponto de partida

Os dois projetos do ERP viviam sob uma **conta Google anterior**, de outra
empresa. O objetivo era passá-los para a conta da ProOps sem perder nada, com o
ERP em produção o tempo todo.

**A descoberta que definiu o plano:** os projetos não pertenciam a nenhuma
organização do Cloud (`parent` vazio, dono era uma conta pessoal). Isso torna a
operação uma **transferência de posse** — IAM + faturamento —, não uma migração
de dados. O projeto nunca se move, nunca é recriado: mesmo ID, mesmos dados,
mesmas URLs, mesmas chaves.

---

## Estado atual (31/08/2026)

| | |
|---|---|
| `erp-softcode-prod` | dono ProOps + conta anterior · faturamento ProOps · **sem organização** |
| `erp-softcode` | idem |
| `gen-lang-client-0156205449` (chave Gemini) | dentro da `gestao-org` |
| `gen-lang-client-0373931877` (app pessoal) | dentro da `gestao-org`, sem faturamento |
| Conta de faturamento | `01ED4C-C3849B-0169D7` ("ProOps"), BRL, sem organização pai |
| Organização | `gestao-org` (`76291957852`), criada em 15/04/2026 junto com a conta |
| Custo do ERP | R$ 14,52/mês (líquido, medido na conta anterior). Orçamento de R$ 80 com alerta em 50/90/100% |

### Concluído

- Backup verificado: Firestore (24 MB prod / 3,9 MB dev, escopo `all_kinds`) e
  Auth (18 e 16 contas). Manifesto `.overall_export_metadata` conferido nos dois.
- Conta ProOps concedida como `roles/owner` nos dois projetos.
- Acesso verificado pela conta nova: 62 APIs, 21 functions, 15 agendamentos,
  2 chaves KMS e buckets **idênticos** ao snapshot anterior.
- E-mail de suporte da tela OAuth trocado para o endereço da ProOps.
- Faturamento dos dois projetos movido para a conta ProOps. Nada suspenso.
- Projetos órfãos apagados: `financial-492501` e dois `My First Project`.

### Pendente

1. **Observar em uso real (3–7 dias)** — ver "O que observar" abaixo.
2. **Remover a conta anterior de `roles/owner`** nos dois projetos. Irreversível.
3. **Fechar**: conferir se a marca OAuth saiu de análise; guardar cifrado ou
   apagar `.migration/backup/*.json` (contém hash de senha).
4. **Mover o ERP para a `gestao-org`** — só depois de eliminar as chaves de
   service account. Ver "Capítulo seguinte".

---

## Ferramenta

`scripts/gcp-migration.sh` — snapshots, backup e diff. **Não transfere nada**;
toda mudança de IAM e faturamento é feita por humano no console, de propósito.

```bash
./scripts/gcp-migration.sh snapshot <rótulo>   # retrato read-only
./scripts/gcp-migration.sh backup              # Firestore + Auth
./scripts/gcp-migration.sh verify              # prova que o backup FECHOU
./scripts/gcp-migration.sh diff <a> <b>        # compara dois snapshots
```

O `diff` aceita mudança em `iam.txt`, `billing.txt` e o bucket `-backup-` do
próprio script. **Qualquer outro arquivo diferente ele reprova e devolve exit 1.**

Snapshots ficam em `.migration/` (fora do git — contém IAM e PII).
Já existem: `before`, `after`, `billing`, `pre-org`.

### O que observar antes do corte

Console verde não basta. Os quatro sinais:

1. Os 15 agendamentos dispararam nas últimas 24h (coluna *Última execução*).
2. Functions sem pico de erro.
3. **Uma sincronização real de Google Calendar** — usa `calendar-refresh-token`.
4. **Uma emissão fiscal real** — usa `fiscal-secrets`.

Os dois últimos são os que valem: provam que o Cloud KMS continua acessível pela
posse nova.

---

## Armadilhas

### Nunca apagar `erp-softcode` nem `erp-softcode-prod`

Não existem cópias. A transferência mudou **posse**, não conteúdo — são os
mesmos projetos, com os mesmos dados. Apagá-los é apagar o ERP.

### O ID do projeto é imutável e carrega o nome antigo

Ele aparece na URL do console, nos e-mails das service accounts, no bucket
padrão e nas URLs das functions — que estão registradas nos webhooks do Stripe e
nos redirecionamentos OAuth. Trocar exigiria projeto novo, e aí esbarra em:

- **As chaves do Cloud KMS não se movem.** `proops-oauth` em
  `southamerica-east1`, com `calendar-refresh-token` e `fiscal-secrets`. Chave de
  KMS não sai do projeto nem com permissão total. Projeto novo significaria
  descriptografar e recriptografar material fiscal.
- **O escopo `calendar.events` é sensível** e exige verificação do Google.
  Cliente OAuth novo = nova verificação, que leva semanas.

### O Firestore está em `nam5` (EUA), o KMS está no Brasil

Location de banco Firestore é **imutável**. Se residência de dado importar para
LGPD ou contrato, é assunto próprio — exigiria banco novo e migração.

### Alterar a tela de consentimento dispara nova verificação

Trocar o e-mail de suporte já disparou uma (30/08/2026). Nada quebra enquanto
corre: o Google continua servindo a versão publicada. Mas não mexa em nome do
app, logo ou domínio sem necessidade.

---

## Capítulo seguinte: mover o ERP para a `gestao-org`

**Estado final desejado:** ERP dentro da org, política de chaves LIGADA, zero
chaves de service account em circulação.

A `gestao-org` já vem com as políticas seguras-por-padrão do Google:

```
iam.disableServiceAccountKeyCreation      ← a que importa
iam.disableServiceAccountKeyUpload
iam.automaticIamGrantsForDefaultServiceAccounts
storage.uniformBucketLevelAccess
```

`iam.allowedPolicyMemberDomains` está em `ALLOW`, então contas `@gmail.com`
continuam recebendo IAM — o risco maior de mover projeto para org não se aplica.

**Mas o ERP hoje depende de chaves JSON:**

```
github-actions-deploy@…      1 chave
firebase-adminsdk-fbsvc@…    4 chaves
```

Mover primeiro obrigaria a escolher entre desligar a política ou perder a
capacidade de rotacionar chave. **A ordem correta é tirar as chaves antes.**

### O trabalho, na ordem

1. **Functions: nada a fazer.** `apps/functions/src/init.ts` usa
   `initializeApp()` sem credencial — já pega a credencial do ambiente.
2. **CI → Workload Identity Federation.** Os workflows leem
   `FIREBASE_SERVICE_ACCOUNT_PRODUCTION` / `_STAGING` como secret. O
   `google-github-actions/auth` suporta WIF nativamente: token OIDC de curta
   duração no lugar de chave permanente. É a mudança principal.
3. **Web: depende de onde roda.** `apps/web/src/lib/firebase-admin.ts` monta
   `cert({clientEmail, privateKey})` a partir de env vars. Se o app roda em
   Google Cloud, trocar por `applicationDefault()` e a chave some. Se roda fora
   (Vercel/VPS), WIF por OIDC também serve — ou a exceção de política se aplica
   **só a esse caso**, nunca ao projeto inteiro.
4. **Revogar as chaves órfãs** do `firebase-adminsdk`.
5. **Mover**, com a política enforced:
   `gcloud beta projects move erp-softcode-prod --organization=76291957852`

Fazer isso **depois do corte**. Duas mudanças estruturais simultâneas em
produção significam não saber qual quebrou o quê.

### Por que NÃO desligar a política e mover logo

Foi a primeira ideia, e é errada: entraria na org com o principal benefício de
segurança desativado. Chave de service account não expira, não rotaciona sozinha
e vaza em log, `.env` e histórico de shell — a política existe por isso, num
projeto que guarda certificado fiscal.

---

## Contas e configurações do gcloud

Há uma configuração nomeada por conta. Conferir antes de qualquer comando que
escreva:

```bash
gcloud config configurations list
gcloud config get-value account
gcloud config configurations activate proops
```
