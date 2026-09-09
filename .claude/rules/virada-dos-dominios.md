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

## Checklist de consoles

Nenhum item aqui é código, e cada um falha de um jeito diferente.

- [ ] **Firebase Auth → domínios autorizados.** Adicionar `erp.proops.com.br`.
      Sem isso o login inteiro morre com `auth/unauthorized-domain`.
- [ ] **`CORS_ALLOWED_ORIGINS`** em `apps/functions/.env.erp-softcode-prod`, com
      o subdomínio novo. **Exige `npm run deploy:prod`**: mudar o arquivo não
      alcança as funções já publicadas. É o único item do checklist que toca
      produção de verdade antes da virada, então deixe-o para o dia.
- [ ] **Atualizar o secret `FUNCTIONS_ENV_PRODUCTION` no GitHub** junto, senão a
      próxima função nova nasce sem a variável (ver `ci-cd.md`).
- [ ] **Stripe → URLs de retorno** do checkout e do portal.
- [ ] **Google OAuth → redirect URIs**, Agenda e Drive. Erra com
      `redirect_uri_mismatch`, que só aparece na hora de conectar.
- [ ] **`NEXT_PUBLIC_*` na Vercel**, em Preview e Production separadamente.
      Elas são embutidas no BUILD: cadastrar não afeta o que já está publicado,
      precisa de redeploy.
- [ ] **Links dos e-mails transacionais** (`APP_URL` no backend). Repare que
      `app.proops.com.br` já era o default de `APP_URL` em dois pontos, e esse
      host agora é a landing do aplicativo: um e-mail de mudança de preço
      levaria o cliente para uma página de marketing.
- [ ] **Search Console:** propriedade nova para `erp.proops.com.br`, sitemap
      submetido, e a mudança de endereço NÃO se aplica (não é migração de
      domínio inteiro, é uma divisão).
- [ ] **Desligar a Deployment Protection** dos domínios na Vercel, se ainda
      estiver ligada. Enquanto estiver, os subdomínios respondem 302 para o SSO
      e nenhum crawler entra.

---

## Rollback

Reverter o commit que trocou a constante. Domínios e DNS podem ficar no ar sem
prejuízo, e os subdomínios voltam a ser duplicatas `noindex`. O que **não**
volta atrás é o 301 já cacheado por um navegador que o recebeu, e a sessão de
quem já foi deslogado.
