import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { resolveWalletRef } from "./finance-helpers";

interface CleanupTransactionData {
  status?: string;
  type?: string;
  wallet?: string;
  amount?: number;
}

/**
 * Apaga os lançamentos de uma proposta e estorna das carteiras o que já estava
 * pago, dentro da transação recebida.
 *
 * Todas as leituras (resolução de carteira) acontecem ANTES da primeira
 * escrita. O Admin SDK lança quando uma transação lê depois de escrever — e a
 * versão anterior resolvia a carteira do segundo lançamento depois de já ter
 * apagado o primeiro, então reverter ou excluir uma proposta com dois ou mais
 * lançamentos pagos falhava inteira: nada era estornado e os lançamentos
 * ficavam órfãos.
 *
 * Estornos da mesma carteira são somados num único `increment`.
 */
export async function applyProposalTransactionsCleanup(
  t: FirebaseFirestore.Transaction,
  db: FirebaseFirestore.Firestore,
  tenantId: string,
  docs: Array<{
    ref: FirebaseFirestore.DocumentReference;
    data: () => CleanupTransactionData | undefined;
  }>,
): Promise<void> {
  const reversals = new Map<
    string,
    { ref: FirebaseFirestore.DocumentReference; amount: number }
  >();
  const resolvedByIdentifier = new Map<
    string,
    FirebaseFirestore.DocumentReference | null
  >();

  for (const doc of docs) {
    const data = doc.data() || {};
    if (data.status !== "paid" || !data.wallet || !data.amount) continue;

    if (!resolvedByIdentifier.has(data.wallet)) {
      const resolved = await resolveWalletRef(t, db, tenantId, data.wallet);
      resolvedByIdentifier.set(data.wallet, resolved ? resolved.ref : null);
    }
    const walletRef = resolvedByIdentifier.get(data.wallet);
    if (!walletRef) continue;

    const sign = data.type === "income" ? 1 : -1;
    const reverseAmount = -(data.amount * sign);
    const current = reversals.get(walletRef.path);
    reversals.set(walletRef.path, {
      ref: walletRef,
      amount: (current?.amount || 0) + reverseAmount,
    });
  }

  for (const { ref, amount } of reversals.values()) {
    t.update(ref, {
      balance: FieldValue.increment(amount),
      updatedAt: Timestamp.now(),
    });
  }

  for (const doc of docs) {
    t.delete(doc.ref);
  }
}
