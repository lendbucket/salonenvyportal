import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { verifyTDLRLicense } from "@/lib/tdlr";

export const maxDuration = 60;

// Public TDLR license lookup (GET) — no auth needed
export async function GET(req: NextRequest) {
  const license = req.nextUrl.searchParams.get("license");
  if (!license) {
    return NextResponse.json(
      { error: "Missing license parameter" },
      { status: 400 },
    );
  }

  try {
    const result = await verifyTDLRLicense(license);

    if (!result.valid && result.error) {
      return NextResponse.json({ found: false, error: result.error });
    }

    const statusColor = result.status === "ACTIVE" ? "green" : result.status === "EXPIRED" ? "red" : "yellow";

    return NextResponse.json({
      found: true,
      licenseNumber: result.licenseNumber || license,
      holderName: result.holderName || "",
      licenseType: result.licenseType || "",
      status: result.status || "",
      isActive: result.valid,
      expirationDate: result.expirationDate || null,
      statusColor,
      county: result.county || "",
      originalIssueDate: result.originalIssueDate || "",
      source: result.source || "",
    });
  } catch {
    return NextResponse.json(
      { found: false, error: "Failed to query TDLR" },
      { status: 500 },
    );
  }
}

// Auth-protected TDLR update (POST)
export async function POST(req: NextRequest) {
  const { session, response } = await requireSession();
  if (response) return response;

  try {
    const body = await req.json();
    const { staffMemberId, licenseNumber, licenseStatus, expirationDate } =
      body as {
        staffMemberId: string;
        licenseNumber: string;
        licenseStatus: string;
        expirationDate?: string;
      };

    if (!staffMemberId || !licenseNumber) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Verify TDLR to get holder name
    let holderName = "";
    try {
      const url = `https://data.texas.gov/resource/7358-krk7.json?license_number=${encodeURIComponent(licenseNumber)}`;
      const tdlrRes = await fetch(url);
      if (tdlrRes.ok) {
        const data = (await tdlrRes.json()) as Array<Record<string, string>>;
        if (data.length > 0) {
          holderName =
            data[0].name ||
            data[0].license_holder_name ||
            data[0].full_name ||
            "";
        }
      }
    } catch {
      // non-critical, continue
    }

    const updated = await prisma.staffMember.update({
      where: { id: staffMemberId },
      data: {
        tdlrLicenseNumber: licenseNumber,
        tdlrStatus: licenseStatus,
        tdlrExpirationDate: expirationDate
          ? new Date(expirationDate)
          : null,
        tdlrVerifiedAt: new Date(),
        tdlrHolderName: holderName || null,
      },
    });

    void session; // used for auth gate

    return NextResponse.json({ success: true, staffMember: updated });
  } catch (err) {
    console.error("TDLR POST error:", err);
    return NextResponse.json(
      { error: "Failed to update TDLR status" },
      { status: 500 },
    );
  }
}
