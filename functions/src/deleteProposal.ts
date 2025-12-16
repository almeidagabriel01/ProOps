import * as functions from "firebase-functions";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

interface DeleteProposalInput {
  proposalId: string;
}

interface UserDoc {
  role: 'MASTER' | 'MEMBER';
  masterId: string | null;
  tenantId: string;
  companyId?: string;
  subscription?: {
    status: string;
  };
}

export const deleteProposal = functions
  .region("southamerica-east1")
  .https.onCall(async (data: DeleteProposalInput, context) => {
    const db = getFirestore();

    // 1. Auth Check
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Login necessário.");
    }
    const userId = context.auth.uid;
    const { proposalId } = data;

    if (!proposalId) {
      throw new functions.https.HttpsError("invalid-argument", "ID da proposta inválido.");
    }

    // 2. Fetch User
    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Usuário não encontrado.");
    }
    const userData = userSnap.data() as UserDoc;
    const tenantId = userData.tenantId || userData.companyId;

    if (!tenantId) {
      throw new functions.https.HttpsError("failed-precondition", "Usuário sem tenantId.");
    }

    // 3. Permission Check
    const role = (userData.role as string)?.toUpperCase();
    const isMaster = role === 'MASTER' || role === 'ADMIN' || role === 'WK' || (!userData.masterId && userData.subscription);

    if (!isMaster) {
      // Check permissions for MEMBER
      const permRef = userRef.collection('permissions').doc('proposals');
      const permSnap = await permRef.get();
      if (!permSnap.exists || !permSnap.data()?.canDelete) {
        throw new functions.https.HttpsError("permission-denied", "Sem permissão para deletar propostas.");
      }
    }

    // 4. Resolve Master for Usage Decrement
    let masterRef: FirebaseFirestore.DocumentReference;
    if (isMaster) {
        masterRef = userRef;
    } else {
        const masterId = userData.masterId;
        if (!masterId) throw new functions.https.HttpsError("failed-precondition", "Erro configuração da conta (Member sem Master).");
        masterRef = db.collection('users').doc(masterId);
    }

    // 5. Transaction
    try {
      await db.runTransaction(async (transaction) => {
        // Read Proposal
        const proposalRef = db.collection('proposals').doc(proposalId);
        const proposalSnap = await transaction.get(proposalRef);

        if (!proposalSnap.exists) {
           throw new functions.https.HttpsError("not-found", "Proposta não encontrada.");
        }

        const proposalData = proposalSnap.data();
        if (proposalData?.tenantId !== tenantId) {
           throw new functions.https.HttpsError("permission-denied", "Esta proposta não pertence a sua organização.");
        }

        // Read Metadatas for Usage (READ BEFORE WRITE)
        const companyRef = db.collection('companies').doc(tenantId);
        const companySnap = await transaction.get(companyRef);

        // Perform Writes
        transaction.delete(proposalRef);

        // Decrement Usage
        transaction.update(masterRef, {
            'usage.proposals': FieldValue.increment(-1)
        });
        
        // Decrement Company Usage
        if (companySnap.exists) {
            transaction.update(companyRef, {
                'usage.proposals': FieldValue.increment(-1)
            });
        }
      });

      return { success: true, message: "Proposta excluída com sucesso." };

    } catch (error) {
      console.error("Delete Proposal Error:", error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError("internal", (error as Error).message);
    }
  });
