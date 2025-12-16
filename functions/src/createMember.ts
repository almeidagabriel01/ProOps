/**
 * Standalone Firebase Cloud Function: Create Member User
 * 
 * This is the standalone version for deployment to Firebase Cloud Functions.
 * Use this file when deploying functions separately from your Next.js app.
 * 
 * DEPLOYMENT:
 * 1. Create a functions/ folder in your project root
 * 2. Initialize Firebase Functions: firebase init functions
 * 3. Copy this file to functions/src/createMember.ts
 * 4. Deploy: firebase deploy --only functions
 * 
 * The Next.js API route version uses the same core logic from create-member.ts
 */

import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

// Initialize Firebase Admin (only once)
initializeApp();

// ============================================
// TYPES
// ============================================

interface CreateMemberInput {
  name: string;
  email: string;
  password?: string;
  permissions: {
    [pageSlug: string]: {
      canView: boolean;
      canCreate?: boolean;
      canEdit?: boolean;
      canDelete?: boolean;
    };
  };
}

interface MasterUserDoc {
  role: 'MASTER' | 'MEMBER';
  companyId: string;
  companyName: string;
  subscription?: {
    limits: {
      maxUsers: number;
    };
    status: string;
  };
  usage?: {
    users: number;
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateRandomPassword(length = 16): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ============================================
// CLOUD FUNCTION (Firebase Functions v2)
// ============================================

/**
 * Firebase Callable Function to create a MEMBER user.
 * 
 * The caller's UID is automatically verified by Firebase.
 * All sensitive data (masterId, companyId, role) is derived from the 
 * authenticated user - NEVER trusted from frontend input.
 * 
 * @example Frontend call:
 * ```typescript
 * import { getFunctions, httpsCallable } from 'firebase/functions';
 * 
 * const functions = getFunctions();
 * const createMember = httpsCallable(functions, 'createMember');
 * 
 * const result = await createMember({
 *   name: "João Silva",
 *   email: "joao@empresa.com",
 *   permissions: {
 *     "/dashboard": { canView: true },
 *     "/proposals": { canView: true, canEdit: true }
 *   }
 * });
 * ```
 */
export const createMember = onCall(
  {
    // Optional: Configure function options
    region: "southamerica-east1", // São Paulo
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (request: CallableRequest<CreateMemberInput>) => {
    const db = getFirestore();
    const auth = getAuth();
    
    // ============================================
    // STEP 1: Validate Authentication
    // ============================================
    
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Você precisa estar logado para criar membros"
      );
    }
    
    const masterId = request.auth.uid;
    const input = request.data;
    
    // ============================================
    // STEP 2: Validate Input
    // ============================================
    
    if (!input.name || input.name.trim().length < 2) {
      throw new HttpsError(
        "invalid-argument",
        "Nome deve ter pelo menos 2 caracteres"
      );
    }
    
    if (!input.email || !isValidEmail(input.email)) {
      throw new HttpsError(
        "invalid-argument",
        "Email inválido"
      );
    }
    
    // ============================================
    // STEP 3: Fetch MASTER user and validate role
    // ============================================
    
    const masterRef = db.collection('users').doc(masterId);
    const masterSnap = await masterRef.get();
    
    if (!masterSnap.exists) {
      throw new HttpsError("not-found", "Usuário não encontrado");
    }
    
    const masterData = masterSnap.data() as MasterUserDoc;
    
    // SECURITY: Only MASTER can create members
    if (masterData.role !== 'MASTER') {
      throw new HttpsError(
        "permission-denied",
        "Apenas usuários MASTER podem criar membros da equipe"
      );
    }
    
    // ============================================
    // STEP 4: Check subscription status
    // ============================================
    
    if (!masterData.subscription) {
      throw new HttpsError(
        "failed-precondition",
        "Você precisa de um plano ativo para adicionar membros"
      );
    }
    
    if (masterData.subscription.status !== 'ACTIVE' && 
        masterData.subscription.status !== 'TRIALING') {
      throw new HttpsError(
        "failed-precondition",
        "Seu plano não está ativo. Regularize sua assinatura."
      );
    }
    
    // ============================================
    // STEP 5: Check plan limits
    // ============================================
    
    const maxUsers = masterData.subscription.limits.maxUsers;
    const currentUsers = masterData.usage?.users ?? 0;
    
    // -1 means unlimited
    if (maxUsers !== -1 && currentUsers >= maxUsers) {
      throw new HttpsError(
        "failed-precondition",
        `Limite de usuários atingido (${currentUsers}/${maxUsers}). ` +
        `Faça upgrade do plano para adicionar mais membros.`
      );
    }
    
    // ============================================
    // STEP 6: Check if email already exists
    // ============================================
    
    try {
      await auth.getUserByEmail(input.email);
      throw new HttpsError(
        "already-exists",
        "Este email já está cadastrado no sistema"
      );
    } catch (err) {
      const error = err as { code?: string };
      if (error.code !== 'auth/user-not-found' && 
          (err as HttpsError).code !== 'already-exists') {
        throw err;
      }
      if ((err as HttpsError).code === 'already-exists') {
        throw err;
      }
    }
    
    // ============================================
    // STEP 7: Create user in Firebase Auth
    // ============================================
    
    const password = input.password || generateRandomPassword();
    
    let memberAuthUser;
    try {
      memberAuthUser = await auth.createUser({
        email: input.email,
        password: password,
        displayName: input.name,
        emailVerified: false,
      });
    } catch (err) {
      console.error('Error creating Firebase Auth user:', err);
      throw new HttpsError(
        "internal",
        "Erro ao criar usuário. Tente novamente."
      );
    }
    
    const memberId = memberAuthUser.uid;
    
    // ============================================
    // STEP 8: Create Firestore documents (Transactional)
    // ============================================
    
    try {
      await db.runTransaction(async (transaction) => {
        const now = Timestamp.now();
        
        // 8a. Create the MEMBER user document
        const memberRef = db.collection('users').doc(memberId);
        transaction.set(memberRef, {
          name: input.name.trim(),
          email: input.email.toLowerCase().trim(),
          photoUrl: null,
          
          // Role & Hierarchy - DERIVED FROM MASTER
          role: 'MEMBER',
          masterId: masterId,
          
          // Company - COPIED FROM MASTER
          companyId: masterData.companyId,
          companyName: masterData.companyName,
          
          createdAt: now,
          updatedAt: now,
        });
        
        // 8b. Create permission documents
        for (const [pageSlug, perms] of Object.entries(input.permissions || {})) {
          const pageId = pageSlug.replace(/\//g, '_').replace(/^_/, '');
          const permRef = memberRef.collection('permissions').doc(pageId);
          
          transaction.set(permRef, {
            pageId: pageId,
            pageSlug: pageSlug,
            pageName: pageSlug.charAt(1).toUpperCase() + pageSlug.slice(2),
            
            canView: perms.canView ?? false,
            canCreate: perms.canCreate ?? false,
            canEdit: perms.canEdit ?? false,
            canDelete: perms.canDelete ?? false,
            
            updatedAt: now,
          });
        }
        
        // 8c. Increment MASTER's usage counter
        transaction.update(masterRef, {
          'usage.users': FieldValue.increment(1),
          updatedAt: now,
        });
        
        // 8d. Increment Company's usage counter
        const companyRef = db.collection('companies').doc(masterData.companyId);
        transaction.update(companyRef, {
          'usage.users': FieldValue.increment(1),
          updatedAt: now,
        });
      });
    } catch (err) {
      // Rollback: Delete the Firebase Auth user
      console.error('Transaction failed, rolling back Auth user:', err);
      try {
        await auth.deleteUser(memberId);
      } catch (deleteErr) {
        console.error('Failed to rollback Auth user:', deleteErr);
      }
      
      throw new HttpsError(
        "internal",
        "Erro ao salvar dados do usuário. Tente novamente."
      );
    }
    
    // ============================================
    // STEP 9: Return success
    // ============================================
    
    return {
      success: true,
      memberId: memberId,
      message: `Usuário ${input.name} criado com sucesso!`,
    };
  }
);
