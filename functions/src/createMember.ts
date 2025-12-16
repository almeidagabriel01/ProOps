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
 * 
 * MIGRATED TO V1: Uses firebase-functions (v1) for full httpsCallable compatibility
 */

import * as functions from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { canManageTeam } from "./authUtils";

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
  planId?: string;
  tenantId: string;
  companyName?: string; // Optional or deprecated
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
// CLOUD FUNCTION (Firebase Functions v1)
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
 * const functions = getFunctions(app, 'southamerica-east1');
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
export const createMember = functions
  .region("southamerica-east1")
  .https.onCall(async (data: CreateMemberInput, context) => {
    const db = getFirestore();
    const auth = getAuth();
    
    // ============================================
    // STEP 1: Validate Authentication
    // ============================================
    
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Você precisa estar logado para criar membros"
      );
    }
    
    const masterId = context.auth.uid;
    const input = data;
    
    // ============================================
    // STEP 2: Validate Input
    // ============================================
    
    if (!input.name || input.name.trim().length < 2) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Nome deve ter pelo menos 2 caracteres"
      );
    }
    
    if (!input.email || !isValidEmail(input.email)) {
      throw new functions.https.HttpsError(
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
      throw new functions.https.HttpsError("not-found", "Usuário não encontrado");
    }
    
    const masterData = masterSnap.data() as MasterUserDoc;
    
    // SECURITY: Only MASTER/ADMIN/SUPERADMIN can create members
    // Uses normalized role check to support 'admin', 'superadmin', 'master' roles
    const role = masterData.role?.toUpperCase();
    const isMaster = role === 'MASTER' || role === 'ADMIN' || role === 'WK' || canManageTeam(masterData.role);
    
    if (!isMaster) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Apenas administradores podem criar membros da equipe"
      );
    }
    
    // Verify critical data existence
    if (!masterData.tenantId) {
      console.error(`[createMember] User ${masterId} has no tenantId`);
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Erro na conta: Identificador do tenant não encontrado. Contate o suporte."
      );
    }

    // ============================================
    // STEP 4: Check Plan Limits
    // ============================================
    
    // ============================================
    // STEP 4: Check Plan Limits
    // ============================================

    // ============================================
    // STEP 4: Check Plan Limits
    // ============================================

    let maxUsersVal = 1;
    const planId = masterData.planId || 'free';

    // 1. Check legacy/hardcoded limits (optimization for default tiers)
    const LEGACY_LIMITS: Record<string, number> = {
        free: 1,
        starter: 2,
        pro: 10,
        enterprise: -1
    };

    if (LEGACY_LIMITS[planId] !== undefined) {
        maxUsersVal = LEGACY_LIMITS[planId];
        console.log(`[createMember] Using legacy limit for ${planId}: ${maxUsersVal}`);
    } else {
        // 2. Fetch dynamic plan from Firestore
        console.log(`[createMember] Fetching dynamic plan: ${planId}`);
        const planSnap = await db.collection('plans').doc(planId).get();
        
        if (planSnap.exists) {
            const planData = planSnap.data();
            const planMaxUsers = planData?.features?.maxUsers;
            
            if (planMaxUsers !== undefined) {
                maxUsersVal = planMaxUsers;
            } else {
                console.warn(`[createMember] Plan ${planId} has no maxUsers feature, defaulting to 1`);
            }
        } else {
            console.warn(`[createMember] Plan ${planId} not found, defaulting to free limit.`);
        }
    }

    console.log(`[createMember] Final Max Users: ${maxUsersVal}`);

    const maxUsers = Number(maxUsersVal); 
    
    // Check Max Users Limit
    const usersRef = db.collection('users');
    const usersQuery = usersRef.where('masterId', '==', masterId);
    const usersSnap = await usersQuery.count().get();
    const currentUsers = Number(usersSnap.data().count);

    console.log(`[createMember] Usage: ${currentUsers}/${maxUsers}`);

    if (maxUsers >= 0 && currentUsers >= maxUsers) {
         throw new functions.https.HttpsError(
            "failed-precondition",
            `Limite de usuários atingido (${currentUsers}/${maxUsers}). Faça upgrade para adicionar mais membros.`
        );
    }
    
    // ============================================
    // STEP 5: Create User in Auth & Firestore
    // ============================================
    
    try {
      await auth.getUserByEmail(input.email);
      throw new functions.https.HttpsError(
        "already-exists",
        "Este email já está cadastrado no sistema"
      );
    } catch (err) {
      const error = err as { code?: string };
      if (error.code !== 'auth/user-not-found' && 
          (err as functions.https.HttpsError).code !== 'already-exists') {
        throw err;
      }
      if ((err as functions.https.HttpsError).code === 'already-exists') {
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
      throw new functions.https.HttpsError(
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
        
        // 8a. READ: Check Company/Tenant document existence FIRST
        const companyRef = db.collection('companies').doc(masterData.tenantId);
        const companySnap = await transaction.get(companyRef);
        
        // 8b. WRITE: Create the MEMBER user document
        const memberRef = db.collection('users').doc(memberId);
        transaction.set(memberRef, {
          name: input.name.trim(),
          email: input.email.toLowerCase().trim(),
          photoUrl: null,
          
          // Role & Hierarchy - DERIVED FROM MASTER
          role: 'MEMBER',
          masterId: masterId,
          
          // Company/Tenant - COPIED FROM MASTER
          tenantId: masterData.tenantId,
          companyName: masterData.companyName || 'Minha Empresa', // Fallback if missing
          
          createdAt: now,
          updatedAt: now,
        });
        
        // Permission sub-collection writes
        const permissionsInput = input.permissions || {};
        for (const [pageSlug, perms] of Object.entries(permissionsInput)) {
          // Normalize pageId or generate one if strictly needed
          // Assuming pageSlug is the ID
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
        
        // 8c. WRITE: Increment MASTER's usage counter
        transaction.update(masterRef, {
          'usage.users': FieldValue.increment(1),
          updatedAt: now,
        });
        
        // 8d. WRITE: Increment Tenant's/Company's usage counter
        if (companySnap.exists) {
          transaction.update(companyRef, {
            'usage.users': FieldValue.increment(1),
            updatedAt: now,
          });
        } else {
             console.warn(`[createMember] Company/Tenant document ${masterData.tenantId} not found, skipping usage increment.`);
        }
      });
    } catch (err) {
      // Rollback: Delete the Firebase Auth user
      console.error('Transaction failed, rolling back Auth user:', err);
      try {
        await auth.deleteUser(memberId);
      } catch (deleteErr) {
        console.error('Failed to rollback Auth user:', deleteErr);
      }
      
      throw new functions.https.HttpsError(
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
  });
