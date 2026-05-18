import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clearSession } from "@/lib/session";

export const dynamic = "force-dynamic";

async function handle(request: NextRequest) {
  await clearSession();
  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl, { status: 303 });
}

export const GET = handle;
export const POST = handle;
