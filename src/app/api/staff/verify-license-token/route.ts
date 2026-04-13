import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://www.salonenvyusa.com",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "https://www.salonenvyusa.com",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

type VerifyResult =
  | { status: 200; data: Record<string, unknown> }
  | { status: number; data: Record<string, unknown> };

async function verifyInviteToken(token: string | null): Promise<VerifyResult> {
  if (!token?.trim()) {
    return {
      status: 400,
      data: { valid: false, error: "Missing token" },
    };
  }

  const enrollment = await prisma.onboardingEnrollment.findUnique({
    where: { inviteToken: token.trim() },
    include: { location: { select: { name: true } } },
  });

  if (!enrollment) {
    return {
      status: 404,
      data: { valid: false, error: "Enrollment not found" },
    };
  }

  if (enrollment.expiresAt && new Date() > enrollment.expiresAt) {
    await prisma.onboardingEnrollment.update({
      where: { id: enrollment.id },
      data: { status: "expired" },
    });
    return {
      status: 410,
      data: { valid: false, error: "This enrollment link has expired" },
    };
  }

  return {
    status: 200,
    data: {
      valid: true,
      enrollment: {
        id: enrollment.id,
        status: enrollment.status,
        firstName: enrollment.firstName,
        lastName: enrollment.lastName,
        locationName: enrollment.location.name,
      },
    },
  };
}

// GET: ?token= — public, for marketing site cross-origin checks
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const result = await verifyInviteToken(token);
  return NextResponse.json(result.data, {
    status: result.status,
    headers: corsHeaders,
  });
}

// POST: { token } — same as GET
export async function POST(req: NextRequest) {
  let token: string | null = null;
  try {
    const body = (await req.json()) as { token?: unknown };
    token = typeof body?.token === "string" ? body.token : null;
  } catch {
    return NextResponse.json(
      { valid: false, error: "Invalid JSON body" },
      { status: 400, headers: corsHeaders },
    );
  }

  const result = await verifyInviteToken(token);
  return NextResponse.json(result.data, {
    status: result.status,
    headers: corsHeaders,
  });
}
