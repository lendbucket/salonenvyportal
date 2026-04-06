import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const courses = [
    { title: "Texas Cosmetology Laws & Rules 2025", description: "Complete overview of TDLR regulations, Texas Occupations Code, and the rules governing cosmetology practice in Texas. Required for license renewal.", category: "tdlr_ce", instructor: "TDLR Approved Instructor", durationMinutes: 120, level: "beginner", isTdlrApproved: true, tdlrHours: 2, isFeatured: true },
    { title: "HIV/AIDS & Communicable Disease Prevention", description: "TDLR-required training on HIV/AIDS awareness, bloodborne pathogens, and communicable disease prevention in the salon environment.", category: "tdlr_ce", instructor: "TDLR Approved Instructor", durationMinutes: 60, level: "beginner", isTdlrApproved: true, tdlrHours: 1, isFeatured: false },
    { title: "Sanitation & Disinfection Protocols", description: "Proper disinfection procedures for salon tools, implements, and surfaces. Texas sanitation requirements and EPA-registered disinfectant guidelines.", category: "tdlr_ce", instructor: "TDLR Approved Instructor", durationMinutes: 60, level: "beginner", isTdlrApproved: true, tdlrHours: 1, isFeatured: false },
    { title: "Chemical Safety & OSHA Compliance", description: "Safe handling of chemical salon products, MSDS sheets, ventilation requirements, and OSHA compliance for cosmetology professionals.", category: "tdlr_ce", instructor: "TDLR Approved Instructor", durationMinutes: 60, level: "beginner", isTdlrApproved: true, tdlrHours: 1, isFeatured: false },
    { title: "Professional Ethics in Cosmetology", description: "Client relationships, professional boundaries, honest pricing, and ethical business practices for Texas cosmetology professionals.", category: "tdlr_ce", instructor: "TDLR Approved Instructor", durationMinutes: 60, level: "beginner", isTdlrApproved: true, tdlrHours: 1, isFeatured: false },
    { title: "Preventing Workplace Accidents", description: "Ergonomics, repetitive stress injury prevention, slip and fall prevention, and workplace safety for salon professionals.", category: "tdlr_ce", instructor: "TDLR Approved Instructor", durationMinutes: 60, level: "beginner", isTdlrApproved: true, tdlrHours: 1, isFeatured: false },
    { title: "Consumer Protection Laws", description: "Texas consumer protection regulations, client rights, refund policies, and complaint procedures in the cosmetology industry.", category: "tdlr_ce", instructor: "TDLR Approved Instructor", durationMinutes: 60, level: "beginner", isTdlrApproved: true, tdlrHours: 1, isFeatured: false },
    { title: "Balayage Fundamentals", description: "Master the art of balayage from sectioning to toning. Includes freehand painting, foilayage, and achieving dimensional blondes.", category: "color", instructor: "Salon Envy Education", durationMinutes: 90, level: "intermediate", isTdlrApproved: false, tdlrHours: 0, isFeatured: true },
    { title: "Color Correction Masterclass", description: "Advanced color correction techniques — removing box dye, lifting dark color, correcting banding, and achieving even results.", category: "color", instructor: "Salon Envy Education", durationMinutes: 120, level: "advanced", isTdlrApproved: false, tdlrHours: 0, isFeatured: true },
    { title: "Redken Shades EQ Formulation", description: "Complete guide to formulating with Shades EQ — toning, glossing, refreshing color, and achieving consistent results.", category: "color", instructor: "Salon Envy Education", durationMinutes: 60, level: "intermediate", isTdlrApproved: false, tdlrHours: 0, isFeatured: false },
    { title: "Toning & Glazing Techniques", description: "Perfect every blonde with professional toning and glazing. Purple, blue, and neutral toners, timing, and maintenance recommendations.", category: "color", instructor: "Salon Envy Education", durationMinutes: 45, level: "beginner", isTdlrApproved: false, tdlrHours: 0, isFeatured: false },
    { title: "Precision Haircuts: Bob & Lob", description: "Step-by-step precision cutting for bobs, lobs, and blunt cuts. Sectioning, elevation, and finishing for a clean result every time.", category: "cutting", instructor: "Salon Envy Education", durationMinutes: 75, level: "intermediate", isTdlrApproved: false, tdlrHours: 0, isFeatured: false },
    { title: "Textured Hair Techniques", description: "Cutting, styling, and treating naturally curly and coily hair. Curl typing, moisture balance, and diffusing techniques.", category: "cutting", instructor: "Salon Envy Education", durationMinutes: 90, level: "intermediate", isTdlrApproved: false, tdlrHours: 0, isFeatured: true },
    { title: "Blowout & Styling Mastery", description: "Perfect blowouts from start to finish. Round brush technique, tension, heat management, and long-lasting style results.", category: "cutting", instructor: "Salon Envy Education", durationMinutes: 45, level: "beginner", isTdlrApproved: false, tdlrHours: 0, isFeatured: false },
    { title: "Keratin Treatment Application", description: "Professional keratin treatment application — preparation, processing, and aftercare. Formaldehyde-free options and safety protocols.", category: "texture", instructor: "Salon Envy Education", durationMinutes: 60, level: "intermediate", isTdlrApproved: false, tdlrHours: 0, isFeatured: false },
    { title: "Brazilian Blowout Protocols", description: "Brazilian Blowout application, safety precautions, ventilation requirements, and client consultation for texture smoothing services.", category: "texture", instructor: "Salon Envy Education", durationMinutes: 60, level: "intermediate", isTdlrApproved: false, tdlrHours: 0, isFeatured: false },
    { title: "Building Your Clientele", description: "Proven strategies to grow your book from zero. Client retention, referral programs, rebooking rates, and moving clients when you change salons.", category: "business", instructor: "Salon Envy Education", durationMinutes: 45, level: "beginner", isTdlrApproved: false, tdlrHours: 0, isFeatured: true },
    { title: "Social Media for Stylists", description: "Instagram strategy, before/after photos, Reels, hashtags, and converting followers into paying clients.", category: "business", instructor: "Salon Envy Education", durationMinutes: 45, level: "beginner", isTdlrApproved: false, tdlrHours: 0, isFeatured: false },
    { title: "Pricing Your Services for Profit", description: "How to calculate your true hourly rate, when and how to raise prices, how to communicate price increases to clients without losing them.", category: "business", instructor: "Salon Envy Education", durationMinutes: 30, level: "beginner", isTdlrApproved: false, tdlrHours: 0, isFeatured: true },
    { title: "Going from Booth Renter to Suite Owner", description: "Step-by-step guide to transitioning from commission stylist or booth renter to independent suite owner. Finances, licensing, and setup.", category: "business", instructor: "Salon Envy Education", durationMinutes: 60, level: "intermediate", isTdlrApproved: false, tdlrHours: 0, isFeatured: false },
  ]

  for (const course of courses) {
    const id = course.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 25)
    await prisma.eduCourse.upsert({
      where: { id },
      update: course,
      create: { id, ...course },
    })
  }
  console.log("Seeded", courses.length, "courses")
}

main().catch(console.error).finally(() => prisma.$disconnect())
