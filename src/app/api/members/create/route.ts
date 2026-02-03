/**
 * ⚠️ DEPRECATED API ROUTE - DO NOT USE
 *
 * This API Route has been DISABLED.
 *
 * REASON:
 * Next.js API Routes do NOT have Firebase Auth context (context.auth).
 * Even when passing a Bearer token, the API Route cannot access
 * Firebase custom claims or role verification reliably.
 *
 * CORRECT APPROACH:
 * Use Firebase Callable Cloud Functions which have built-in auth:
 *
 * ```typescript
 * import { getFunctions, httpsCallable } from 'firebase/functions';
 *
 * const functions = getFunctions();
 * const createMember = httpsCallable(functions, 'createMember');
 *
 * const result = await createMember({ name, email, permissions });
 * ```
 *
 * The Cloud Function 'createMember' is deployed in functions/src/createMember.ts
 * Deploy with: firebase deploy --only functions:createMember
 *
 * SEE: src/hooks/useCreateMember.ts for the correct implementation
 */

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "Esta API foi desativada. Use Firebase Callable Functions.",
      code: "deprecated",
      solution:
        "Atualize o frontend para usar httpsCallable(functions, 'createMember')",
    },
    { status: 410 }, // 410 Gone
  );
}

export async function GET() {
  return NextResponse.json(
    {
      error: "Esta API foi desativada. Use Firebase Callable Functions.",
      code: "deprecated",
    },
    { status: 410 },
  );
}
