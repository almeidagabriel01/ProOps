# A virada dos domínios (fase 9)

O dia em que `proops.com.br` deixa de servir o ERP e passa a servir a página da
empresa. Todo o código já está escrito e testado; o que falta é **uma linha e um
checklist de consoles**.

Enquanto `APEX_SURFACE` for `"erp"`, nada aqui está ativo.

---

## O que a virada muda, em uma linha

`apps/web/src/lib/site/surfaces.ts`:

```ts
export const APEX_SURFACE: Surface = "erp";  // → "institucional"
```

Isso, sozinho, liga quatro comportamentos que já existem e estão testados dos
dois lados:

| O quê | Onde | Efeito |
|---|---|---|
| A raiz do apex passa a renderizar a institucional | `resolveRewritePath` | rewrite de `/` |
| Todo caminho do ERP no apex passa a fazer 301 | `resolveApexRedirect` | `proops.com.br/login` → `erp.proops.com.br/login` |
| O `noindex` transitório dos subdomínios some | `shouldNoIndexHost` | os três hosts passam a ser indexáveis |
| Canonical, sitemap e robots trocam de origem | `host-seo.ts` | cada host publica o seu |

O usuário free também deixa de ser mandado para a raiz e passa a ir para a
landing do ERP (`erpHomeUrl`), senão ele cai na página da empresa: sem login,
sem planos e sem nada para clicar.

**Atualize junto** o E2E `superficies/host-routing.spec.ts`, que hoje afirma "o
apex ainda serve o ERP". Ele é o guard de que a fase foi aditiva, e tem que
mudar no mesmo commit que a torna falsa.

---

## O que NÃO tem conserto, e por isso é uma decisão e não um detalhe

`proops.com.br/` **continua respondendo 200**, com outro conteúdo. Não existe
301 possível para a raiz: um redirect ali levaria a institucional inteira para o
ERP. Consequência: a autoridade e o ranking que a home acumulou não têm sinal
nenhum dizendo ao Google que a landing do ERP se mudou. `erp.proops.com.br`
começa do zero.

As páginas de nicho (`/automacao-residencial`, `/decoracao`) são o único
conteúdo com sinal limpo, porque a URL delas muda de verdade e leva 301.

Janela realista de perda de tráfego orgânico: **4 a 12 semanas**.

Mitigação, se o tráfego orgânico for crítico: manter o conteúdo comercial
(preços, FAQ, páginas de nicho) no apex, dentro da institucional, em vez de
mandá-lo junto para o subdomínio.

---

## Todo mundo que está logado é deslogado

O cookie `__session` é criado sem `domain`
(`app/api/auth/session/route.ts`), ou seja, é cookie de host. Isso tem dois
lados:

- **Bom:** não é preciso compartilhar sessão entre subdomínios. A institucional
  e a página do app nunca recebem o cookie.
- **A conta:** na virada, **toda a base é deslogada, e `/auth/refresh` não
  salva ninguém.** O refresh token do Firebase mora no IndexedDB da origem
  `proops.com.br`, que `erp.proops.com.br` não enxerga. A interstitial vai
  esgotar as tentativas e cair em `/login`.

É o comportamento correto do ponto de vista de isolamento de origem, e não tem
como evitar. **Avise antes.**

---

## Checklist, na ordem de execução

A ordem importa mais que a lista. **Quase tudo aqui é aditivo e pode ser feito
dias antes, sem mudar nada para ninguém**: acrescentar um domínio autorizado ou
uma URL de retorno não remove a antiga. Fazer isso antes encurta a janela em que
algo pode estar errado, porque no dia sobram só três coisas.

### A. Dias antes (aditivo, não muda nada)

- [ ] **Firebase Auth → domínios autorizados:** acrescentar `erp.proops.com.br`.
      **Mantenha `proops.com.br` na lista.** Sem o novo, o login inteiro morre
      com `auth/unauthorized-domain` no minuto da virada.
- [ ] **Stripe → URLs de retorno** do checkout e do portal: acrescentar as do
      subdomínio. O Stripe aceita várias; as antigas continuam válidas.
- [ ] **Google OAuth → redirect URIs** (Agenda e Drive): acrescentar as novas,
      sem remover as atuais. Erra com `redirect_uri_mismatch`, e **só aparece na
      hora de alguém conectar**, que pode ser semanas depois.
- [ ] **`NEXT_PUBLIC_*` na Vercel**, em **Preview e Production separadamente**.
      Elas são embutidas no BUILD: cadastrar não afeta o que já está publicado,
      precisa de redeploy.
- [ ] **Desligar a Deployment Protection** dos subdomínios na Vercel. Enquanto
      estiver ligada eles respondem 302 para o SSO e nenhum crawler entra, o que
      hoje é proposital; desligar antes permite navegar os dois hosts de verdade
      e conferir tudo com calma. Eles continuam `noindex` até a virada, então
      não há risco de indexação precoce.

### B. No dia, e nesta ordem

- [ ] **1. `CORS_ALLOWED_ORIGINS`** em `apps/functions/.env.erp-softcode-prod`,
      acrescentando o subdomínio, **e `APP_URL` → `https://erp.proops.com.br`**.
- [ ] **2. Atualizar o secret `FUNCTIONS_ENV_PRODUCTION` no GitHub**, senão a
      próxima função nova nasce sem as variáveis (ver `ci-cd.md`).
- [ ] **3. `npm run deploy:prod`.** Sem ele nada dos dois itens acima alcança as
      funções publicadas: o Cloud Run preserva as variáveis que já estão lá.
      **Este passo vem ANTES do flip**, e é o único que toca produção sozinho.
      Feito nesta ordem, ele é inofensivo: o backend passa a aceitar os dois
      domínios enquanto só um está em uso.
- [ ] **4. Trocar `APEX_SURFACE` para `"institucional"`** e atualizar o E2E
      `superficies/host-routing.spec.ts`, que hoje afirma que o apex ainda serve
      o ERP, no mesmo commit.
- [ ] **5. Merge e redeploy da Vercel.**

### C. Depois

- [ ] **Avisar a base do re-login.** Todo mundo é deslogado, e isso não é
      configuração, é consequência (ver acima).
- [ ] **Conferir os 301** na mão: `proops.com.br/login`, `/dashboard`,
      `/decoracao` e um `/share/<token>` real devem chegar ao subdomínio.
- [ ] **Search Console:** propriedade nova para `erp.proops.com.br`, com o
      sitemap submetido. A ferramenta de "mudança de endereço" **não se aplica**:
      ela é para migração de domínio inteiro, e isto é uma divisão.

## Rollback

Reverter o commit que trocou a constante. Domínios e DNS podem ficar no ar sem
prejuízo, e os subdomínios voltam a ser duplicatas `noindex`. O que **não**
volta atrás é o 301 já cacheado por um navegador que o recebeu, e a sessão de
quem já foi deslogado.
