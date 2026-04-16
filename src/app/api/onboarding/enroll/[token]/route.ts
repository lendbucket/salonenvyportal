import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSquareTeamMember, assignTeamMemberToAllServices } from "@/lib/square-team";
import { getStylistAgreement, getManagerAgreement } from "@/lib/agreements";

// GET: Fetch enrollment by token (NO auth required - public)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const enrollment = await prisma.onboardingEnrollment.findUnique({
    where: { inviteToken: token },
    include: { location: true },
  });

  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  if (enrollment.expiresAt && new Date() > enrollment.expiresAt) {
    await prisma.onboardingEnrollment.update({
      where: { id: enrollment.id },
      data: { status: "expired" },
    });
    return NextResponse.json({ error: "This enrollment link has expired" }, { status: 410 });
  }

  if (enrollment.status === "completed") {
    return NextResponse.json({
      enrollment: {
        id: enrollment.id,
        status: enrollment.status,
        firstName: enrollment.firstName,
        lastName: enrollment.lastName,
        verificationCode: enrollment.verificationCode,
        locationName: enrollment.location.name,
      },
    });
  }

  // Return safe subset (no SSN, bank details etc.)
  return NextResponse.json({
    enrollment: {
      id: enrollment.id,
      inviteToken: enrollment.inviteToken,
      email: enrollment.email,
      firstName: enrollment.firstName,
      lastName: enrollment.lastName,
      role: enrollment.role,
      status: enrollment.status,
      locationName: enrollment.location.name,
      locationId: enrollment.locationId,
      phone: enrollment.phone,
      dateOfBirth: enrollment.dateOfBirth,
      address: enrollment.address,
      city: enrollment.city,
      state: enrollment.state,
      zip: enrollment.zip,
      licenseNumber: enrollment.licenseNumber,
      licenseState: enrollment.licenseState,
      licenseExpiration: enrollment.licenseExpiration,
      licenseType: enrollment.licenseType,
      emergencyName: enrollment.emergencyName,
      emergencyRelationship: enrollment.emergencyRelationship,
      emergencyPhone: enrollment.emergencyPhone,
      // W-9 partial (don't send SSN back)
      w9LegalName: enrollment.w9LegalName,
      w9BusinessName: enrollment.w9BusinessName,
      w9TaxClassification: enrollment.w9TaxClassification,
      w9Address: enrollment.w9Address,
      w9CertifiedAt: enrollment.w9CertifiedAt,
      // DD partial (don't send full account number back)
      ddBankName: enrollment.ddBankName,
      ddAccountType: enrollment.ddAccountType,
      ddNameOnAccount: enrollment.ddNameOnAccount,
      // Compliance
      ackPolicies: enrollment.ackPolicies,
      ackConfidentiality: enrollment.ackConfidentiality,
      ackAtWill: enrollment.ackAtWill,
      ackSafetyProtocol: enrollment.ackSafetyProtocol,
      ackTechPolicy: enrollment.ackTechPolicy,
      // Agreement
      agreementSignedAt: enrollment.agreementSignedAt,
    },
  });
}

// PATCH: Save step data (NO auth required - public)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  console.log("[onboarding-api] PATCH /api/onboarding/enroll/" + token + " — request received at", new Date().toISOString());
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "Unknown";
  const userAgent = req.headers.get("user-agent") || "Unknown";

  const enrollment = await prisma.onboardingEnrollment.findUnique({
    where: { inviteToken: token },
  });

  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  if (enrollment.status === "completed") {
    return NextResponse.json({ error: "Enrollment already completed" }, { status: 400 });
  }

  if (enrollment.expiresAt && new Date() > enrollment.expiresAt) {
    return NextResponse.json({ error: "This enrollment link has expired" }, { status: 410 });
  }

  try {
    const body = await req.json();
    const { step, data } = body as { step: string; data: Record<string, unknown> };
    console.log("[onboarding-api] Step:", step, "| Token:", token, "| Data keys:", Object.keys(data || {}));

    // Build update object based on step
    const updateData: Record<string, unknown> = { status: "in_progress" };

    switch (step) {
      case "personal":
        updateData.phone = data.phone;
        updateData.dateOfBirth = data.dateOfBirth;
        updateData.address = data.address;
        updateData.city = data.city;
        updateData.state = data.state;
        updateData.zip = data.zip;
        break;

      case "license":
        updateData.licenseNumber = data.licenseNumber;
        updateData.licenseState = data.licenseState;
        updateData.licenseExpiration = data.licenseExpiration;
        updateData.licenseType = data.licenseType;
        updateData.yearsOfExperience = data.yearsOfExperience ? Number(data.yearsOfExperience) : null;
        updateData.specialties = data.specialties || null;
        break;

      case "w9":
        updateData.w9LegalName = data.w9LegalName;
        updateData.w9BusinessName = data.w9BusinessName;
        updateData.w9TaxClassification = data.w9TaxClassification;
        updateData.w9Ssn = data.w9Ssn;
        updateData.w9Ein = data.w9Ein;
        updateData.w9Address = data.w9Address;
        updateData.w9CertifiedAt = new Date();
        break;

      case "direct_deposit":
        updateData.ddBankName = data.ddBankName;
        updateData.ddRoutingNumber = data.ddRoutingNumber;
        updateData.ddAccountNumber = data.ddAccountNumber;
        updateData.ddAccountType = data.ddAccountType;
        updateData.ddNameOnAccount = data.ddNameOnAccount;
        break;

      case "emergency":
        updateData.emergencyName = data.emergencyName;
        updateData.emergencyRelationship = data.emergencyRelationship;
        updateData.emergencyPhone = data.emergencyPhone;
        break;

      case "consents":
        updateData.ackBackgroundCheck = data.ackBackgroundCheck;
        updateData.ackDrugFree = data.ackDrugFree;
        updateData.ackSocialMedia = data.ackSocialMedia;
        updateData.ackSanitation = data.ackSanitation;
        updateData.ackEquipment = data.ackEquipment;
        updateData.mediaConsent = data.mediaConsent;
        updateData.ackDirectDeposit = data.ackDirectDeposit;
        break;

      case "agreement":
        updateData.signatureData = data.signatureData;
        updateData.signedLegalName = data.signedLegalName;
        updateData.signedSsnLast4 = data.signedSsnLast4;
        updateData.signedDate = data.signedDate;
        updateData.ackPolicies = data.ackPolicies;
        updateData.ackConfidentiality = data.ackConfidentiality;
        updateData.ackAtWill = data.ackAtWill;
        updateData.ackSafetyProtocol = data.ackSafetyProtocol;
        updateData.ackTechPolicy = data.ackTechPolicy;
        updateData.agreementSignedAt = new Date();
        break;

      case "complete": {
        // Generate verification code
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        updateData.status = "completed";
        updateData.completedAt = new Date();
        updateData.verificationCode = code;

        console.log("[onboarding-complete] ========== ONBOARDING COMPLETION STARTED ==========");
        console.log("[onboarding-complete] Token:", token);
        console.log("[onboarding-complete] Enrollment ID:", enrollment.id);

        // Create user + staff member in prisma
        const fullEnrollment = await prisma.onboardingEnrollment.findUnique({
          where: { inviteToken: token },
          include: { location: true },
        });

        if (fullEnrollment) {
          const fullName = `${fullEnrollment.firstName} ${fullEnrollment.lastName}`;
          const position = fullEnrollment.role === "MANAGER" ? "manager" : "stylist";
          const locationName = fullEnrollment.location.name;
          const squareLocationId = fullEnrollment.location.squareLocationId;

          console.log("[onboarding-complete] Enrollee:", fullName);
          console.log("[onboarding-complete] Email:", fullEnrollment.email);
          console.log("[onboarding-complete] Phone:", fullEnrollment.phone);
          console.log("[onboarding-complete] Role:", fullEnrollment.role);
          console.log("[onboarding-complete] Location:", locationName, "| Square ID:", squareLocationId);

          // Upsert user
          const user = await prisma.user.upsert({
            where: { email: fullEnrollment.email },
            update: {
              name: fullName,
              role: fullEnrollment.role,
              locationId: fullEnrollment.locationId,
              inviteStatus: "ACCEPTED",
            },
            create: {
              email: fullEnrollment.email,
              name: fullName,
              role: fullEnrollment.role,
              locationId: fullEnrollment.locationId,
              inviteStatus: "ACCEPTED",
            },
          });
          console.log("[onboarding-complete] User upserted:", user.id);

          // 1. Create Square Team Member
          let squareTeamMemberId: string | null = null;
          let squareCreationError: string | null = null;
          try {
            console.log("[onboarding-complete] Starting Square team member creation...");
            console.log("[onboarding-complete] Square data:", JSON.stringify({
              firstName: fullEnrollment.firstName,
              lastName: fullEnrollment.lastName,
              email: fullEnrollment.email,
              phone: fullEnrollment.phone || undefined,
              locationId: squareLocationId,
              role: fullEnrollment.role === "MANAGER" ? "MANAGER" : "STYLIST",
            }));

            const squareResult = await createSquareTeamMember({
              firstName: fullEnrollment.firstName,
              lastName: fullEnrollment.lastName,
              email: fullEnrollment.email,
              phone: fullEnrollment.phone || undefined,
              locationId: squareLocationId,
              role: fullEnrollment.role === "MANAGER" ? "MANAGER" : "STYLIST",
            });

            console.log("[onboarding-complete] Square result:", JSON.stringify(squareResult));

            if (squareResult.success && squareResult.teamMemberId) {
              squareTeamMemberId = squareResult.teamMemberId;
              console.log("[onboarding-complete] Square team member ID:", squareTeamMemberId);

              // 2. Assign to all services / confirm booking profile
              console.log("[onboarding-complete] Assigning to services...");
              const assignResult = await assignTeamMemberToAllServices(squareTeamMemberId, squareLocationId);
              console.log("[onboarding-complete] Service assignment result:", JSON.stringify(assignResult));
            } else {
              squareCreationError = squareResult.error || "Unknown failure";
              console.error("[onboarding-complete] Square creation FAILED:", squareCreationError);
            }
          } catch (sqErr: unknown) {
            squareCreationError = (sqErr as Error).message || "Exception during Square creation";
            console.error("[onboarding-complete] Square creation EXCEPTION:", squareCreationError);
            console.error("[onboarding-complete] Stack:", (sqErr as Error).stack);
          }

          // Upsert staff member with Square ID
          const existingStaff = await prisma.staffMember.findUnique({
            where: { userId: user.id },
          });

          const staffData = {
            fullName,
            email: fullEnrollment.email,
            phone: fullEnrollment.phone || null,
            position,
            locationId: fullEnrollment.locationId,
            inviteStatus: "accepted",
            tdlrLicenseNumber: fullEnrollment.licenseNumber || null,
            isActive: true,
            onboardingCompleted: true,
            onboardingCompletedAt: new Date(),
            ...(squareTeamMemberId ? { squareTeamMemberId } : {}),
          };

          if (existingStaff) {
            await prisma.staffMember.update({
              where: { id: existingStaff.id },
              data: staffData,
            });
            console.log("[onboarding-complete] Staff member updated:", existingStaff.id, "| Square ID:", squareTeamMemberId);
          } else {
            const newStaff = await prisma.staffMember.create({
              data: {
                userId: user.id,
                ...staffData,
              },
            });
            console.log("[onboarding-complete] Staff member created:", newStaff.id, "| Square ID:", squareTeamMemberId);
          }

          // Save Square team member ID on enrollment too
          if (squareTeamMemberId) {
            updateData.squareTeamMemberId = squareTeamMemberId;
          }
          // Save error on enrollment if creation failed
          if (squareCreationError) {
            updateData.squareCreationError = squareCreationError;
          }

          // Generate role-based agreement text
          const agreementText = fullEnrollment.role === "MANAGER"
            ? getManagerAgreement({
                name: fullEnrollment.signedLegalName || fullName,
                location: locationName,
                startDate: fullEnrollment.signedDate || new Date().toLocaleDateString(),
                commissionRate: 40,
                managementFee: 200,
              })
            : getStylistAgreement({
                name: fullEnrollment.signedLegalName || fullName,
                location: locationName,
                startDate: fullEnrollment.signedDate || new Date().toLocaleDateString(),
                commissionRate: 40,
              });

          // 4. Email signed agreement to owner — professional white-background HTML
          const ssnMasked = fullEnrollment.w9Ssn ? `***-**-${fullEnrollment.w9Ssn.replace(/-/g, "").slice(-4)}` : "N/A";
          const signedAt = new Date().toISOString();
          const uaTruncated = userAgent.length > 100 ? userAgent.slice(0, 100) + "..." : userAgent;

          try {
            const { Resend } = await import("resend");
            const resend = new Resend(process.env.RESEND_API_KEY);

            const field = (label: string, value: string) => `<tr><td style="color:#666;font-size:13px;font-weight:bold;padding:6px 0;border-bottom:1px solid #eee;">${label}</td><td style="color:#000;font-size:13px;padding:6px 0;text-align:right;border-bottom:1px solid #eee;">${value}</td></tr>`;

            const ownerHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;background:#ffffff;color:#000;margin:0;padding:0;">
<div style="max-width:700px;margin:0 auto;padding:40px 20px;">
<div style="text-align:center;margin-bottom:30px;">
<img src="https://portal.salonenvyusa.com/images/logo-white.png" alt="Salon Envy" style="max-width:200px;background:#0f1d24;padding:12px 20px;border-radius:8px;" onerror="this.style.display='none'" />
<h1 style="color:#000;font-size:28px;margin:16px 0 0;letter-spacing:2px;">SALON ENVY</h1>
</div>

<h1 style="color:#000;font-size:24px;border-bottom:2px solid #C9A84C;padding-bottom:10px;">New Contractor Onboarding Complete</h1>
<p><span style="display:inline-block;background:#C9A84C;color:#fff;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:bold;">${fullEnrollment.role}</span> &nbsp; ${locationName} &nbsp; ${new Date().toLocaleDateString()}</p>

<div style="background:#f9f9f9;border:1px solid #e0e0e0;border-radius:8px;padding:20px;margin-bottom:20px;">
<h2 style="color:#333;font-size:16px;margin:0 0 12px;">PERSONAL INFORMATION</h2>
<table style="width:100%;border-collapse:collapse;">
${field("Full Legal Name", fullName)}
${field("Date of Birth", fullEnrollment.dateOfBirth || "N/A")}
${field("SSN", ssnMasked)}
${field("Email", fullEnrollment.email)}
${field("Phone", fullEnrollment.phone || "N/A")}
${field("Address", `${fullEnrollment.address || ""}, ${fullEnrollment.city || ""}, ${fullEnrollment.state || ""} ${fullEnrollment.zip || ""}`)}
${field("Emergency Contact", `${fullEnrollment.emergencyName || "N/A"} — ${fullEnrollment.emergencyPhone || "N/A"}`)}
</table></div>

<div style="background:#f9f9f9;border:1px solid #e0e0e0;border-radius:8px;padding:20px;margin-bottom:20px;">
<h2 style="color:#333;font-size:16px;margin:0 0 12px;">PROFESSIONAL INFORMATION</h2>
<table style="width:100%;border-collapse:collapse;">
${field("TDLR License #", fullEnrollment.licenseNumber || "N/A")}
${field("License Expiration", fullEnrollment.licenseExpiration || "N/A")}
${field("Years of Experience", fullEnrollment.yearsOfExperience?.toString() || "N/A")}
${field("Specialties", fullEnrollment.specialties || "N/A")}
</table></div>

<div style="background:#f9f9f9;border:1px solid #e0e0e0;border-radius:8px;padding:20px;margin-bottom:20px;">
<h2 style="color:#333;font-size:16px;margin:0 0 8px;">DIRECT DEPOSIT / BANKING INFORMATION</h2>
<p style="color:red;font-size:11px;margin:0 0 12px;">SENSITIVE — Handle with care. Store securely.</p>
<table style="width:100%;border-collapse:collapse;">
${field("Bank Name", fullEnrollment.ddBankName || "N/A")}
${field("Account Holder", fullEnrollment.ddNameOnAccount || "N/A")}
${field("Account Type", fullEnrollment.ddAccountType ? fullEnrollment.ddAccountType.charAt(0).toUpperCase() + fullEnrollment.ddAccountType.slice(1) : "N/A")}
${field("Routing Number", fullEnrollment.ddRoutingNumber || "N/A")}
${field("Account Number", fullEnrollment.ddAccountNumber || "N/A")}
</table></div>

<div style="background:#f9f9f9;border:1px solid #e0e0e0;border-radius:8px;padding:20px;margin-bottom:20px;">
<h2 style="color:#333;font-size:16px;margin:0 0 12px;">W-9 INFORMATION</h2>
<table style="width:100%;border-collapse:collapse;">
${field("Legal Name", fullEnrollment.w9LegalName || "N/A")}
${field("Business Name", fullEnrollment.w9BusinessName || "N/A")}
${field("Tax Classification", fullEnrollment.w9TaxClassification || "N/A")}
${field("SSN / EIN", ssnMasked)}
${field("Address", fullEnrollment.w9Address || "N/A")}
</table></div>

<div style="background:#f9f9f9;border:1px solid #e0e0e0;border-radius:8px;padding:20px;margin-bottom:20px;">
<h2 style="color:#333;font-size:16px;margin:0 0 12px;">VERIFICATION STATUS</h2>
<table style="width:100%;border-collapse:collapse;">
${field("Email Verified", fullEnrollment.emailVerified ? "Yes" : "No")}
${field("Phone Verified", fullEnrollment.phoneVerified ? "Yes" : "No")}
${field("Agreement Signed", `Yes — ${signedAt}`)}
${field("Verification Code", code)}
${squareTeamMemberId ? field("Square Team ID", squareTeamMemberId) : ""}
${field("IP Address", clientIp)}
${field("Device/Browser", uaTruncated)}
</table></div>

<div style="background:#f9f9f9;border:1px solid #e0e0e0;border-radius:8px;padding:20px;margin-bottom:20px;">
<h2 style="color:#333;font-size:16px;margin:0 0 12px;">SIGNED AGREEMENT</h2>
<div style="background:#fff;border:1px solid #ccc;padding:20px;font-size:11px;line-height:1.6;white-space:pre-wrap;font-family:'Courier New',monospace;">${agreementText}</div>
<div style="background:#f0f0f0;border:2px solid #C9A84C;padding:16px;margin-top:20px;border-radius:8px;">
<strong>DIGITAL SIGNATURE</strong><br/>
Signed by: ${fullEnrollment.signedLegalName || fullName}<br/>
Date/Time: ${signedAt}<br/>
IP Address: ${clientIp}<br/>
This electronic signature is legally binding under Section 18.8 of the Agreement.
</div></div>

<div style="text-align:center;color:#999;font-size:11px;margin-top:40px;">
Salon Envy USA LLC &bull; Corpus Christi, TX &bull; ceo@36west.org<br/>
This email was automatically generated by the Salon Envy Management Portal<br/>
Generated: ${signedAt}
</div></div></body></html>`;

            await resend.emails.send({
              from: "waivers@salonenvyusa.com",
              to: "ceo@36west.org",
              subject: `New Contractor Onboarding Complete — ${fullName} — ${fullEnrollment.role} — ${locationName} — ${new Date().toLocaleDateString()}`,
              html: ownerHtml,
              text: `New Contractor Onboarding Complete\n\nName: ${fullName}\nRole: ${fullEnrollment.role}\nLocation: ${locationName}\nEmail: ${fullEnrollment.email}\nPhone: ${fullEnrollment.phone || "N/A"}\nLicense: ${fullEnrollment.licenseNumber || "N/A"}\nVerification Code: ${code}\nBank: ${fullEnrollment.ddBankName || "N/A"}\nRouting: ${fullEnrollment.ddRoutingNumber || "N/A"}\nAccount: ${fullEnrollment.ddAccountNumber || "N/A"}\n\nFull agreement and details are in the HTML version of this email.`,
            });

            // 5. Email welcome to new team member
            await resend.emails.send({
              from: "waivers@salonenvyusa.com",
              to: fullEnrollment.email,
              subject: `Welcome to Salon Envy ${locationName}!`,
              html: `
                <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; background: #0f1d24; color: #ffffff; padding: 40px; border-radius: 12px;">
                  <div style="text-align: center; margin-bottom: 32px;">
                    <img src="https://portal.salonenvyusa.com/images/logo-white.png" alt="Salon Envy" width="160" style="display:block;height:auto;margin:0 auto;" />
                  </div>
                  <h2 style="font-size: 20px; font-weight: 800; color: #ffffff; margin: 0 0 8px;">Welcome to the Salon Envy Team!</h2>
                  <p style="color: #94A3B8; margin: 0 0 16px; font-size: 14px; line-height: 1.6;">
                    Hi ${fullEnrollment.firstName},
                  </p>
                  <p style="color: #94A3B8; margin: 0 0 20px; font-size: 14px; line-height: 1.6;">
                    Your onboarding is complete. Here's what happens next:
                  </p>
                  <ul style="color: #94A3B8; font-size: 14px; line-height: 2; padding-left: 20px;">
                    <li>Your Square profile has been set up — you can now be booked for appointments</li>
                    <li>Your contractor agreement has been received</li>
                    <li>You'll receive your first payment on the Tuesday after your first full Wed-Tue pay period</li>
                  </ul>
                  <p style="color: #94A3B8; margin: 20px 0 0; font-size: 14px;">Your portal login: <strong style="color: #CDC9C0;">portal.salonenvyusa.com</strong></p>
                  <p style="color: #94A3B8; margin: 16px 0 0; font-size: 14px;">Welcome aboard!</p>
                  <p style="color: #CDC9C0; margin: 8px 0 0; font-size: 14px; font-weight: 600;">Robert Reyna<br/><span style="color: #94A3B8; font-weight: 400;">Owner, Salon Envy USA</span></p>
                </div>
              `,
            });
          } catch (emailErr) {
            console.error("Failed to send onboarding emails:", emailErr);
          }

          // Mask sensitive data in DB after emailing
          try {
            const ssnLast4 = fullEnrollment.w9Ssn ? fullEnrollment.w9Ssn.slice(-4) : null;
            const acctLast4 = fullEnrollment.ddAccountNumber ? fullEnrollment.ddAccountNumber.slice(-4) : null;
            await prisma.onboardingEnrollment.update({
              where: { id: enrollment.id },
              data: {
                w9Ssn: ssnLast4 ? `***-**-${ssnLast4}` : null,
                ddAccountNumber: acctLast4 ? `****${acctLast4}` : null,
                ddRoutingNumber: fullEnrollment.ddRoutingNumber ? `*****${fullEnrollment.ddRoutingNumber.slice(-4)}` : null,
              },
            });
          } catch (maskErr) {
            console.error("Failed to mask sensitive data:", maskErr);
          }
        }

        break;
      }

      default:
        return NextResponse.json({ error: "Invalid step" }, { status: 400 });
    }

    const updated = await prisma.onboardingEnrollment.update({
      where: { id: enrollment.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      status: updated.status,
      verificationCode: updated.verificationCode,
    });
  } catch (error: unknown) {
    console.error("Enrollment update error:", error);
    return NextResponse.json({ error: "Failed to update enrollment" }, { status: 500 });
  }
}
