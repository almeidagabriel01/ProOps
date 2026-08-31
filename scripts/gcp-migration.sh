#!/usr/bin/env bash
#
# Safety net for transferring ownership of the Firebase/GCP projects to a
# different Google account.
#
# WHAT THIS IS NOT: it does not transfer anything. Every IAM and billing change
# is done by a human in the console, on purpose. This script only takes
# read-only snapshots, backs up the data, and proves nothing was lost.
#
#   ./scripts/gcp-migration.sh snapshot before   # run BEFORE any IAM change
#   ./scripts/gcp-migration.sh backup            # Firestore + Auth export
#   ./scripts/gcp-migration.sh verify            # prova que o backup fechou
#   ...transfer ownership in the console...
#   ./scripts/gcp-migration.sh snapshot after    # run from the NEW account
#   ./scripts/gcp-migration.sh diff before after
#
# Why an ownership transfer is safe: the project is not moved or recreated. Same
# project id, same data, same URLs, same KMS keys. The real risk is not the
# transfer itself — it is losing access (owner removed too early) or the project
# being suspended because billing was unlinked and never relinked. Both are
# survivable only if a backup exists, which is what `backup` is for.
#
set -euo pipefail

# shellcheck disable=SC2206
PROJECTS=(${PROJECTS_OVERRIDE:-erp-softcode-prod erp-softcode})
OUT_DIR="${OUT_DIR:-.migration}"

log()  { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }

# Every capture is best-effort: a missing permission must not abort the whole
# snapshot, or you get no baseline at all right when you need one.
capture() {
  local file="$1"; shift
  if "$@" > "$file" 2>/dev/null; then
    printf '    %-22s %s\n' "$(basename "$file" .txt)" "$(wc -l < "$file" | tr -d ' ') linhas"
  else
    echo "(sem permissão ou API desabilitada)" > "$file"
    warn "$(basename "$file" .txt): não consegui ler"
  fi
}

# Locations onde o projeto pode ter KMS. `global` entra porque é o default de
# quem cria pelo console sem escolher região.
KMS_LOCATIONS="${KMS_LOCATIONS:-southamerica-east1 southamerica-east2 us-central1 global}"

kms_snapshot() {
  local project="$1" achou=0
  for loc in $KMS_LOCATIONS; do
    for ring in $(gcloud kms keyrings list --project "$project" --location "$loc" \
                    --format='value(name)' 2>/dev/null); do
      if gcloud kms keys list --project "$project" --location "$loc" \
           --keyring "${ring##*/}" \
           --format='value(name,purpose,primary.state)' 2>/dev/null | grep -q .; then
        gcloud kms keys list --project "$project" --location "$loc" \
          --keyring "${ring##*/}" --format='value(name,purpose,primary.state)' 2>/dev/null
        achou=1
      fi
    done
  done
  [ "$achou" -eq 1 ]
}

snapshot() {
  local tag="${1:?uso: snapshot <before|after|...>}"
  local account; account="$(gcloud config get-value account 2>/dev/null)"
  log "Snapshot '$tag' — conta ativa: ${account:-<nenhuma>}"

  for project in "${PROJECTS[@]}"; do
    local dir="$OUT_DIR/$tag/$project"
    mkdir -p "$dir"
    printf '  %s\n' "$project"

    capture "$dir/project.txt" gcloud projects describe "$project" \
      --format='yaml(projectId,projectNumber,lifecycleState,parent,labels)'
    capture "$dir/iam.txt" gcloud projects get-iam-policy "$project" \
      --flatten='bindings[].members' --format='value(bindings.role,bindings.members)' --sort-by=bindings.role
    capture "$dir/apis.txt" gcloud services list --enabled --project "$project" --format='value(config.name)'
    capture "$dir/service-accounts.txt" gcloud iam service-accounts list \
      --project "$project" --format='value(email,disabled)'
    # Nomes das chaves, NUNCA material criptográfico — que aliás não sai do KMS
    # nem com permissão total. É essa propriedade que torna "criar projeto novo"
    # uma migração de dado em vez de um rename.
    # Descobre keyring e location em vez de assumir: chutar aqui já custou um
    # snapshot sem a parte mais importante.
    if kms_snapshot "$project" > "$dir/kms.txt" 2>/dev/null; then
      printf '    %-22s %s chaves\n' kms "$(wc -l < "$dir/kms.txt" | tr -d ' ')"
    else
      echo "(nenhuma chave encontrada)" > "$dir/kms.txt"
      warn "kms: nada encontrado — confirme no console antes de seguir"
    fi
    capture "$dir/buckets.txt" gcloud storage buckets list --project "$project" \
      --format='value(name,location,storageClass)'
    capture "$dir/functions.txt" gcloud functions list --project "$project" \
      --format='value(name,state,environment)'
    capture "$dir/scheduler.txt" gcloud scheduler jobs list --project "$project" \
      --location=southamerica-east1 --format='value(name,schedule,state)'
    capture "$dir/secrets.txt" gcloud secrets list --project "$project" --format='value(name)'
    capture "$dir/firestore.txt" gcloud firestore databases list --project "$project" \
      --format='value(name,type,locationId)'
    capture "$dir/billing.txt" gcloud billing projects describe "$project" \
      --format='value(billingAccountName,billingEnabled)'
  done

  ok "gravado em $OUT_DIR/$tag/"
  warn "o cliente OAuth e a tela de consentimento NÃO aparecem no gcloud —"
  warn "confira à mão no console: APIs & Services → Credentials / OAuth consent screen"
}

diff_snapshots() {
  local a="${1:?uso: diff <antes> <depois>}" b="${2:?}"
  log "Diferenças entre '$a' e '$b'"
  local sujo=0

  for project in "${PROJECTS[@]}"; do
    for arquivo in "$OUT_DIR/$a/$project"/*.txt; do
      [[ -f "$arquivo" ]] || continue
      local nome; nome="$(basename "$arquivo")"
      local outro="$OUT_DIR/$b/$project/$nome"
      [[ -f "$outro" ]] || { warn "$project/$nome só existe em '$a'"; sujo=1; continue; }

      if ! diff -q "$arquivo" "$outro" >/dev/null; then
        # `|| true` NÃO é decoração: `diff` devolve 1 quando os arquivos diferem
        # e, com `set -e` + `pipefail`, isso matava o script no PRIMEIRO achado —
        # o segundo projeto nunca era conferido e nenhum veredito era impresso.
        # Um diff que morre calado é pior do que nenhum diff.
        local delta
        delta="$(diff "$arquivo" "$outro" || true)"

        case "$nome" in
          # IAM e billing MUDAM de propósito: são o objetivo da transferência.
          iam.txt|billing.txt)
            printf '  \033[33m~ %s/%s (esperado — é o que a transferência muda)\033[0m\n' \
              "$project" "$nome"
            ;;
          buckets.txt)
            # O `backup` deste script cria um bucket. Se a ÚNICA diferença for
            # ele, é ruído nosso, não perda de nada.
            if [ -z "$(printf '%s\n' "$delta" | grep -E '^[<>]' | grep -v -- '-backup-')" ]; then
              printf '  \033[33m~ %s/%s (só o bucket de backup deste script)\033[0m\n' \
                "$project" "$nome"
            else
              printf '  \033[31m✗ %s/%s MUDOU e não deveria\033[0m\n' "$project" "$nome"
              sujo=1
            fi
            ;;
          *)
            printf '  \033[31m✗ %s/%s MUDOU e não deveria\033[0m\n' "$project" "$nome"
            sujo=1
            ;;
        esac
        printf '%s\n' "$delta" | head -12 | sed 's/^/      /'
      fi
    done
  done

  if [[ $sujo -eq 0 ]]; then
    ok "nada além de IAM e faturamento mudou — a transferência preservou tudo"
  else
    printf '\n  \033[31mAlgo mudou fora do esperado. NÃO remova o dono antigo ainda.\033[0m\n'
    return 1
  fi
}

backup() {
  log "Backup — a única coisa que te salva se o projeto for suspenso"
  warn "Firestore export é uma leitura da base inteira: tem custo e leva tempo."
  read -r -p "  Seguir? [s/N] " r
  [[ "$r" =~ ^[sS]$ ]] || { echo "  abortado."; return 0; }

  local stamp; stamp="$(date +%Y%m%d-%H%M%S)"
  for project in "${PROJECTS[@]}"; do
    # O bucket do export TEM que estar na mesma location do banco. O Firestore
    # aqui está em nam5 (multi-região EUA) enquanto o KMS está em
    # southamerica-east1 — assumir uma região só devolve um INVALID_ARGUMENT
    # que não explica nada. Descobre em vez de assumir.
    local db_loc bucket_loc bucket
    db_loc="$(gcloud firestore databases describe --project "$project" \
                --format='value(locationId)' 2>/dev/null)"
    if [ -z "$db_loc" ]; then
      warn "$project: não consegui ler a location do Firestore — pulando o export"
      continue
    fi
    case "$db_loc" in
      nam5|nam*) bucket_loc="us" ;;    # multi-região EUA
      eur3|eur*) bucket_loc="eu" ;;    # multi-região Europa
      *)         bucket_loc="$db_loc" ;;
    esac
    bucket="gs://${project}-backup-${bucket_loc}"
    printf '  %s (firestore em %s) → %s\n' "$project" "$db_loc" "$bucket"

    if gcloud storage buckets describe "$bucket" --project "$project" &>/dev/null; then
      local atual
      atual="$(gcloud storage buckets describe "$bucket" --project "$project" \
                 --format='value(location)' 2>/dev/null | tr '[:upper:]' '[:lower:]')"
      if [ "$atual" != "$bucket_loc" ]; then
        warn "$bucket existe em '$atual', mas o banco está em '$db_loc'. Apague-o e rode de novo:"
        warn "  gcloud storage rm --recursive $bucket --project $project"
        continue
      fi
    else
      gcloud storage buckets create "$bucket" --project "$project" \
        --location="$bucket_loc" --uniform-bucket-level-access
    fi

    # assíncrono: o comando volta e a exportação segue no servidor
    gcloud firestore export "$bucket/firestore-$stamp" --project "$project" --async \
      && ok "export do Firestore disparado (acompanhe com: gcloud firestore operations list --project $project)"

    # Auth vai para arquivo LOCAL de propósito: backup dentro do mesmo projeto
    # não ajuda em nada se o problema for perder acesso ao projeto.
    mkdir -p "$OUT_DIR/backup"
    if npx --yes firebase-tools auth:export "$OUT_DIR/backup/${project}-auth-$stamp.json" \
         --format=json --project "$project" 2>/dev/null; then
      ok "usuários do Auth em $OUT_DIR/backup/${project}-auth-$stamp.json"
      warn "esse arquivo tem hash de senha e e-mail: NÃO commitar, guardar cifrado"
    else
      warn "auth:export falhou — rode manualmente: npx firebase-tools auth:export ... --project $project"
    fi
  done
}

# Um export do Firestore só está fechado quando o manifesto
# `.overall_export_metadata` existe. A operação some da lista com `done: true`
# mesmo quando falhou no meio, então "done" não prova nada — o manifesto prova.
verify_backup() {
  local falhou=0
  log "Conferindo os backups"

  for project in "${PROJECTS[@]}"; do
    local db_loc bucket_loc bucket
    db_loc="$(gcloud firestore databases describe --project "$project" \
                --format='value(locationId)' 2>/dev/null)"
    case "$db_loc" in
      nam5|nam*) bucket_loc="us" ;;
      eur3|eur*) bucket_loc="eu" ;;
      *)         bucket_loc="$db_loc" ;;
    esac
    bucket="gs://${project}-backup-${bucket_loc}"
    printf '  %s\n' "$project"

    local manifesto
    manifesto="$(gcloud storage ls "$bucket/**overall_export_metadata" \
                   --project "$project" 2>/dev/null | tail -1)"
    if [ -z "$manifesto" ]; then
      warn "    Firestore: SEM manifesto — o export não fechou"
      falhou=1
    else
      local bytes
      bytes="$(gcloud storage du -s "$bucket" --project "$project" 2>/dev/null | awk '{print $1}')"
      ok "    Firestore: ${bytes:-?} bytes — ${manifesto##*/}"
      # all_kinds = base inteira. Se aparecer kind_<algo>, o export foi filtrado
      # e NÃO serve de backup completo.
      if gcloud storage ls "$bucket/**" --project "$project" 2>/dev/null | grep -q all_kinds; then
        ok "    escopo: todas as coleções (all_namespaces/all_kinds)"
      else
        warn "    escopo: export FILTRADO — não cobre a base inteira"
        falhou=1
      fi
    fi

    local auth
    auth="$(ls -t "$OUT_DIR/backup/${project}-auth-"*.json 2>/dev/null | head -1)"
    if [ -z "$auth" ]; then
      warn "    Auth: nenhum export local"
      falhou=1
    else
      local n
      n="$(python3 -c "import json,sys; print(len(json.load(open(sys.argv[1])).get('users',[])))" "$auth" 2>/dev/null)"
      ok "    Auth: ${n:-?} contas em ${auth##*/}"
    fi
  done

  if [ "$falhou" -eq 0 ]; then
    ok "backups completos — pode seguir para a transferência"
  else
    printf '\n  \033[31mBackup incompleto. NÃO comece a transferência.\033[0m\n'
    return 1
  fi
}

case "${1:-}" in
  snapshot) shift; snapshot "$@" ;;
  diff)     shift; diff_snapshots "$@" ;;
  backup)   backup ;;
  verify)   verify_backup ;;
  *) sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//' ; exit 1 ;;
esac
