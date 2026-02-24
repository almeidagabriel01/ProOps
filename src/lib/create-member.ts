/**
 * Cloud Function: Create Member User
 * 
 * Creates a MEMBER user linked to a MASTER user in a multi-tenant ERP SaaS.
 * This can be used as a standalone Firebase Cloud Function OR as the core
 * logic for a Next.js API route.
 * 
 * SECURITY: All sensitive data (masterId, companyId, role) is derived from
 * the authenticated user - NEVER trusted from frontend input.
 */

import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { randomBytes } from "node:crypto";
import { getAdminApp } from "@/lib/firebase-admin";

// ============================================
// TYPES
// ============================================

/** Input from frontend - only safe, validated data */
export interface CreateMemberInput {
  name: string;
  email: string;
  password?: string; // Optional - if not provided, generate random
  permissions: {
    [pageSlug: string]: {
      canView: boolean;
      canCreate?: boolean;
      canEdit?: boolean;
      canDelete?: boolean;
    };
  };
}

/** Response from the function */
export interface CreateMemberResponse {
  success: boolean;
  memberId?: string;
  message: string;
}

/** User document structure (partial for type safety) */
interface MasterUserDoc {
  role: 'MASTER' | 'MEMBER';
  companyId: string;
  companyName: string;
  subscription?: {
    limits: {
      maxUsers: number;
      maxProposals: number;
      maxClients: number;
      maxProducts: number;
    };
    status: string;
  };
  usage?: {
    users: number;
    proposals: number;
    clients: number;
    products: number;
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate a random secure password
 */
function generateRandomPassword(length = 16): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const random = randomBytes(Math.max(length, 1));
  let password = "";
  for (let i = 0; i < length; i += 1) {
    const index = random[i] % chars.length;
    password += chars.charAt(index);
  }
  return password;
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Creates a MEMBER user linked to the authenticated MASTER.
 * 
 * @param masterId - The authenticated user's ID (from Firebase Auth token)
 * @param input - The input data from the frontend
 * @returns CreateMemberResponse with success status and member ID
 * 
 * @throws Error with code 'permission-denied' if caller is not MASTER
 * @throws Error with code 'failed-precondition' if plan limit reached
 * @throws Error with code 'invalid-argument' if input validation fails
 */
export async function createMemberUser(
  masterId: string,
  input: CreateMemberInput
): Promise<CreateMemberResponse> {
  // Initialize Firebase Admin
  const app = getAdminApp();
  if (!app) {
    throw new Error('Firebase Admin not configured');
  }
  
  const db = getFirestore(app);
  const auth = getAuth(app);
  
  // ============================================
  // STEP 1: Validate Input
  // ============================================
  
  if (!input.name || input.name.trim().length < 2) {
    const error = new Error('Nome deve ter pelo menos 2 caracteres');
    (error as Error & { code?: string }).code = 'invalid-argument';
    throw error;
  }
  
  if (!input.email || !isValidEmail(input.email)) {
    const error = new Error('Email inválido');
    (error as Error & { code?: string }).code = 'invalid-argument';
    throw error;
  }
  
  // ============================================
  // STEP 2: Fetch MASTER user and validate role
  // ============================================
  
  const masterRef = db.collection('users').doc(masterId);
  const masterSnap = await masterRef.get();
  
  if (!masterSnap.exists) {
    const error = new Error('Usuário não encontrado');
    (error as Error & { code?: string }).code = 'not-found';
    throw error;
  }
  
  const masterData = masterSnap.data() as MasterUserDoc;
  
  // SECURITY: Only MASTER can create members
  if (masterData.role !== 'MASTER') {
    const error = new Error('Apenas usuários MASTER podem criar membros da equipe');
    (error as Error & { code?: string }).code = 'permission-denied';
    throw error;
  }
  
  // ============================================
  // STEP 3: Check subscription status
  // ============================================
  
  if (!masterData.subscription) {
    const error = new Error('Você precisa de um plano ativo para adicionar membros');
    (error as Error & { code?: string }).code = 'failed-precondition';
    throw error;
  }
  
  if (masterData.subscription.status !== 'ACTIVE' && masterData.subscription.status !== 'TRIALING') {
    const error = new Error('Seu plano não está ativo. Regularize sua assinatura.');
    (error as Error & { code?: string }).code = 'failed-precondition';
    throw error;
  }
  
  // ============================================
  // STEP 4: Check plan limits
  // ============================================
  
  const maxUsers = masterData.subscription.limits.maxUsers;
  const currentUsers = masterData.usage?.users ?? 0;
  
  // -1 means unlimited
  if (maxUsers !== -1 && currentUsers >= maxUsers) {
    const error = new Error(
      `Limite de usuários atingido (${currentUsers}/${maxUsers}). ` +
      `Faça upgrade do plano para adicionar mais membros.`
    );
    (error as Error & { code?: string }).code = 'failed-precondition';
    throw error;
  }
  
  // ============================================
  // STEP 5: Check if email already exists
  // ============================================
  
  try {
    await auth.getUserByEmail(input.email);
    // If we get here, user exists
    const error = new Error('Este email já está cadastrado no sistema');
    (error as Error & { code?: string }).code = 'already-exists';
    throw error;
  } catch (err) {
    // auth/user-not-found is expected - means email is available
    if ((err as Error & { code?: string }).code !== 'auth/user-not-found') {
      throw err; // Re-throw if it's a different error
    }
  }
  
  // ============================================
  // STEP 6: Create user in Firebase Auth
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
    const error = new Error('Erro ao criar usuário. Tente novamente.');
    (error as Error & { code?: string }).code = 'internal';
    throw error;
  }
  
  const memberId = memberAuthUser.uid;
  
  // ============================================
  // STEP 7: Create Firestore documents (Transactional)
  // ============================================
  
  try {
    await db.runTransaction(async (transaction) => {
      const now = Timestamp.now();
      
      // 7a. Create the MEMBER user document
      const memberRef = db.collection('users').doc(memberId);
      transaction.set(memberRef, {
        // Core info
        name: input.name.trim(),
        email: input.email.toLowerCase().trim(),
        photoUrl: null,
        
        // Role & Hierarchy - DERIVED FROM MASTER, NOT FROM FRONTEND
        role: 'MEMBER',
        masterId: masterId, // Link to MASTER
        
        // Company - COPIED FROM MASTER
        companyId: masterData.companyId,
        companyName: masterData.companyName,
        
        // MEMBER does NOT have subscription or usage
        // These fields are only on MASTER
        
        // Timestamps
        createdAt: now,
        updatedAt: now,
      });
      
      // 7b. Create permission documents
      for (const [pageSlug, perms] of Object.entries(input.permissions)) {
        // Generate a pageId from the slug (or fetch from pages collection in production)
        const pageId = pageSlug.replace(/\//g, '_').replace(/^_/, '');
        const permRef = memberRef.collection('permissions').doc(pageId);
        
        transaction.set(permRef, {
          pageId: pageId,
          pageSlug: pageSlug,
          pageName: pageSlug.charAt(1).toUpperCase() + pageSlug.slice(2), // Simple naming
          
          canView: perms.canView ?? false,
          canCreate: perms.canCreate ?? false,
          canEdit: perms.canEdit ?? false,
          canDelete: perms.canDelete ?? false,
          
          updatedAt: now,
        });
      }
      
      // 7c. Increment MASTER's usage counter
      transaction.update(masterRef, {
        'usage.users': FieldValue.increment(1),
        updatedAt: now,
      });
      
      // 7d. Increment Company's usage counter
      const companyRef = db.collection('companies').doc(masterData.companyId);
      transaction.update(companyRef, {
        'usage.users': FieldValue.increment(1),
        updatedAt: now,
      });
    });
  } catch (err) {
    // Rollback: Delete the Firebase Auth user since Firestore failed
    console.error('Transaction failed, rolling back Auth user:', err);
    try {
      await auth.deleteUser(memberId);
    } catch (deleteErr) {
      console.error('Failed to rollback Auth user:', deleteErr);
    }
    
    const error = new Error('Erro ao salvar dados do usuário. Tente novamente.');
    (error as Error & { code?: string }).code = 'internal';
    throw error;
  }
  
  // ============================================
  // STEP 8: Return success
  // ============================================
  
  return {
    success: true,
    memberId: memberId,
    message: `Usuário ${input.name} criado com sucesso!`,
  };
}
