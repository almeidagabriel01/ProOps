/**
 * Cloud Function: Delete Product
 */

import * as functions from "firebase-functions";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp();
}

export const deleteProduct = functions
  .region("southamerica-east1")
  .https.onCall(async (data: { productId: string }, context) => {
    const db = getFirestore();
    
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login necessário.");
    const userId = context.auth.uid;
    const { productId } = data;
    
    if (!productId) throw new functions.https.HttpsError("invalid-argument", "ID do produto obrigatório.");
    
    // Fetch User
    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new functions.https.HttpsError("not-found", "Usuário não encontrado.");
    const userData = userSnap.data() as any;
    console.log(`[deleteProduct] User ${userId} data:`, JSON.stringify(userData));

    // Resolve Master
    let masterRef: FirebaseFirestore.DocumentReference;
    const role = userData.role?.toUpperCase();
    const isMaster = role === 'MASTER' || role === 'ADMIN' || role === 'WK' || (!userData.masterId && !userData.masterID && userData.subscription);

    if (isMaster) {
       masterRef = userRef;
    } else {
       const masterId = userData.masterId || userData.masterID || userData.ownerId;
       if (!masterId) throw new functions.https.HttpsError("failed-precondition", "Configuração de conta inválida: masterId ausente.");
       masterRef = db.collection('users').doc(masterId);
    }

    const userCompanyId = userData.companyId || userData.tenantId;
    if (!userCompanyId) {
        throw new functions.https.HttpsError("failed-precondition", "Configuração de conta inválida: companyId/tenantId ausente.");
    }
    
    // Permission
    if (userData.role === 'MEMBER') {
       const permRef = userRef.collection('permissions').doc('products');
       const permSnap = await permRef.get();
       if (!permSnap.exists || !permSnap.data()?.canDelete) {
          throw new functions.https.HttpsError("permission-denied", "Sem permissão para deletar produtos.");
       }
    }
    
    // Deletion Transaction
    try {
      await db.runTransaction(async (transaction) => {
         const productRef = db.collection('products').doc(productId);
         const companyRef = db.collection('companies').doc(userCompanyId);

         // READS
         const productSnap = await transaction.get(productRef);
         const companySnap = await transaction.get(companyRef);
         
         // CHECKS
         if (!productSnap.exists) throw new functions.https.HttpsError("not-found", "Produto não encontrado.");
         
         const productData = productSnap.data();
         if (productData?.tenantId !== userCompanyId) {
            throw new functions.https.HttpsError("permission-denied", "Acesso negado.");
         }
         
         // WRITES
         transaction.delete(productRef);
         
         transaction.update(masterRef, {
            'usage.products': FieldValue.increment(-1),
            updatedAt: Timestamp.now()
         });
         
         if (companySnap.exists) {
            transaction.update(companyRef, {
                'usage.products': FieldValue.increment(-1),
                updatedAt: Timestamp.now()
            });
         } else {
            console.warn(`[deleteProduct] Company ${userCompanyId} not found. Skipping usage update.`);
         }
      });
      
      return { success: true, message: "Produto removido." };
    } catch (error) {
       console.error("Delete Product Error:", error);
       if (error instanceof functions.https.HttpsError) throw error;
       throw new functions.https.HttpsError("internal", `Erro ao deletar produto: ${(error as Error).message}`);
    }
  });
