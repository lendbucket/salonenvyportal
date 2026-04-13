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

/** Validates StaffMember.licenseVerificationToken (SMS/email license flow). */
async function verifyLicenseToken(token: string | null): Promise<VerifyResult> {
  if (!token?.trim()) {
    return {
      status: 400,
      data: { valid: false, error: "Missing token" },
    };
  }

  const staff = await prisma.staffMember.findUnique({
    where: { licenseVerificationToken: token.trim() },
    include: { location: { select: { name: true } } },
  });

  if (!staff) {
    return {
      status: 404,
      data: { valid: false, error: "Invalid or unknown token" },
    };
  }

  if (
    staff.licenseVerificationTokenExpiry &&
    new Date() > staff.licenseVerificationTokenExpiry
  ) {
    return {
      status: 410,
      data: { valid: false, error: "This verification link has expired" },
    };
  }

  return {
    status: 200,
    data: {
      valid: true,
      staff: {
        id: staff.id,
        fullName: staff.fullName,
        locationName: staff.location.name,
      },
    },
  };
}

// GET: ?token= — public, for marketing site cross-origin checks
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const result = await verifyLicenseToken(token);
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

  const result = await verifyLicenseToken(token);
  return NextResponse.json(result.data, {
    status: result.status,
    headers: corsHeaders,
  });
}
