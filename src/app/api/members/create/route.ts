/**
 * API Route: Create Member User
 * 
 * POST /api/members/create
 * 
 * Creates a new MEMBER user linked to the authenticated MASTER.
 * Requires Firebase Auth token in Authorization header.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { createMemberUser, CreateMemberInput } from "@/lib/create-member";

export async function POST(request: NextRequest) {
  try {
    // ============================================
    // STEP 1: Validate Authorization Header
    // ============================================
    
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Token de autenticação não fornecido" },
        { status: 401 }
      );
    }
    
    const token = authHeader.split("Bearer ")[1];
    
    // ============================================
    // STEP 2: Verify Firebase Token
    // ============================================
    
    let decodedToken;
    try {
      const auth = getAdminAuth();
      decodedToken = await auth.verifyIdToken(token);
    } catch {
      return NextResponse.json(
        { error: "Token inválido ou expirado" },
        { status: 401 }
      );
    }
    
    const masterId = decodedToken.uid;
    
    // ============================================
    // STEP 3: Parse Request Body
    // ============================================
    
    let body: CreateMemberInput;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Corpo da requisição inválido" },
        { status: 400 }
      );
    }
    
    // ============================================
    // STEP 4: Call Create Member Function
    // ============================================
    
    const result = await createMemberUser(masterId, body);
    
    return NextResponse.json(result, { status: 201 });
    
  } catch (error) {
    console.error("Error creating member:", error);
    
    // Map error codes to HTTP status codes
    const err = error as Error & { code?: string };
    const statusMap: Record<string, number> = {
      'permission-denied': 403,
      'failed-precondition': 400,
      'invalid-argument': 400,
      'already-exists': 409,
      'not-found': 404,
      'internal': 500,
    };
    
    const status = statusMap[err.code || ''] || 500;
    
    return NextResponse.json(
      { 
        error: err.message || "Erro interno do servidor",
        code: err.code 
      },
      { status }
    );
  }
}
