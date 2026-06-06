# Fase 3 — MFA (TOTP) opcional para usuários/tenants

> **Como usar este documento:** este é um spec auto-suficiente. Um agente que ler
> este arquivo deve conseguir implementar a Fase 3 do zero, entendendo o que já
> existe (e pode reaproveitar), o que falta construir, e por quê. Leia tudo antes
> de começar. Confirme cada referência de arquivo/API contra o código atual antes
> de editar (o código pode ter evoluído desde a escrita deste doc em 06/06/2026).

---

## 1. Objetivo

Permitir que **usuários comuns / membros de tenants** (roles `MASTER`, `ADMIN`,
`WK`, `MEMBER`) ativem MFA por aplicativo autenticador (TOTP) **opcionalmente**
(opt-in), a partir do próprio perfil — sem forçar.

**Decisão de produto já tomada** (ver `~/.claude/.../memory/project_superadmin_security_lgpd.md`):
- Super admin = MFA **obrigatório** (já entregue na Fase 2, em produção).
- Tenants = MFA **opcional/opt-in** nesta Fase 3. **NÃO forçar** para PME pouco
  técnica (atrito/churn + suporte de lockout não compensam).
- Forçar MFA por política de tenant ("o MASTER exige da equipe dele") fica para a
  **Fase 4** (ver §11), e só depois da recuperação estar madura.

### Non-goals da Fase 3
- Não forçar MFA para ninguém além do super admin.
- Não adicionar `hasMfa()` nas firestore rules para roles de tenant (isso seria
  forçar — é Fase 4, condicional a política).
- Não implementar SMS MFA (só TOTP).

---

## 2. O que já existe (Fase 2) — contexto

A Fase 2 entregou MFA TOTP obrigatório + allowlist para super admin. Commits:
`c4286bec` (backend), `2ec81a9d` (rules), `5a792e06` (scripts), `29028134` (frontend),
além de correções (`50ca08e6`, `fd4e3640`, etc.). Está em produção.

**Infra de MFA já habilitada no nível do projeto:**
- TOTP habilitado no Identity Platform de `erp-softcode` (dev) e `erp-softcode-prod`
  (prod), via `apps/functions/src/scripts/enable-totp.ts`. Isso vale para QUALQUER
  usuário do projeto — não é específico de super admin.

---

## 3. O que é REAPROVEITÁVEL como está (insight central)

Boa parte da Fase 3 **já está pronta e é genérica** — não foi escrita só para super
admin. Confirme, mas provavelmente dá para reusar direto:

| Peça | Arquivo | Status para tenants |
|---|---|---|
| Geração de segredo + enrollment TOTP | `apps/web/src/app/admin/setup-mfa/page.tsx` | Lógica 100% genérica (`multiFactor(user)`, `TotpMultiFactorGenerator.generateSecret/assertionForEnrollment/enroll`). Só está sob o guard de `/admin`. Precisa ser exposta no **perfil** do usuário comum (ver W1). |
| Intercept de login com código TOTP | `apps/web/src/providers/auth-provider.tsx` → `resolveTotpLogin` + `mfaResolverRef` + `getMultiFactorResolver` | **Já é genérico** — funciona para QUALQUER usuário com MFA enrolado. Assim que um tenant enrolar, o login dele já pede o código automaticamente. **Nenhuma mudança necessária.** |
| Tela de código no login | `apps/web/src/app/login/page.tsx` (bloco `requiresMfaCode`) + `apps/web/src/app/login/_hooks/useLoginForm.ts` (`handleConfirmMfaCode`) | **Já é genérico.** Nenhuma mudança necessária. |
| `mfaVerified` no contexto de auth backend | `apps/functions/src/lib/auth-context.ts` (`AuthContext.mfaVerified`, `evaluateAuthContextInvariants`) | Calculado para todos os usuários. Informativo; sem enforcement para não-super-admin. Reaproveitável se a Fase 4 quiser política. |

**Consequência prática:** o trabalho real da Fase 3 é (W1) **expor o enrollment no
perfil** e (W2) **recuperação** (reset assistido). O login com MFA já funciona de
graça para tenants assim que enrolarem.

---

## 4. O que NÃO precisa mudar

- **Backend (middleware/auth-context):** MFA opcional = sem enforcement. O backend
  já calcula `mfaVerified`; não adicione 403 por falta de MFA para roles de tenant.
- **Firestore rules:** NÃO adicione `hasMfa()` em regras de tenant (forçaria). O
  `hasMfa()` continua só em `isSuperAdmin()`.
- **Login flow:** já tratado (ver §3).

---

## 5. Work breakdown (o que construir)

### W1 — UI de enrollment/gestão de MFA no perfil do usuário

**Onde:** o perfil já existe em `apps/web/src/app/profile/` (`page.tsx`,
`_components/`, `addons/`). Adicionar uma seção/aba "Segurança" ou "Autenticação em
dois fatores".

**O que fazer:**
1. Criar um componente (ex.: `apps/web/src/app/profile/_components/mfa-section.tsx`)
   que reusa a lógica de `admin/setup-mfa/page.tsx`. Considere **extrair** essa
   lógica para um componente/hook compartilhado (ex.:
   `apps/web/src/components/auth/totp-enrollment.tsx` ou
   `src/hooks/useTotpEnrollment.ts`) e fazer tanto `/admin/setup-mfa` quanto a seção
   do perfil consumirem — evita duplicação.
2. A seção deve mostrar:
   - **Se NÃO enrolado:** botão "Ativar verificação em duas etapas" → fluxo de
     `generateSecret` → exibe chave secreta (ou QR, ver §8) → input do código →
     `assertionForEnrollment` → `enroll`. Após enrolar, instruir logout/login.
   - **Se JÁ enrolado:** status "Ativado" + botão "Desativar" (`multiFactor(user).unenroll(factor)`)
     + (opcional) regenerar.
3. **Pré-checagem de email verificado** (ver gotcha §9): se `user.emailVerified`
   for `false`, bloquear o enrollment com mensagem clara e oferecer reenviar
   verificação (`AuthService.sendVerificationEmail()` já existe).

**Reuso de UI:** componentes Shadcn em `apps/web/src/components/ui/`
(`card`, `button`, `input`, `label`, `alert`). Seguir o padrão de
`admin/setup-mfa/page.tsx`.

### W2 — Recuperação: reset de MFA assistido (CRÍTICO)

> **Por que é crítico:** sem recuperação, todo usuário que perde o autenticador =
> ticket de suporte / lockout. O Firebase TOTP **não tem backup codes nativos**
> (ver §9). A recuperação primária recomendada é **reset assistido por admin**.

**Modelo de permissão:**
- **Super admin** pode resetar o MFA de qualquer usuário.
- **MASTER do tenant** pode resetar o MFA de membros do próprio tenant (mesmo
  `tenantId`). (Avaliar se quer dar esse poder ao MASTER já na Fase 3 ou só super
  admin — decisão do produto.)

**Backend (Cloud Functions):**
- Novo endpoint, ex.: `POST /v1/admin/members/:uid/reset-mfa` (ou em rota de
  membros). Controller em `apps/functions/src/api/controllers/admin.controller.ts`
  (ou um `members.controller.ts`), rota em `admin.routes.ts`.
- Validar autorização: `req.user.isSuperAdmin` OU (`isTenantAdminRole(req.user.role)`
  E o alvo pertence ao mesmo `req.user.tenantId`). **Nunca** confiar em tenantId do
  body — usar `req.user.tenantId` (regra do projeto).
- Remover os fatores via Admin SDK:
  ```ts
  // firebase-admin 12.7.0 — confirmar assinatura exata na versão atual
  await getAuth().updateUser(uid, { multiFactor: { enrolledFactors: null } });
  ```
  (setar `enrolledFactors: null`/`[]` remove o MFA do usuário.)
- **Auditoria:** emitir evento em `security_audit_events` via `writeSecurityAuditEvent`
  (padrão da Fase 1/2 em `apps/functions/src/lib/security-observability.ts`). Sugestão
  de eventType: `mfa_reset_by_admin`. Adicionar o counter à union
  `SecurityCounterName` + `KNOWN_COUNTERS` se for incrementar contador.
- **Validação de input** (regra de controllers): validar `uid` presente; mapear erros
  (`não encontrada` → 404, `FORBIDDEN_*` → 403) com o helper de status do domínio.

**Frontend:**
- Service em `apps/web/src/services/admin-service.ts` (ou `user-service.ts`):
  `resetMemberMfa(uid)`.
- Botão "Resetar MFA" no painel admin (`/admin` ou `/admin/overview` na linha do
  membro) e/ou na gestão de equipe do tenant (`apps/web/src/app/team/`). Confirmar
  com `AlertDialog` (ação sensível).

### W3 — (Opcional/deferível) Backup codes

O Firebase TOTP não fornece backup codes. Implementar exigiria infra custom:
gerar N códigos, guardar **hasheados** (ex.: coleção `mfa_backup_codes/{uid}` com
hashes), e um caminho de login alternativo que valide um código e então
`resolver.resolveSignIn` não se aplica (backup code não é um fator Firebase).
Isso é **complexo e fora do padrão Firebase** — recomenda-se **deferir** e usar o
reset assistido (W2) como recuperação. Documentado aqui só para registro da decisão.

### W4 — Testes (obrigatório — ver Bug Fix/Feature policy no CLAUDE.md raiz)

- **Backend (Jest, `apps/functions`):** autorização do endpoint de reset —
  super admin reseta qualquer um; MASTER reseta só do próprio tenant; MASTER de
  outro tenant é negado (403); MEMBER é negado. Rodar com `--runInBand` em arquivo
  específico (NUNCA a suíte completa — trava a máquina, ver memória
  `feedback_jest_full_suite_freezes`).
- **Frontend (Vitest):** lógica pura de pré-checagem (email verificado, validação
  do código 6 dígitos) extraída em helper testável.
- **Rules:** se a Fase 3 NÃO mexer em rules (esperado), não há novo teste de rules.

---

## 6. Decisões de design & racional

- **Opt-in, não forçado:** público PME; forçar gera atrito/churn e suporte. Ver §1.
- **Recuperação por reset assistido (não backup codes):** Firebase não tem backup
  codes nativos; reset por Admin SDK é simples, auditável e suficiente.
- **Login já funciona:** o intercept é genérico — não reescrever.
- **Sem enforcement backend/rules:** opcional = sem 403 e sem `hasMfa()` em rules
  para tenants.

---

## 7. Recuperação — detalhe (releia antes de liberar)

Fluxo de "perdi meu autenticador":
1. Usuário contata o admin (super admin ou MASTER do tenant).
2. Admin abre a gestão do usuário → "Resetar MFA" → confirma.
3. Backend remove os fatores (Admin SDK) + grava auditoria.
4. Usuário loga normalmente (sem código) e pode re-enrolar pelo perfil.

Sem este fluxo, **não liberar** o opt-in para tenants — senão vira lockout +
suporte manual via console Firebase.

---

## 8. Firebase / Identity Platform — notas

- TOTP **já habilitado** em dev e prod (Identity Platform). Não precisa rodar
  `enable-totp.ts` de novo, a menos que crie um novo projeto.
- **QR code:** a Fase 2 exibiu a **chave secreta para entrada manual** (sem lib de
  QR, para não adicionar dependência). Para tenants (público menos técnico), avalie
  adicionar um QR de verdade (`TotpSecret.generateQrCodeUrl(...)` já gera a URL
  `otpauth://`; renderizar exigiria uma lib tipo `qrcode` — passa pelo
  `dependency-review` do CI). Decisão de UX a tomar na hora.
- APIs do client SDK (`firebase/auth`): `multiFactor`, `TotpMultiFactorGenerator`,
  `getMultiFactorResolver`, `TotpSecret`. Já usadas no projeto.

---

## 9. Gotchas aprendidos na Fase 2 (não tropece de novo)

1. **Email verificado é PRÉ-REQUISITO de enrollment.** O Firebase recusa
   `mfaEnrollment:start` (400) se `emailVerified=false`. Para tenants reais isso é
   normal (eles verificam o email no signup), mas a UI deve checar antes e orientar.
   Script de apoio: `apps/functions/src/scripts/verify-user-email.ts` (admin).
2. **O emulador de Auth do Firebase NÃO suporta TOTP** (bug firebase-tools #6224 —
   "Missing phoneEnrollmentInfo"). Para testar manualmente o enrollment, use o
   **projeto dev real** (`erp-softcode`), não `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`.
   Em localhost, o frontend usa o Auth real por padrão; o backend (`npm run dev:backend`)
   sobe só o emulador de Functions apontando para o dev real.
3. **Após enrolar, o token atual não tem `sign_in_second_factor`** — precisa
   logout/login para o token passar a carregar o 2º fator. A UI deve instruir isso.
4. **Scripts standalone precisam de credencial.** Os `.env.<projeto>` do functions
   NÃO têm `FIREBASE_*` (service account); use `GOOGLE_APPLICATION_CREDENTIALS`
   apontando para uma chave de service account baixada do console +
   `GCLOUD_PROJECT=<projeto>`. Helper: `apps/functions/src/scripts/_script-init.ts`.
5. **Não rode a suíte Jest completa do functions** (trava a máquina). Rode o arquivo
   específico com `--runInBand`.

---

## 10. Rollout sugerido (Fase 3)

1. Implementar W1 + W2 + W4 em `develop`.
2. Validar em dev com uma conta de tenant de teste (email verificado): enrolar pelo
   perfil → logout/login pede código → reset pelo admin → re-enrolar.
3. Merge para `main` (você faz). Nada force-on: é opt-in, então o deploy não afeta
   quem não enrolar.
4. Comunicar aos clientes que a opção existe (changelog/onboarding).

Risco: **baixo** (opt-in, sem enforcement). Diferente da Fase 2, não há janela de
lockout nem flip perigoso de env.

---

## 11. Fase 4 (futuro) — enforcement por política de tenant

Se um dia quiser permitir que um tenant **exija** MFA da equipe dele:
- Flag por tenant (ex.: `tenants/{id}.requireMfa = true`).
- Backend: no middleware/auth-context, se o tenant do usuário exige MFA e
  `mfaVerified=false` → 403 (análogo ao `SUPERADMIN_MFA_REQUIRED`, mas por tenant).
- Rules: `hasMfa()` condicional ao flag do tenant (cuidado: rules não leem env, e
  ler o doc do tenant em toda regra tem custo — avaliar).
- Recuperação (W2) é **pré-requisito absoluto** antes de qualquer enforcement.
- Rollout cuidadoso por tenant (não global), com aviso prévio aos usuários.

---

## 12. Índice rápido de arquivos (mapa)

| Caminho | Papel |
|---|---|
| `apps/web/src/app/admin/setup-mfa/page.tsx` | Enrollment TOTP atual (super admin) — base para extrair/reusar |
| `apps/web/src/providers/auth-provider.tsx` | `resolveTotpLogin` (login intercept genérico) — não mexer |
| `apps/web/src/app/login/page.tsx` + `_hooks/useLoginForm.ts` | Tela de código no login (genérico) — não mexer |
| `apps/web/src/app/profile/` | **Onde adicionar a seção de MFA (W1)** |
| `apps/web/src/app/team/` | Gestão de equipe — possível ponto do botão "Resetar MFA" (W2) |
| `apps/web/src/services/admin-service.ts` / `user-service.ts` | Adicionar `resetMemberMfa` (W2) |
| `apps/functions/src/api/controllers/admin.controller.ts` + `admin.routes.ts` | Endpoint de reset de MFA (W2) |
| `apps/functions/src/lib/auth-context.ts` | `mfaVerified` já disponível; base para Fase 4 |
| `apps/functions/src/lib/security-observability.ts` | Auditoria do reset (`writeSecurityAuditEvent` + counter) |
| `apps/functions/src/scripts/verify-user-email.ts` | Forçar email verificado (apoio/dev) |
| `apps/functions/src/scripts/audit-superadmins.ts` | Referência de como auditar contas/MFA via Admin SDK |
| `firebase/firestore.rules` | `hasMfa()` só em `isSuperAdmin()` — NÃO estender para tenants na Fase 3 |
| `~/.claude/.../memory/project_superadmin_security_lgpd.md` | Histórico completo das Fases 1 e 2 |
