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
| O `noindex` transitório das páginas da empresa some | `shouldNoIndexPath` | `/sobre`, `/manifesto`, `/produtos`, `/carreiras` e `/fale-conosco` entram no índice |
| Canonical, sitemap e robots trocam de origem | `host-seo.ts` | cada host publica o seu |

O usuário free também deixa de ser mandado para a raiz e passa a ir para a
landing do ERP (`erpHomeUrl`), senão ele cai na página da empresa: sem login,
sem planos e sem nada para clicar.

**Atualize junto** o E2E `superficies/host-routing.spec.ts`, que hoje afirma "o
apex ainda serve o ERP". Ele é o guard de que a fase foi aditiva, e tem que
mudar no mesmo commit que a torna falsa.

## As cinco páginas da empresa

`/sobre`, `/manifesto`, `/produtos`, `/carreiras` e `/fale-conosco` já respondem
200 no apex e estão em `APEX_COMPANY_PATHS`, ou seja: elas **não** levam 301 para
o ERP na virada, e entram no sitemap e no índice no mesmo instante. Hoje elas
são navegáveis e `noindex`, de propósito, porque uma `/sobre` indexada antes da
virada é página achada antes do site a que ela pertence.

Nada a fazer no dia. O que exige atenção é o inverso: **ao criar uma página nova
do site da empresa, ela precisa entrar em `APEX_COMPANY_PATHS`**, senão ela morre
na virada, com 301 para um subdomínio que não a serve. O guard é o `throw` no
import de `components/institucional/nav-links.ts`, que compara a lista do menu
com a do redirect.

De passagem, esta fase também corrigiu um defeito latente: `apexRedirectPara`
mandaria `/institucional` para `erp.proops.com.br/institucional` depois da
virada, matando o próprio alvo do rewrite da raiz. Inerte até hoje só porque a
função devolve `null` enquanto o apex serve o ERP.

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

> **Tudo neste bloco é por AMBIENTE, e são dois.** `erp-softcode` (dev) e
> `erp-softcode-prod` (produção) são projetos Firebase distintos **e clientes
> OAuth do Google distintos**. Configurar um não configura o outro, e a falha só
> aparece no ambiente que ficou de fora. Faça os dois, e anote qual já foi.

- [x] **Firebase Auth → Authentication → Settings → Domínios autorizados:**
      acrescentar `erp.proops.com.br`, **nos dois projetos**. Sem ele, o login
      morre com `auth/unauthorized-domain` no minuto da virada.

      `www.proops.com.br` já está e deve continuar: o apex responde 307 para o
      `www`, então é ali que o login acontece hoje. **`app.proops.com.br` NÃO
      entra**: aquela página não tem login.
- [x] **Google Cloud Console → APIs e Serviços → Credenciais → o cliente OAuth
      da Agenda/Drive → "URIs de redirecionamento autorizados".** Acrescentar
      **estas duas, exatamente assim**, sem remover as que já estão lá:

      ```
      https://erp.proops.com.br/api/backend/v1/calendar/google/callback
      https://erp.proops.com.br/api/backend/v1/drive/google/callback
      ```

      Um cliente OAuth atende Agenda e Drive, mas **dev e produção usam clientes
      DIFERENTES**: faça nos dois. O caminho é `/api/backend/…` porque o callback
      entra pelo proxy do Next, não direto na function.

      **Acrescente, não substitua.** Nenhum dos dois ambientes define
      `GOOGLE_CALENDAR_REDIRECT_URI` nem `GOOGLE_DRIVE_REDIRECT_URI`, então os
      dois derivam a URI do `APP_URL` daquele ambiente — e essa URI precisa
      CONTINUAR na lista até o `APP_URL` mudar. Em dev o `APP_URL` é a URL de
      preview da Vercel, não localhost, então a linha da Vercel tem que ficar.
      Removê-la quebra Agenda e Drive imediatamente, com `redirect_uri_mismatch`
      que só aparece quando alguém tenta conectar.

      **Por que o cliente de dev só tem `localhost`:** rodando no emulador,
      `resolveFrontendAppOrigin` ignora o `APP_URL` e devolve `localhost:3000`,
      então é essa a URI que o fluxo local usa. O efeito colateral é que
      conectar Agenda ou Drive contra o backend de dev PUBLICADO não funciona,
      porque ali vale o `APP_URL` (a URL de preview da Vercel), que não está
      registrada. Isso é anterior a esta migração. Para ensaiar a virada em dev
      com as integrações Google ligadas, registre a URL de preview ou defina
      `GOOGLE_CALENDAR_REDIRECT_URI` / `GOOGLE_DRIVE_REDIRECT_URI`.

      As URIs são derivadas de **`APP_URL`**, nunca do cabeçalho da request (o
      host pode ser forjado para influenciar o `redirect_uri`, e isso foi tratado
      como risco). Ou seja: elas mudam **no instante em que `APP_URL` mudar**, e
      não quando o domínio começa a responder. Erra com
      `redirect_uri_mismatch`, e **só aparece quando alguém tenta conectar**, que
      pode ser semanas depois.

- [x] **Stripe: não há nada a fazer no painel.** Este item estava errado no
      checklist original. As URLs de retorno do checkout e do portal
      (`success_url`, `cancel_url`, `return_url`) são enviadas **em cada chamada
      da API**, montadas a partir da origem da requisição por
      `resolveRequestOrigin` — não existe cadastro no dashboard.

      **O que governa isso é o `CORS_ALLOWED_ORIGINS`**: aquela função só aceita
      a origem da request se ela estiver na allowlist, e cai para `APP_URL` caso
      contrário. Com o subdomínio fora da lista, um checkout iniciado em
      `erp.proops.com.br` devolveria o cliente para o apex depois de pagar. É o
      mesmo item do bloco B, e não um passo separado.

- [x] **`NEXT_PUBLIC_*`: provavelmente nada a fazer.** `NEXT_PUBLIC_*` não é o
      nome de uma variável, é o prefixo do conjunto delas (Firebase, GA,
      Turnstile, WhatsApp…). Das 15 que o projeto usa, **só uma depende de
      domínio: `NEXT_PUBLIC_SITE_URL`**, e ela alimenta apenas o `metadataBase`,
      que resolve caminhos relativos de imagem. `/opengraph-image.png` existe em
      qualquer host, então ela pode continuar apontando para o apex.

      Nenhuma delas é secreta: tudo com esse prefixo é **embutido no JavaScript
      que vai para o navegador**, e por isso nunca deve receber valor sensível.
      Na Vercel entram como Environment Variable comum, não como Secret.

      O que dependia de host e era real já foi resolvido em código: canonical,
      sitemap, robots e o dado estruturado derivam do host servido, não de
      variável de build.
> **NÃO desligue a Deployment Protection neste bloco.** Ela estava aqui e é o
> lugar errado: enquanto os domínios apontam para o Preview da branch, desligar
> publica na internet aberta um ERP com código não revisado que fala com o
> BACKEND DE PRODUÇÃO (`erp.proops.com.br` está em `PRODUCTION_HOSTS`) enquanto
> autentica no Firebase de dev (as `NEXT_PUBLIC_*` de Preview apontam para lá).
> Não é uma porta para os dados, porque o token de dev não é aceito pelo backend
> de prod, mas é uma superfície pública se comportando de forma imprevisível, com
> tráfego de estranhos batendo em produção. E na Vercel isso é configuração do
> PROJETO: desligar expõe todos os previews, de todas as branches.
>
> Para revisar os dois hosts não é preciso desligar nada: logado na conta
> Vercel, o SSO deixa passar. É por isso que você abre e um estranho leva 302.

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
- [ ] **5. Merge e redeploy da Vercel**, com os domínios já apontando para
      Production e não mais para o Preview da branch.
- [ ] **6. Só então, desligar a Deployment Protection.** A partir daqui os três
      hosts servem código revisado, de produção, contra o backend certo — que é
      a condição que faltava para expô-los. Antes disso não há motivo: logado na
      conta, você já navega os dois.

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
