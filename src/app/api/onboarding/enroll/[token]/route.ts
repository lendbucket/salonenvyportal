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

          // 1. Create Square Team Member
          let squareTeamMemberId: string | null = null;
          try {
            const squareResult = await createSquareTeamMember({
              firstName: fullEnrollment.firstName,
              lastName: fullEnrollment.lastName,
              email: fullEnrollment.email,
              phone: fullEnrollment.phone || undefined,
              locationId: squareLocationId,
              role: fullEnrollment.role === "MANAGER" ? "MANAGER" : "STYLIST",
            });
            if (squareResult.success) {
              squareTeamMemberId = squareResult.teamMemberId;
              console.log("[onboarding] Square team member created:", squareTeamMemberId);

              // 2. Assign to all services
              await assignTeamMemberToAllServices(squareTeamMemberId, squareLocationId);
            } else {
              console.error("[onboarding] Square team creation failed:", squareResult.error);
            }
          } catch (sqErr) {
            console.error("[onboarding] Square error:", sqErr);
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
          } else {
            await prisma.staffMember.create({
              data: {
                userId: user.id,
                ...staffData,
              },
            });
          }

          // Save Square team member ID on enrollment too
          if (squareTeamMemberId) {
            updateData.squareTeamMemberId = squareTeamMemberId;
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

          // 4. Email signed agreement to owner
          try {
            const { Resend } = await import("resend");
            const resend = new Resend(process.env.RESEND_API_KEY);

            await resend.emails.send({
              from: "waivers@salonenvyusa.com",
              to: "ceo@36west.org",
              subject: `Signed Agreement — ${fullName} — ${fullEnrollment.role} — ${locationName}`,
              html: `
                <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #0f1d24; color: #ffffff; padding: 40px; border-radius: 12px;">
                  <h2 style="color: #CDC9C0; margin: 0 0 16px;">New Signed Agreement</h2>
                  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                    <tr><td style="color: #94A3B8; font-size: 13px; padding: 6px 0;">Name</td><td style="color: #fff; font-size: 13px; padding: 6px 0; text-align: right;">${fullName}</td></tr>
                    <tr><td style="color: #94A3B8; font-size: 13px; padding: 6px 0;">Role</td><td style="color: #fff; font-size: 13px; padding: 6px 0; text-align: right;">${fullEnrollment.role}</td></tr>
                    <tr><td style="color: #94A3B8; font-size: 13px; padding: 6px 0;">Location</td><td style="color: #fff; font-size: 13px; padding: 6px 0; text-align: right;">${locationName}</td></tr>
                    <tr><td style="color: #94A3B8; font-size: 13px; padding: 6px 0;">Date</td><td style="color: #fff; font-size: 13px; padding: 6px 0; text-align: right;">${new Date().toLocaleDateString()}</td></tr>
                    <tr><td style="color: #94A3B8; font-size: 13px; padding: 6px 0;">Email</td><td style="color: #fff; font-size: 13px; padding: 6px 0; text-align: right;">${fullEnrollment.email}</td></tr>
                    <tr><td style="color: #94A3B8; font-size: 13px; padding: 6px 0;">Phone</td><td style="color: #fff; font-size: 13px; padding: 6px 0; text-align: right;">${fullEnrollment.phone || "N/A"}</td></tr>
                    <tr><td style="color: #94A3B8; font-size: 13px; padding: 6px 0;">License #</td><td style="color: #fff; font-size: 13px; padding: 6px 0; text-align: right;">${fullEnrollment.licenseNumber || "N/A"}</td></tr>
                    <tr><td style="color: #94A3B8; font-size: 13px; padding: 6px 0;">Verification Code</td><td style="color: #CDC9C0; font-size: 13px; font-weight: 700; padding: 6px 0; text-align: right;">${code}</td></tr>
                    ${squareTeamMemberId ? `<tr><td style="color: #94A3B8; font-size: 13px; padding: 6px 0;">Square Team ID</td><td style="color: #fff; font-size: 13px; padding: 6px 0; text-align: right;">${squareTeamMemberId}</td></tr>` : ""}
                  </table>

                  <div style="margin-top: 20px; padding: 16px; background: rgba(205,201,192,0.06); border: 1px solid rgba(205,201,192,0.12); border-radius: 8px;">
                    <h3 style="color: #CDC9C0; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 12px;">Direct Deposit Information</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr><td style="color: #94A3B8; font-size: 13px; padding: 4px 0;">Bank Name</td><td style="color: #fff; font-size: 13px; padding: 4px 0; text-align: right;">${fullEnrollment.ddBankName || "N/A"}</td></tr>
                      <tr><td style="color: #94A3B8; font-size: 13px; padding: 4px 0;">Account Holder</td><td style="color: #fff; font-size: 13px; padding: 4px 0; text-align: right;">${fullEnrollment.ddNameOnAccount || "N/A"}</td></tr>
                      <tr><td style="color: #94A3B8; font-size: 13px; padding: 4px 0;">Account Type</td><td style="color: #fff; font-size: 13px; padding: 4px 0; text-align: right;">${fullEnrollment.ddAccountType ? fullEnrollment.ddAccountType.charAt(0).toUpperCase() + fullEnrollment.ddAccountType.slice(1) : "N/A"}</td></tr>
                      <tr><td style="color: #94A3B8; font-size: 13px; padding: 4px 0;">Routing Number</td><td style="color: #fff; font-size: 13px; padding: 4px 0; text-align: right;">${fullEnrollment.ddRoutingNumber || "N/A"}</td></tr>
                      <tr><td style="color: #94A3B8; font-size: 13px; padding: 4px 0;">Account Number</td><td style="color: #fff; font-size: 13px; padding: 4px 0; text-align: right;">${fullEnrollment.ddAccountNumber || "N/A"}</td></tr>
                    </table>
                  </div>

                  <div style="margin-top: 20px; padding: 16px; background: rgba(205,201,192,0.06); border: 1px solid rgba(205,201,192,0.12); border-radius: 8px;">
                    <h3 style="color: #CDC9C0; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 12px;">W-9 / Tax Info</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr><td style="color: #94A3B8; font-size: 13px; padding: 4px 0;">Legal Name</td><td style="color: #fff; font-size: 13px; padding: 4px 0; text-align: right;">${fullEnrollment.w9LegalName || "N/A"}</td></tr>
                      <tr><td style="color: #94A3B8; font-size: 13px; padding: 4px 0;">SSN</td><td style="color: #fff; font-size: 13px; padding: 4px 0; text-align: right;">${fullEnrollment.w9Ssn || "N/A"}</td></tr>
                      <tr><td style="color: #94A3B8; font-size: 13px; padding: 4px 0;">EIN</td><td style="color: #fff; font-size: 13px; padding: 4px 0; text-align: right;">${fullEnrollment.w9Ein || "N/A"}</td></tr>
                      <tr><td style="color: #94A3B8; font-size: 13px; padding: 4px 0;">Tax Classification</td><td style="color: #fff; font-size: 13px; padding: 4px 0; text-align: right;">${fullEnrollment.w9TaxClassification || "N/A"}</td></tr>
                      <tr><td style="color: #94A3B8; font-size: 13px; padding: 4px 0;">Tax Address</td><td style="color: #fff; font-size: 13px; padding: 4px 0; text-align: right;">${fullEnrollment.w9Address || "N/A"}</td></tr>
                    </table>
                  </div>

                  <div style="margin-top: 20px; padding: 16px; background: rgba(205,201,192,0.06); border: 1px solid rgba(205,201,192,0.12); border-radius: 8px;">
                    <h3 style="color: #CDC9C0; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 12px;">Signed Agreement</h3>
                    <pre style="font-family: monospace; font-size: 11px; white-space: pre-wrap; color: #94A3B8; margin: 0;">${agreementText}</pre>
                  </div>

                  <div style="margin-top: 16px; padding: 12px 16px; background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.2); border-radius: 8px;">
                    <p style="color: #22c55e; font-size: 13px; margin: 0 0 4px; font-weight: 700;">Digital Signature</p>
                    <p style="color: #94A3B8; font-size: 12px; margin: 0;">Signed by: ${fullEnrollment.signedLegalName || fullName}</p>
                    <p style="color: #94A3B8; font-size: 12px; margin: 2px 0 0;">Signed at: ${new Date().toISOString()}</p>
                    <p style="color: #94A3B8; font-size: 12px; margin: 2px 0 0;">SSN Last 4: ${fullEnrollment.signedSsnLast4 || "N/A"}</p>
                  </div>
                </div>
              `,
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
