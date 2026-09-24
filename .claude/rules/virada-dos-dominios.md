# A virada dos domínios (fase 9)

O dia em que `proops.com.br` deixa de servir o ERP e passa a servir a página da
empresa. **Feita em 2026-09-21** (`APEX_SURFACE` = `"institucional"`). O que
segue fica como registro e como roteiro do rollback.

## Dois defeitos que só a virada revelou

Os dois estavam no código desde a fase aditiva e eram invisíveis enquanto o
apex servia o ERP, porque ali "a superfície do apex" e "o ERP" eram a mesma
coisa. Ficam registrados porque o mesmo raciocínio vale para qualquer
superfície nova.

1. **Todo host desconhecido recebia a superfície do apex.** Isso incluía
   `localhost` e todas as URLs de preview da Vercel. Com a constante virada,
   `localhost:3000/login` e o login de todo preview passariam a responder 301
   para `erp.proops.com.br`, a PRODUÇÃO, e o E2E inteiro do CI, que entra por
   `localhost`, iria junto. Hoje só `APEX_HOSTS` (`proops.com.br`,
   `www.proops.com.br` e o substituto local `proops.localhost`) recebem a
   superfície do apex; o resto serve o ERP. O destino da conta free
   (`erpHomeUrl`) também passou a depender da superfície do host, pelo mesmo
   motivo.
2. **A raiz reescrita entrava nos provedores de sessão.** `providers.tsx`
   decidia "sem sessão" só pelo caminho, e sob rewrite a raiz é `/`. Ir de
   `/sobre` para `/` trocava a árvore acima do layout da empresa, o React o
   montava de novo, e a cortina de transição ficava parada cobrindo a tela.
   Hoje `isSessionlessPage` (`lib/auth/route-access.ts`) olha o host quando o
   caminho é `/`. O mesmo defeito já afetava `app.proops.com.br/` antes da
   virada, numa navegação para a raiz.

**Para testar o apex localmente, use `proops.localhost:3000`**, e não
`localhost`: depois da virada `localhost` é o ERP. Os specs do site da empresa
(`institucional/`, `mobile/indice-empresa`) e o `superficies/host-routing` já
fazem isso.

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
| O `noindex` transitório das páginas da empresa some | `shouldNoIndexPath` | `/sobre`, `/manifesto`, `/produtos` e `/fale-conosco` entram no índice |
| Canonical, sitemap e robots trocam de origem | `host-seo.ts` | cada host publica o seu |

O usuário free também deixa de ser mandado para a raiz e passa a ir para a
landing do ERP (`erpHomeUrl`), senão ele cai na página da empresa: sem login,
sem planos e sem nada para clicar.

**Atualize junto** o E2E `superficies/host-routing.spec.ts`, que hoje afirma "o
apex ainda serve o ERP". Ele é o guard de que a fase foi aditiva, e tem que
mudar no mesmo commit que a torna falsa.

## As páginas da empresa

`/sobre`, `/manifesto`, `/produtos` e `/fale-conosco` já respondem
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
  `www.proops.com.br` (o apex responde 307 para o `www`, então é ali que o
  login acontece), e `erp.proops.com.br` não enxerga essa origem. A interstitial vai
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

- [ ] **Google Cloud Console → tela de consentimento OAuth → página inicial:**
      trocar para `https://erp.proops.com.br`, **nos dois projetos**. ⚠️ Salve
      só no dia (bloco C), junto com a política de privacidade e os termos no
      apex: cada salvamento da marca pode disparar uma nova verificação. Hoje
      ela fica em Google Auth Platform → Branding
      (`console.cloud.google.com/auth/branding?project=<id>`). Na virada
      o apex passa a mostrar a página da empresa, que não descreve o uso da
      Agenda nem do Drive, e a verificação do Google exige que a página inicial
      cadastrada descreva o aplicativo. A política de privacidade não muda:
      `/privacy` fica no apex (`APEX_LEGAL_PATHS`).
- [ ] **Vercel → Domains: tornar `proops.com.br` o domínio principal**, com
      `www.proops.com.br` redirecionando para ele em **308**. ⚠️ **NÃO faça isto
      antes do dia** (vai no bloco C): trocar a origem principal desloga todo
      mundo que usa o ERP em `www`, e a virada desloga de novo ao mandar o ERP
      para `erp`. Feito na mesma janela, a base entra de novo uma vez só. Hoje é o contrário
      (o apex responde **307** para o `www`), enquanto todo canonical, sitemap e
      dado estruturado do código usa `https://proops.com.br` (`APEX_URL`). Ou
      seja, o canonical aponta para um redirect TEMPORÁRIO, que é o sinal mais
      confuso que se pode dar ao Google justamente na semana em que ele precisa
      entender que a raiz mudou de conteúdo. Conferido com `curl -sI` em
      2026-09-21.

> **A Deployment Protection NÃO se desliga, em momento nenhum.** Uma versão
> anterior deste checklist mandava desligá-la depois da virada, e estava
> errada. A proteção deste projeto é a Standard: ela fecha os previews e as URLs
> `*.vercel.app`, e NÃO fecha domínio próprio de Production. A prova está no ar:
> `www.proops.com.br` responde 200 para qualquer um, enquanto `erp` e `app`
> (presos ao preview da branch) respondem 302 para o SSO da Vercel. Então `erp`
> e `app` ficam públicos sozinhos no instante em que forem movidos para
> Production, e desligar a proteção só serviria para expor todos os previews,
> de todas as branches, que falam com o backend de dev.

### B. Os subdomínios entram em Production (antes da virada, sem mudar nada)

Depende do código multi-superfície já estar em `main`. Com `APEX_SURFACE` ainda
em `"erp"`, isto não muda nada para quem usa: os clientes continuam em
`www.proops.com.br`, `erp` é uma cópia `noindex` do ERP e `app` é a landing do
aplicativo, também `noindex`.

- [x] **1. Vercel → Domains: mover `erp.proops.com.br` e `app.proops.com.br`**
      do preview da branch para **Production**. É este passo, e não desligar
      proteção nenhuma, que os torna públicos.
- [x] **2. Conferir de fora** (`curl -sI`): os dois respondem 200 com
      `X-Robots-Tag: noindex`.
- [x] **3. `CORS_ALLOWED_ORIGINS`** em `apps/functions/.env.erp-softcode-prod`:
      **acrescentar** `https://erp.proops.com.br`, sem tirar o `www`. Atualizar o
      secret `FUNCTIONS_ENV_PRODUCTION` e rodar `npm run deploy:prod`. É
      aditivo: o backend passa a aceitar os dois domínios enquanto só um está em
      uso.

### C. No dia, e nesta ordem

- [ ] **1. Trocar `APEX_SURFACE` para `"institucional"`** e atualizar o E2E
      `superficies/host-routing.spec.ts`, que hoje afirma que o apex ainda serve
      o ERP, no mesmo commit. O commit segue o caminho de qualquer outro: PR para
      `develop` e, de lá, para `main`.
- [ ] **2. Esperar o deploy de Production da Vercel terminar** e conferir que
      `www.proops.com.br/` mostra a página da empresa.
- [ ] **2b. Vercel → Domains:** primeiro `proops.com.br` → *Connect to an
      environment: Production*; depois `www.proops.com.br` → *Redirect to
      Another Domain* → `proops.com.br`, **308**. Nesta ordem, para os dois nunca
      redirecionarem um para o outro.
- [ ] **3. Só agora: `APP_URL` → `https://erp.proops.com.br`** em
      `apps/functions/.env.erp-softcode-prod`, atualizar o secret
      `FUNCTIONS_ENV_PRODUCTION` e rodar `npm run deploy:prod`. Sem o deploy a
      troca não alcança as funções publicadas: o Cloud Run preserva as
      variáveis que já estão lá.

> **Por que o `APP_URL` vem por último, e não junto com o CORS.** Uma versão
> anterior deste checklist publicava o `APP_URL` novo ANTES de o domínio servir
> Production, e chamava isso de inofensivo. Não é: tudo que o backend monta a
> partir do `APP_URL` passa a apontar para `erp.proops.com.br`, e enquanto ele
> for preview protegido o destino é a tela de login da Vercel. Isso inclui o
> retorno do Stripe depois do pagamento, o callback do Google ao conectar Agenda
> ou Drive e os links dos e-mails. A regra é uma só: **o `APP_URL` só aponta
> para um domínio que já serve Production.** Depois do bloco B isso já vale,
> mas trocá-lo antes da virada espalharia o re-login pela base aos poucos, em
> vez de concentrá-lo no dia avisado.

- [ ] **4. Google Auth Platform → Branding**, num salvamento só: página inicial
      `https://erp.proops.com.br`, política `https://proops.com.br/privacy`,
      termos `https://proops.com.br/terms`, nos dois projetos.

### D. Depois

- [ ] **Avisar a base do re-login.** Todo mundo é deslogado, e isso não é
      configuração, é consequência (ver acima).
- [ ] **Conferir os 301** na mão: `proops.com.br/login`, `/dashboard`,
      `/decoracao` e um `/share/<token>` real devem chegar ao subdomínio. Se o
      `www` ainda for o domínio principal, cada um faz dois saltos (307 para o
      `www`, depois 301 para o `erp`); com o item do apex no bloco A, um só.
- [ ] **Search Console:** propriedades novas para `erp.proops.com.br` e
      `app.proops.com.br`, cada uma com o próprio sitemap submetido. A ferramenta de "mudança de endereço" **não se aplica**:
      ela é para migração de domínio inteiro, e isto é uma divisão.

      Numa propriedade de DOMÍNIO (`proops.com.br`, verificada por DNS) os três
      sitemaps podem ser enviados na mesma propriedade. Depois, "Inspeção de
      URL → Solicitar indexação" nas raízes dos três hosts, nas páginas de nicho
      do ERP e nas quatro da empresa.

      > Três dias depois da virada o relatório mostrava as páginas públicas do ERP
      > como "alternativa com canônica adequada": elas declaravam canonical
      > relativo, resolvido no apex, que devolve 301 para o ERP. Corrigido em
      > 2026-09-24 (ver `apps/web/src/lib/CLAUDE.md`, seção Site). O resto do
      > relatório era esperado: `http`/`www` redirecionando, `/login` bloqueado
      > pelo robots e páginas novas na fila de rastreamento.

## Rollback

Reverter o commit que trocou a constante. Domínios e DNS podem ficar no ar sem
prejuízo, e os subdomínios voltam a ser duplicatas `noindex`. O que **não**
volta atrás é o 301 já cacheado por um navegador que o recebeu, e a sessão de
quem já foi deslogado.
