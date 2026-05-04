import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/profile?mp_error=${encodeURIComponent(error)}`, request.url),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/profile?mp_error=invalid_callback", request.url));
  }

  return NextResponse.redirect(
    new URL(
      `/profile?mp_code=${encodeURIComponent(code)}&mp_state=${encodeURIComponent(state)}`,
      request.url,
    ),
  );
}
