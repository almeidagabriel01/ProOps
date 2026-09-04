/**
 * Popula `received_invoices` com notas de entrada FICTÍCIAS, para exercitar a
 * tela sem depender de um fornecedor emitir contra o CNPJ real.
 *
 * Por que existe: a sincronização traz notas da Receita, e em dev não há notas
 * — o CNPJ de teste nunca comprou de ninguém. Sem isto, a única forma de ver a
 * tela com dado seria em produção, esperando um fornecedor real.
 *
 * O que ESTES dados exercitam de ponta a ponta:
 *   - lista, ordenação, estados vazios, colunas em mobile
 *   - diálogo de produtos com NCM e o botão de copiar
 *   - lançar como despesa, o aviso de duplicata e o estado "Lançada"
 *
 * O que NÃO dá para testar assim: a **manifestação**, que faz POST no provedor
 * e seria recusada para uma chave que não existe na Receita. O comportamento de
 * interface dela está coberto em `manifest-invoice-dialog.test.tsx`.
 *
 * Uso:
 *   cd apps/functions
 *   npx tsx src/scripts/seed-received-invoices.ts --tenant=<id>
 *   npx tsx src/scripts/seed-received-invoices.ts --tenant=<id> --clean
 *
 * Recusa rodar em produção: dado fiscal inventado não entra na base de um
 * cliente, nem para teste.
 */
import { getFirestore } from "firebase-admin/firestore";
import { initScriptAdmin } from "./_script-init";

const COLLECTION = "received_invoices";
const CLEAN = process.argv.includes("--clean");
const TENANT =
  process.argv.find((arg) => arg.startsWith("--tenant="))?.split("=")[1]?.trim() ||
  null;

/** Marca própria: permite achar e remover exatamente o que este script criou. */
const SEED_FLAG = "__seed_received__";

/**
 * Chaves de 44 dígitos que NÃO existem na Receita.
 *
 * Começam com "99" de propósito: os dois primeiros dígitos são o código da UF,
 * e 99 não é UF nenhuma. Assim nenhum destes pode colidir com uma nota real se
 * o script for apontado para a base errada por engano.
 */
const CHAVES = [
  "99".padEnd(44, "1"),
  "99".padEnd(44, "2"),
  "99".padEnd(44, "3"),
  "99".padEnd(44, "4"),
];

function diasAtras(dias: number): string {
  const data = new Date();
  data.setDate(data.getDate() - dias);
  return data.toISOString();
}

function buildNotes(tenantId: string) {
  const agora = new Date().toISOString();
  const base = { tenantId, [SEED_FLAG]: true, createdAt: agora, updatedAt: agora };

  return [
    // 1. Resumo, sem resposta — o estado que pede ação, e o único destacado.
    {
      ...base,
      chaveAcesso: CHAVES[0],
      versao: 1,
      status: "resumo",
      emitenteCnpj: "11222333000181",
      emitenteNome: "DISTRIBUIDORA DE MATERIAL ELETRICO ALFA LTDA",
      emitenteUf: "MG",
      numero: "10455",
      serie: "1",
      dataEmissao: diasAtras(3),
      valorTotal: 1487.9,
    },
    // 2. Confirmada, COM itens — é aqui que o NCM aparece, o ganho do módulo.
    {
      ...base,
      chaveAcesso: CHAVES[1],
      versao: 2,
      status: "completa",
      emitenteCnpj: "44555666000199",
      emitenteNome: "AUTOMACAO E SEGURANCA BETA COMERCIO LTDA",
      emitenteUf: "SP",
      numero: "8891",
      serie: "2",
      dataEmissao: diasAtras(12),
      valorTotal: 3260.5,
      manifestacao: "confirmacao",
      manifestadaEm: diasAtras(11),
      itens: [
        {
          numero: 1,
          codigo: "CB-BIP-15",
          descricao: "Cabo bipolar 2x1,5mm flexivel 750V - rolo 100m",
          ncm: "85444900",
          cfop: "6102",
          unidade: "RL",
          quantidade: 4,
          valorUnitario: 289.9,
          valorTotal: 1159.6,
        },
        {
          numero: 2,
          codigo: "SEN-PIR-360",
          descricao: "Sensor de presenca infravermelho 360 graus teto",
          ncm: "85311090",
          cfop: "6102",
          unidade: "UN",
          quantidade: 10,
          valorUnitario: 118.5,
          valorTotal: 1185,
        },
        {
          numero: 3,
          codigo: "INT-SMART-4",
          descricao: "Interruptor inteligente 4 canais Wi-Fi",
          ncm: "85365090",
          cfop: "6102",
          unidade: "UN",
          quantidade: 6,
          valorUnitario: 152.65,
          valorTotal: 915.9,
        },
      ],
    },
    // 3. Só ciência — manifestada, mas ainda sem o XML completo.
    {
      ...base,
      chaveAcesso: CHAVES[2],
      versao: 1,
      status: "resumo",
      emitenteCnpj: "77888999000155",
      emitenteNome: "GAMA FERRAGENS E FIXADORES ME",
      emitenteUf: "MG",
      numero: "332",
      serie: "1",
      dataEmissao: diasAtras(20),
      valorTotal: 214.35,
      manifestacao: "ciencia",
      manifestadaEm: diasAtras(19),
    },
    // 4. Cancelada pelo fornecedor — não deve oferecer nem responder nem lançar.
    {
      ...base,
      chaveAcesso: CHAVES[3],
      versao: 3,
      status: "cancelada",
      emitenteCnpj: "11222333000181",
      emitenteNome: "DISTRIBUIDORA DE MATERIAL ELETRICO ALFA LTDA",
      emitenteUf: "MG",
      numero: "10460",
      serie: "1",
      dataEmissao: diasAtras(6),
      valorTotal: 540,
    },
  ];
}

async function main(): Promise<void> {
  const projectId = initScriptAdmin();
  const db = getFirestore();

  console.log(`=== seed-received-invoices — projeto: ${projectId} ===`);

  // Dado fiscal inventado nao entra na base de um cliente, nem para teste.
  if (projectId.includes("prod")) {
    console.error(
      "RECUSADO: este script cria notas ficticias e nao roda em producao.",
    );
    process.exit(1);
  }

  if (!TENANT) {
    console.error("Informe o tenant: --tenant=<id>");
    process.exit(1);
  }

  const notes = buildNotes(TENANT);

  if (CLEAN) {
    let removed = 0;
    for (const note of notes) {
      const ref = db.collection(COLLECTION).doc(`${TENANT}_${note.chaveAcesso}`);
      const snap = await ref.get();
      // So apaga o que ESTE script criou — nunca uma nota real que por acaso
      // tenha o mesmo id.
      if (snap.exists && (snap.data() as Record<string, unknown>)[SEED_FLAG]) {
        await ref.delete();
        removed += 1;
      }
    }
    console.log(`${removed} nota(s) de teste removida(s).`);
    console.log(
      "Lançamentos gerados a partir delas NAO sao apagados — apague em /transactions.",
    );
    return;
  }

  for (const note of notes) {
    const id = `${TENANT}_${note.chaveAcesso}`;
    await db.collection(COLLECTION).doc(id).set({ ...note, id }, { merge: true });
    console.log(`  ${note.status.padEnd(10)} ${note.emitenteNome}`);
  }

  console.log(`\n${notes.length} notas criadas para ${TENANT}.`);
  console.log("Abra /invoices, aba \"Recebidas\".");
  console.log(
    "Lembre de ligar \"Receber notas dos fornecedores\" em /settings/fiscal —\n" +
      "sem a flag a aba mostra o estado desligado e nao lista nada.",
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("seed-received-invoices falhou:", err);
    process.exit(1);
  });
