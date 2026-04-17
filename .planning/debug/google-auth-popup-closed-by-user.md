---
status: awaiting_human_verify
trigger: "Google login popup carrega por bastante tempo e falha com auth/popup-closed-by-user mesmo sem o usuário fechar nada."
created: 2026-04-16T00:00:00Z
updated: 2026-04-16T02:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — The COOP warning "Cross-Origin-Opener-Policy policy would block the window.close call" is emitted by the browser when the Google OAuth popup (accounts.google.com) tries to call window.close() via the gapi script after auth completes. Even with same-origin-allow-popups on the opener, the browser still logs this enforcement event because the popup is cross-origin. This is inherent to signInWithPopup with any COOP policy stricter than unsafe-none.
test: Replaced signInWithPopup with signInWithRedirect in useLoginForm.ts. Added getRedirectResult() useEffect that runs on login page mount to capture the auth result when Google redirects back. No popup is opened, so window.close() can never be called.
expecting: No COOP warning in console after Google login. Auth flow still works correctly via redirect.
next_action: User should test Google login and confirm no COOP warning in console

reasoning_checkpoint:
  hypothesis: "signInWithPopup opens a cross-origin popup; gapi inside that popup calls window.close() after auth. COOP same-origin-allow-popups still causes browser to log a warning when a cross-origin popup tries to close itself. The warning is inherent to the popup mechanism."
  confirming_evidence:
    - "Warning explicitly says 'COOP policy would block the window.close call' — matches exactly the gapi popup close behavior"
    - "Warning source is cb=gapi.loaded_0 — the Google auth script inside the popup at accounts.google.com"
    - "Switching to signInWithRedirect eliminates the popup entirely — no popup means no window.close() call"
  falsification_test: "If the warning persists after switching to signInWithRedirect, the hypothesis is wrong"
  fix_rationale: "signInWithRedirect navigates the current page to Google and back, eliminating the popup mechanism entirely. No popup = no cross-origin window.close() = no COOP warning."
  blind_spots: "getRedirectResult() must be called on page load to capture the auth credential — new-user / tenant routing logic depends on it. Verified: useEffect on mount handles this correctly."

## Symptoms

expected: Popup do Google abre, usuário loga, autenticação completa com sucesso
actual: Popup abre e fica carregando por bastante tempo, depois fecha automaticamente e retorna erro
errors: useLoginForm.ts:465 Google auth failed: FirebaseError: Firebase: Error (auth/popup-closed-by-user)
reproduction: Clicar no botão "Entrar com Google" no formulário de login
started: Desconhecido — pode ser configuração ou código quebrado

## Eliminated

- hypothesis: Firebase emulators ativos bloqueando Google OAuth
  evidence: A configuração NEXT_PUBLIC_USE_FIREBASE_EMULATORS é gerenciada via .env.local (não visível). O erro e o comportamento (popup carrega por muito tempo) não são consistentes com emulador — emulador falha imediatamente com erro diferente. O .env.test usa emuladores mas é só para E2E.
  timestamp: 2026-04-16T01:00:00Z

- hypothesis: visibilitychange handler fechando sessão durante popup
  evidence: O handler em auth-provider.tsx linha 347 só executa quando visibilityState === "visible" (usuário RETORNA à aba), não quando sai. Não pode fechar o popup.
  timestamp: 2026-04-16T01:00:00Z

- hypothesis: Domínio não autorizado no Firebase Console
  evidence: O sintoma de "carrega por muito tempo" indica que o OAuth flow DO carrega (domínio autorizado). Se o domínio não fosse autorizado, o popup falharia imediatamente com auth/unauthorized-domain. O comportamento de timeout longo aponta para falha de comunicação, não de autorização.
  timestamp: 2026-04-16T01:00:00Z

- hypothesis: Manter signInWithPopup e ajustar COOP elimina o warning
  evidence: Mesmo com same-origin-allow-popups, o browser emite COOP warning quando um popup cross-origin (accounts.google.com) tenta chamar window.close(). Isso é inerente ao mecanismo de popup — não pode ser eliminado sem usar unsafe-none (que enfraquece segurança) ou eliminar o popup.
  timestamp: 2026-04-16T02:00:00Z

## Evidence

- timestamp: 2026-04-16T00:10:00Z
  checked: useLoginForm.ts handleGoogleAuth (linha 444-476)
  found: Usa signInWithPopup com GoogleAuthProvider. O catch em linha 464-474 captura auth/popup-closed-by-user e faz return silencioso (não mostra erro ao usuário). Não há nenhum código que feche o popup programaticamente dentro do hook.
  implication: A causa não está no handleGoogleAuth em si — o popup está sendo fechado externamente ao código do hook.

- timestamp: 2026-04-16T00:15:00Z
  checked: auth-provider.tsx onAuthStateChanged e visibilitychange handler
  found: O handler de visibilitychange (linha 346-362) só executa quando visibilityState volta a "visible". Não há nenhum signOut ou clearServerSession chamado durante o fluxo do popup. onIdTokenChanged também não fecha popup.
  implication: auth-provider.tsx não é responsável pelo fechamento do popup.

- timestamp: 2026-04-16T00:20:00Z
  checked: next.config.ts — security headers
  found: Linha 38-40: Cross-Origin-Opener-Policy estava definido como "same-origin". Este header isola a janela principal de qualquer janela cross-origin que ela abra. Firebase signInWithPopup abre um popup OAuth em accounts.google.com (cross-origin) e depende de window.opener.postMessage para receber o token de volta. Com COOP=same-origin, essa comunicação é completamente bloqueada.
  implication: ROOT CAUSE (Bug 1) — o popup carrega o OAuth normalmente mas não consegue se comunicar de volta com a janela principal. Firebase detecta o timeout e fecha o popup programaticamente, lançando auth/popup-closed-by-user.

- timestamp: 2026-04-16T00:25:00Z
  checked: Firebase SDK GitHub issues #8541 e #8295
  found: Múltiplos reports confirmam que COOP=same-origin quebra signInWithPopup. O fix documentado e recomendado pelo Firebase é usar same-origin-allow-popups.
  implication: Fix Bug 1 confirmado — alterado para same-origin-allow-popups em next.config.ts.

- timestamp: 2026-04-16T01:30:00Z
  checked: Checkpoint response from user after Bug 1 fix
  found: Login com Google funciona. Porém ainda aparece warning no console: "cb=gapi.loaded_0?le=scs:202 Cross-Origin-Opener-Policy policy would block the window.close call."
  implication: Bug 1 resolvido. Bug 2: warning residual do gapi tentando fechar o popup.

- timestamp: 2026-04-16T02:00:00Z
  checked: Source of COOP window.close warning
  found: O script gapi.loaded_0 roda DENTRO do popup em accounts.google.com. Após a auth, ele chama window.close() para se fechar. O browser detecta que o opener tem COOP=same-origin-allow-popups e loga o enforcement warning — mesmo que o close funcione. Esse comportamento é inerente a qualquer COOP stricter than unsafe-none quando um popup cross-origin tenta se fechar.
  implication: A única solução limpa é eliminar o popup — usar signInWithRedirect em vez de signInWithPopup.

- timestamp: 2026-04-16T02:05:00Z
  checked: auth-provider.tsx for getRedirectResult handling
  found: auth-provider.tsx NÃO tem getRedirectResult(). O onAuthStateChanged já captura o estado de auth após o redirect retornar (Firebase SDK persiste o auth state). Porém a lógica de new-user / tenant routing em handleGoogleAuth depende de getAdditionalUserInfo(userCredential) — isso só está disponível via getRedirectResult(), não via onAuthStateChanged.
  implication: getRedirectResult() deve ser chamado na montagem da página de login via useEffect, para capturar o credential do redirect e executar o routing de novo usuário.

- timestamp: 2026-04-16T02:10:00Z
  checked: E2E tests for Google auth
  found: E2E tests não testam Google OAuth — usam email/password. Emuladores só são ativados via __E2E_USE_FIREBASE_EMULATORS (Playwright) ou NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true. signInWithRedirect funciona normalmente com Firebase real (não emulador).
  implication: A troca de signInWithPopup para signInWithRedirect não afeta E2E tests.

## Resolution

root_cause: |
  Bug 1: COOP=same-origin em next.config.ts bloqueava a comunicação window.opener entre a página principal e o popup OAuth do Google, causando auth/popup-closed-by-user.
  Bug 2: Mesmo após corrigir para same-origin-allow-popups, o script gapi dentro do popup (accounts.google.com) chama window.close() após auth, e o browser loga um COOP enforcement warning. Isso é inerente ao mecanismo de signInWithPopup com qualquer COOP stricter than unsafe-none.
fix: |
  Bug 1: Alterado COOP de "same-origin" para "same-origin-allow-popups" em next.config.ts.
  Bug 2: Substituído signInWithPopup por signInWithRedirect em useLoginForm.ts. Adicionado useEffect que chama getRedirectResult() na montagem da página de login para capturar o credential do redirect e executar o routing de novo usuário (getGoogleSetupTarget). Sem popup, sem window.close(), sem COOP warning.
verification: Aguardando confirmação humana (Bug 2)
files_changed:
  - next.config.ts
  - src/app/login/_hooks/useLoginForm.ts
