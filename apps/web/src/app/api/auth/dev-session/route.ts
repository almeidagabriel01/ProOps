import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";

// Dev-only endpoint to set __session cookie from an idToken and redirect.
// MUST NOT be enabled in production.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const token = String(req.nextUrl.searchParams.get("token") || "").trim();
  const redirectTo = String(req.nextUrl.searchParams.get("redirect") || "/");

  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  try {
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token, true);
    console.log("dev-session: verified idToken for uid=", decoded.uid);

    const maxAgeSeconds = 60 * 60 * 24 * 5;
    const sessionCookie = await adminAuth.createSessionCookie(token, {
      expiresIn: maxAgeSeconds * 1000,
    });

    const redirectUrl = new URL(redirectTo, req.nextUrl.origin);
    const resp = NextResponse.redirect(redirectUrl);
    resp.cookies.set({
      name: "__session",
      value: sessionCookie,
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: maxAgeSeconds,
    });
    console.log("dev-session: set __session cookie, redirecting to", redirectUrl.href);
    return resp;
  } catch (err) {
    console.error("dev-session: failed to create session cookie", err);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}
