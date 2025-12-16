/**
 * Cloud Function: Delete Client
 */

import * as functions from "firebase-functions";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp();
}

export const deleteClient = functions
  .region("southamerica-east1")
  .https.onCall(async (data: { clientId: string }, context) => {
    const db = getFirestore();
    
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login necessário.");
    const userId = context.auth.uid;
    const { clientId } = data;
    
    if (!clientId) throw new functions.https.HttpsError("invalid-argument", "ID do cliente obrigatório.");
    
    // Fetch User
    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new functions.https.HttpsError("not-found", "Usuário não encontrado.");
    const userData = userSnap.data() as any;
    console.log(`[deleteClient] User ${userId} data:`, JSON.stringify(userData)); // DEBUG
    
    // Resolve Master
    let masterRef: FirebaseFirestore.DocumentReference;
    const role = userData.role?.toUpperCase();
    const isMaster = role === 'MASTER' || role === 'ADMIN' || role === 'WK' || (!userData.masterId && !userData.masterID && userData.subscription); // Self-detection

    if (isMaster) {
       masterRef = userRef;
    } else {
       const masterId = userData.masterId || userData.masterID || userData.ownerId; // Handle masterID (legacy)
       if (!masterId) {
           console.error(`[deleteClient] Missing masterId for user ${userId}. Role: ${userData.role}`);
           throw new functions.https.HttpsError("failed-precondition", "Configuração de conta inválida: masterId ausente.");
       }
       masterRef = db.collection('users').doc(masterId);
    }

    const userCompanyId = userData.companyId || userData.tenantId; // Fallback
    if (!userCompanyId) {
        console.error(`[deleteClient] Missing companyId/tenantId for user ${userId}`);
        throw new functions.https.HttpsError("failed-precondition", "Configuração de conta inválida: companyId/tenantId ausente.");
    }
    
    // Permission
    if (userData.role === 'MEMBER') {
       const permRef = userRef.collection('permissions').doc('clients');
       const permSnap = await permRef.get();
       if (!permSnap.exists || !permSnap.data()?.canDelete) {
          throw new functions.https.HttpsError("permission-denied", "Sem permissão para deletar clientes.");
       }
    }
    
    // Deletion Transaction
    try {
      await db.runTransaction(async (transaction) => {
        const clientRef = db.collection('clients').doc(clientId);
        const companyRef = db.collection('companies').doc(userCompanyId);

        // READS
        const clientSnap = await transaction.get(clientRef);
        const companySnap = await transaction.get(companyRef);
        
        // CHECKS
        if (!clientSnap.exists) throw new functions.https.HttpsError("not-found", "Cliente não encontrado.");
        
        const clientData = clientSnap.data();
        if (clientData?.tenantId !== userCompanyId) {
             console.warn(`[deleteClient] Access denied. Client tenant: ${clientData?.tenantId}, User tenant: ${userCompanyId}`);
             throw new functions.https.HttpsError("permission-denied", "Acesso negado.");
        }

        // WRITES
        transaction.delete(clientRef);
        
        transaction.update(masterRef, {
           'usage.clients': FieldValue.increment(-1),
           updatedAt: Timestamp.now()
        });
        
        if (companySnap.exists) {
             transaction.update(companyRef, {
                'usage.clients': FieldValue.increment(-1),
                updatedAt: Timestamp.now()
             });
        } else {
             console.warn(`[deleteClient] Company/Tenant ${userCompanyId} not found. Skipping usage update.`);
        }
      });
      
      return { success: true, message: "Cliente removido." };
    } catch (error) {
       console.error("Delete Client Error:", error);
       if (error instanceof functions.https.HttpsError) throw error;
       // Unmasking error for debugging
       throw new functions.https.HttpsError("internal", `Erro ao deletar cliente: ${(error as Error).message}`);
    }
  });
