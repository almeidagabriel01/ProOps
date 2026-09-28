# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Dono ou gestor de empresa pequena ou média que vende **projeto sob medida**:
visita ou medição, orçamento, instalação e recebimento parcelado. Hoje ele se
apoia em planilha, WhatsApp e sistemas soltos. Os segmentos com pacote pronto
são automação residencial, persianas e toldos, segurança eletrônica, vidraçaria
e esquadrias, e marcenaria e móveis planejados (a lista viva é
`src/lib/niches/registry.ts`); qualquer outro segmento que venda projeto é
configurado na mesma base.

Dentro da conta trabalham também vendedores, técnicos de obra e o financeiro,
cada um com permissão por tela. Fora dela, o cliente final (que abre a
proposta, aceita, paga e acompanha a obra por link) e o contador (que abre um
link próprio, sem login).

## Product Purpose

A ProOps é o ERP de quem vende projeto: CRM, proposta, obra, agenda,
financeiro, notas fiscais e pós-venda na mesma base. Sucesso é a empresa
fechar mais propostas, entregar a obra sem perder etapa e receber sem
retrabalho, sem trocar de sistema no caminho.

## Positioning

Uma base só do orçamento ao recibo: a proposta nasce no vocabulário e no preço
do nicho (m², faixa de altura, metro linear, unidade), vira obra, parcela, nota
e pós-venda por link para o cliente e para o contador.

## Operating Context

- A venda começa numa visita técnica ou medição, marcada pelo link de
  agendamento ou pela equipe.
- A proposta é montada por ambiente ou área e por sistema ou solução, sai em
  PDF com a marca da empresa e segue por link (WhatsApp ou e-mail da própria
  empresa, com mensagem pronta).
- O cliente aceita pelo link com nome e CPF/CNPJ, ou pede alteração.
- Aprovada, a proposta gera lançamentos (entrada e parcelas), comissões, o
  projeto de instalação com as etapas do nicho e a entrega do PDF no Google
  Drive, e oferece a nota fiscal.
- O cliente paga por Pix ou boleto (Asaas) e acompanha tudo no portal.

## Capabilities and Constraints

- Inventário completo e requisito de plano de cada recurso: o catálogo em
  `src/lib/landing/funcionalidades/`, com o selo derivado de
  `src/lib/plans/default-plans.ts` (espelho de `PLAN_CATALOG` do backend).
- Planos Starter, Profissional e Enterprise, com add-ons (financeiro, CRM,
  notas fiscais, pagamento online, editor de PDF). Valor de plano nunca é
  digitado fora do catálogo.
- O cliente final paga só por Pix e boleto. O Stripe cobra apenas a assinatura
  da própria ProOps.
- O WhatsApp da ProOps é um menu fixo de consultas; a Lia vive dentro do ERP e
  executa ações com confirmação e respeitando a permissão de quem pede.
- A ProOps não desenha projeto 3D, não gera plano de corte, não controla a
  casa do cliente e não calcula cobertura de câmera: ela especifica, vende e
  administra o projeto.

## Brand Commitments

- "A ProOps", sempre no feminino.
- Sem travessão como pontuação em nenhum texto que vira tela.
- Português do Brasil, direto e concreto; o texto de venda só promete o que o
  produto faz (guard `src/lib/landing/__tests__/landing-claims.test.ts`).

## Evidence on Hand

- Não há depoimentos, logos de clientes nem números de uso para publicar. As
  páginas provam pelo produto: telas codadas fiéis, exemplos navegáveis
  (`/share/portal/exemplo`, `/share/contador/exemplo`) e selos de plano reais.
- Logo em `src/components/branding/proops-logo.tsx`.

## Product Principles

1. Mostrar o caminho inteiro, não a tela solta: o valor é a base única.
2. Falar a língua do nicho: vão, esquadria, módulo, área, ambiente, sistema.
3. Só prometer o que o código entrega, e dizer com clareza o que fica de fora.
4. O cliente final e o contador também usam a ProOps, pelo link.
