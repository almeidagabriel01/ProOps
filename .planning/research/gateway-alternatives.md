# Alternativas de Gateway — "Vincular o banco do tenant"

> Documento de pesquisa — sem implementação. Objetivo: subsidiar decisão sobre evolução da camada de pagamentos do ProOps, especificamente para o requisito de que o **dinheiro caia direto na conta bancária do tenant** sem ele precisar criar conta num gateway de terceiro (Stripe, Asaas, etc.).

---

## 1. Verdade dura sobre cartão de crédito

**Não existe "vincular banco direto" para receber cartão do cliente final.**

Cartão de crédito sempre exige uma cadeia licenciada: emissor → bandeira (Visa/Master/Elo) → adquirente/subadquirente → conta de destino. O adquirente precisa ser certificado pelo BACEN e pela bandeira. Não há API bancária que permita receber crédito de cartão diretamente.

A única forma do tenant "usar o banco dele" para cartão é se o banco tem braço adquirente. Os bancos brasileiros com adquirência própria ou parceria direta:

| Banco | Adquirente | Observação |
|---|---|---|
| Itaú | Rede | Parceria integral — conta no Itaú recebe via Rede |
| Banco do Brasil + Bradesco | Cielo | Participação acionária — conta BB/Bradesco recebe via Cielo |
| Santander | GetNet | Adquirente próprio do Santander |
| Independente | Stone | Conta Stone = fintech, não banco incumbente |
| UOL / Pagseguro | PagSeguro | Conta PagSeguro separada da conta bancária do tenant |
| Nubank | — | **Sem adquirência própria** — Nubank PJ não tem API de recebimento de cartão |

**Conclusão para cartão:** o tenant sempre precisará criar conta num gateway/adquirente. A melhor experiência é um gateway com onboarding rápido e split nativo (MP, Asaas, Pagar.me).

---

## 2. PIX direto banco-a-banco — é viável

PIX é diferente: o padrão BCB usa mTLS + OAuth2 igual em todos os bancos. O tenant pode vincular sua própria conta bancária e receber PIX diretamente, sem intermediário de gateway, sem taxa adicional além da tarifa bancária do próprio banco.

### Modelo do connector

```
Cliente final → ProOps gera QR Code / copia-cola via API do banco do tenant
→ Cliente paga via app de qualquer banco (SPB roteia)
→ Dinheiro cai direto na conta bancária do tenant
→ ProOps escuta webhook do banco do tenant → marca lançamento como pago
```

ProOps nunca toca no dinheiro. Sem split, sem float, sem KYC adicional do tenant.

### APIs PIX por banco (estado maio/2026)

**Tier 1 — API pública madura, DX boa, sandbox disponível**

| Banco | API | Observação |
|---|---|---|
| Banco Inter PJ | Inter Developers (developers.inter.co) | OAuth2, webhooks, sandbox, documentação completa em PT |
| BTG Empresas | BTG Pactual Business (developers.btgpactual.com) | mTLS, webhook, boa DX, foco em empresas |
| Sicoob | Sisbr API (developers.sicoob.com.br) | PIX Cobrar + webhooks; cooperativa — tenant precisa ser associado |
| Sicredi | Sicredi Developers | Similar ao Sicoob; cooperativa |
| Banco Original | Original Developers | PIX Cobrar, mTLS, pouco adotado mas funcional |

**Tier 2 — API enterprise, onboarding mais lento**

| Banco | API | Observação |
|---|---|---|
| Banco do Brasil | BB Developers / DTM | API PIX existe, onboarding via contrato |
| Santander | Santander Developers | PIX Cobrar via API; requer credenciamento comercial |
| Bradesco | Bradesco Developers | PIX Cobrar; documentação menos madura |
| Itaú | Itaú Developers | PIX Cobrar; mTLS, sandbox disponível |

**Sem API pública adequada hoje (maio/2026)**

| Banco | Status |
|---|---|
| Nubank PJ | **Sem API PIX de recebimento**. Nubank não tem endpoint para gerar cobrança PIX programaticamente |
| C6 Bank PJ | API parcial; sem webhook de confirmação de pagamento |
| Inter PF | API disponível mas voltada para PF, não PJ |
| Caixa Econômica | API existe mas onboarding é presencial |

---

## 3. Modelo híbrido recomendado

```
PIX     → connector direto-banco (tenant vincula o banco dele)
Cartão  → MP ou Asaas (sem alternativa de "banco direto")
Boleto  → MP ou Asaas (emissão exige convênio bancário)
```

### Para PIX: connector multi-banco

O tenant, durante o onboarding de pagamentos no ProOps, escolhe seu banco e faz OAuth2 com as credenciais daquele banco. O ProOps armazena os tokens de forma segura (análogo ao que já faz com `mercadoPago.accessToken`).

Para emitir cobrança: ProOps chama a API do banco do tenant (POST /pix/cob), retorna QR Code + copia-cola para o cliente.

Para confirmar: ProOps registra webhook na API do banco do tenant. Quando o banco notifica pagamento, ProOps marca o lançamento como pago.

**Bancos prioritários para implementar (tier 1):** Inter PJ, BTG, Sicoob, Sicredi — APIs maduras, sandbox disponível, documentação clara.

---

## 4. Comparativo de opções

| Critério | MP atual | Asaas subconta | Pagar.me Recebedores | PIX-direct-bank (hybrid) |
|---|---|---|---|---|
| **Split automático** | Sim (marketplace OAuth) | Sim (white-label) | Sim (recebedores) | N/A — dinheiro vai direto |
| **KYC do tenant** | MP faz (OAuth) | Asaas faz (link hosted) | Pagar.me faz | Banco do tenant já fez |
| **Tenant cria conta** | Sim (conta MP) | Sim (conta Asaas) | Sim (conta Pagar.me) | **Não** — usa banco existente |
| **Taxa cartão** | ~3.99% + R$0,40 | ~2.99%+ variável | ~2.79%+ variável | N/A — sem cartão |
| **Taxa PIX** | Gratuito (Checkout) | Gratuito | Gratuito | Tarifa bancária (~R$0,00–0,10) |
| **Branding** | Redirect p/ MP | White-label próprio | Redirect p/ Pagar.me | Invisible (QR Code nativo) |
| **DX em sandbox** | Instável (issues ativos) | Boa | Boa | Por banco — Inter/BTG bons |
| **Esforço de migração** | — (base atual) | Médio (nova integração) | Médio | Alto (multi-banco, 1 API por banco) |
| **Nubank suportado** | Não (para PIX direto) | Não | Não | **Não** — sem API pública |
| **BB suportado** | Não (para PIX direto) | Não | Não | Sim (Tier 2, onboarding) |

---

## 5. Análise de alternativas de gateway (se trocar o MP)

### Asaas subconta (candidato mais forte se mudar de gateway)

- Subcontas white-label por tenant, onboarding por link hosted (sem branding do Asaas por padrão)
- Split nativo para subcontas
- PIX + cartão + boleto nativos
- DX em português, sandbox estável
- **Ponto negativo:** tenant ainda precisa criar conta Asaas (KYC); não é "vincular banco existente"
- **Quando considerar:** se o sandbox instável do MP continuar causando problemas em produção ou se o modelo marketplace do MP for muito complexo para o onboarding do tenant

### Pagar.me Recebedores

- Modelo de recebedores (split via API)
- KYC feito pelo Pagar.me na criação do recebedor
- **Ponto negativo:** sem OAuth marketplace — você (ProOps) assume mais responsabilidade de onboarding e compliance. Pagar.me pode exigir due diligence adicional do ProOps como plataforma
- **Quando considerar:** se o volume de tenants for grande e o modelo de split for a principal feature

### Stripe Connect (não recomendado agora)

- PIX no Brasil via EBANX/Stripe Payments BR ainda imaturo (tx mais alta, sem Pix instantâneo real)
- Onboarding em inglês — fricção para tenant BR
- Considerar apenas se ProOps expandir para fora do Brasil

---

## 6. Recomendação acionável

**Curto prazo (agora):** Manter MP. O problema de sandbox era de configuração (env var `MERCADOPAGO_SANDBOX_BUYER_EMAIL` ausente), não de instabilidade de produção. Produção funciona. Corrigir env vars e testar.

**Médio prazo (próximo trimestre):** Adicionar connector PIX-direct-bank para Inter PJ como primeira opção. Permite que tenants com conta no Inter recebam PIX diretamente sem criar conta MP. Após Inter: BTG, Sicoob, Sicredi. Cartão permanece em MP.

**Médio-longo prazo:** Se a demanda de tenants que "não querem criar conta MP" crescer, avaliar Asaas como gateway alternativo para cartão + boleto em paralelo ao connector PIX-direct-bank.

**Não trocaria por agora:** Pagar.me (aumenta responsabilidade de compliance do ProOps), PagBank (onboarding lento), Iugu (foco em assinatura, não marketplace), Efi/Gerencianet (split só Efi-Efi).

---

## 7. Próximos passos se optar pelo connector PIX-direct-bank

1. **Spike Banco Inter** (2–3 dias): PoC com sandbox Inter PJ — `POST /pix/cob` + webhook de confirmação. Validar fluxo end-to-end no ProOps.
2. **Design da coleta de credenciais**: tela de onboarding onde tenant faz OAuth2 com o banco dele (análoga à tela de conectar MP).
3. **Modelo de armazenamento**: `tenants/{id}.pixConnectors[].bankCode` + tokens OAuth2 (mesmo padrão de `mercadoPago`).
4. **Abstração de connector**: interface `PixConnector` com métodos `createCharge`, `cancelCharge`, `validateWebhook` — permite adicionar bancos sem mudar o controller.
