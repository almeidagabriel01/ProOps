/**
 * Mostra os lancamentos que uma proposta gerou, com os campos que decidem como
 * a tela os agrupa.
 *
 * Existe porque "o card nao mostra a parcela X" tem duas causas possiveis, e
 * elas exigem correcoes opostas: ou o documento foi gravado errado, ou a tela
 * agrupa errado um documento correto. Sem olhar os campos, a investigacao vira
 * comparacao de screenshot com codigo-fonte — que foi exatamente o que produziu
 * diagnosticos errados seguidos no modulo de comissoes.
 *
 * Somente leitura. Nao imprime valor de segredo nem dado de contato alem do
 * nome que ja aparece na propria tela.
 *
 * Uso:
 *   npx tsx src/scripts/inspect-proposal-transactions.ts --proposal=<id>
 *   GCLOUD_PROJECT=erp-softcode-prod npx tsx ... --proposal=<id>
 */

import { getFirestore } from "firebase-admin/firestore";
import { initScriptAdmin } from "./_script-init";

function arg(nome: string): string {
  const encontrado = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return encontrado ? encontrado.split("=").slice(1).join("=").trim() : "";
}

async function main(): Promise<void> {
  const projectId = initScriptAdmin();
  const db = getFirestore();
  console.log(`projeto: ${projectId}`);

  let proposalId = arg("proposal");
  const titulo = arg("title");

  // Buscar por titulo evita ter que garimpar o id numa URL ou no console.
  if (!proposalId && titulo) {
    const porTitulo = await db
      .collection("proposals")
      .where("title", "==", titulo)
      .limit(5)
      .get();
    if (porTitulo.empty) {
      console.error(`Nenhuma proposta com titulo "${titulo}".`);
      process.exit(1);
    }
    proposalId = porTitulo.docs[porTitulo.size - 1].id;
    if (porTitulo.size > 1) {
      console.log(
        `(${porTitulo.size} propostas com esse titulo; usando a ultima: ${proposalId})`,
      );
    }
  }

  if (!proposalId) {
    console.error("Informe --proposal=<id> ou --title=<titulo>.");
    process.exit(1);
  }

  const proposalSnap = await db.collection("proposals").doc(proposalId).get();
  if (!proposalSnap.exists) {
    console.error(`Proposta ${proposalId} nao encontrada.`);
    process.exit(1);
  }

  const proposal = proposalSnap.data() as Record<string, unknown>;
  const comissoes = (proposal.commissions as unknown[]) || [];

  console.log(`\nProposta ${proposalId}`);
  console.log(`  titulo           : ${proposal.title}`);
  console.log(`  status           : ${proposal.status}`);
  console.log(`  totalValue       : ${proposal.totalValue}`);
  console.log(`  closedValue      : ${proposal.closedValue}`);
  console.log(
    `  entrada          : ${proposal.downPaymentEnabled ? "sim" : "nao"} ` +
      `tipo=${proposal.downPaymentType} valor=${proposal.downPaymentValue} pct=${proposal.downPaymentPercentage}`,
  );
  console.log(
    `  parcelamento     : ${proposal.installmentsEnabled ? "sim" : "nao"} ` +
      `count=${proposal.installmentsCount}`,
  );
  console.log(`  commissions      : ${JSON.stringify(comissoes)}`);
  console.log(`  driveFileId      : ${proposal.driveFileId ?? "(nenhum)"}`);

  const snap = await db
    .collection("transactions")
    .where("proposalId", "==", proposalId)
    .limit(200)
    .get();

  console.log(`\nLancamentos (${snap.size}):`);
  const linhas = snap.docs
    .map((doc) => {
      const t = doc.data();
      return {
        id: doc.id,
        tipo: String(t.type),
        valor: Number(t.amount || 0),
        comissao: Boolean(t.isCommission),
        entrada: Boolean(t.isDownPayment),
        parcela: Boolean(t.isInstallment),
        n: t.installmentNumber ?? null,
        count: t.installmentCount ?? null,
        grupoParcelas: (t.installmentGroupId as string) ?? null,
        grupoProposta: (t.proposalGroupId as string) ?? null,
        src: (t.commissionSourceKey as string) ?? null,
        criadoEm: t.createdAt?.toDate?.()?.toISOString?.() ?? String(t.createdAt),
      };
    })
    .sort(
      (a, b) =>
        Number(a.comissao) - Number(b.comissao) ||
        Number(b.entrada) - Number(a.entrada) ||
        Number(a.n ?? 0) - Number(b.n ?? 0),
    );

  for (const l of linhas) {
    console.log(
      `  ${l.comissao ? "COMISSAO" : "receita "} ` +
        `${String(l.valor.toFixed(2)).padStart(10)} ` +
        `entrada=${l.entrada ? "S" : "n"} parcela=${l.parcela ? "S" : "n"} ` +
        `n=${String(l.n).padStart(4)} count=${String(l.count).padStart(4)} ` +
        `src=${String(l.src).padStart(16)} ` +
        `grupoParcelas=${l.grupoParcelas} criadoEm=${l.criadoEm}`,
    );
  }

  // O que a tela usa para montar o card de grupo.
  const grupos = new Set(
    linhas.filter((l) => l.grupoParcelas).map((l) => l.grupoParcelas),
  );
  console.log(`\nGrupos de parcelas: ${Array.from(grupos).join(", ") || "(nenhum)"}`);
  for (const g of grupos) {
    const membros = linhas.filter((l) => l.grupoParcelas === g);
    const contagens = new Set(membros.map((m) => String(m.count)));
    console.log(
      `  ${g}: ${membros.length} membros, installmentCount=${Array.from(contagens).join("/")}`,
    );
    if (contagens.size > 1) {
      console.log("    ^ membros do MESMO grupo com contagens diferentes");
    }
    if (membros.length !== Number(membros[0]?.count)) {
      console.log(
        "    ^ numero de membros nao bate com installmentCount: dado de formato ANTIGO ou escrita parcial",
      );
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
