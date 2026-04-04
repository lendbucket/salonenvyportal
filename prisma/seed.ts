// @ts-nocheck

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Missing DIRECT_URL or DATABASE_URL");
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const cc = await prisma.location.upsert({
    where: { squareLocationId: "LTJSA6QR1HGW6" },
    update: {},
    create: {
      name: "Corpus Christi",
      squareLocationId: "LTJSA6QR1HGW6",
      address: "5601 S Padre Island Dr STE E, TX 78412",
      phone: "(361) 889-1102",
    },
  });

  const sa = await prisma.location.upsert({
    where: { squareLocationId: "LXJYXDXWR0XZF" },
    update: {},
    create: {
      name: "San Antonio",
      squareLocationId: "LXJYXDXWR0XZF",
      address: "11826 Wurzbach Rd, TX 78230",
      phone: "(210) 660-3339",
    },
  });

  const passwordHash = await bcrypt.hash("ChangeMe123!", 12);
  await prisma.user.upsert({
    where: { email: "ceo@36west.org" },
    update: {},
    create: {
      email: "ceo@36west.org",
      name: "Robert Reyna",
      role: "OWNER",
      passwordHash,
      locationId: null,
    },
  });

  const ccStaff: {
    fullName: string;
    email: string;
    squareTeamMemberId: string;
    position: string;
    inviteStatus: string;
  }[] = [
    {
      fullName: "Clarissa Reyna",
      email: "clarissareyna625@gmail.com",
      squareTeamMemberId: "TMbc13IBzS8Z43AO",
      position: "manager",
      inviteStatus: "active",
    },
    {
      fullName: "Alexis Rodriguez",
      email: "alexisrxo96@gmail.com",
      squareTeamMemberId: "TMaExUyYaWYlvSqh",
      position: "stylist",
      inviteStatus: "active",
    },
    {
      fullName: "Kaylie Espinoza",
      email: "beauty.bysky928@gmail.com",
      squareTeamMemberId: "TMCzd3unwciKEVX7",
      position: "stylist",
      inviteStatus: "active",
    },
    {
      fullName: "Ashlynn Ochoa",
      email: "ashlynn5468@icloud.com",
      squareTeamMemberId: "TMn7kInT8g7Vrgxi",
      position: "stylist",
      inviteStatus: "invited",
    },
    {
      fullName: "Jessy Blamey",
      email: "jessyblamey@gmail.com",
      squareTeamMemberId: "TMMdDDwU8WXpCZ9m",
      position: "stylist",
      inviteStatus: "active",
    },
    {
      fullName: "Mia Gonzales",
      email: "gmia53696@gmail.com",
      squareTeamMemberId: "TM_xI40vPph2_Cos",
      position: "stylist",
      inviteStatus: "active",
    },
    {
      fullName: "Madelynn Martinez",
      email: "madelynn@salonenvycc.com",
      squareTeamMemberId: "TM5CjcvcHRXZQ4hP",
      position: "stylist",
      inviteStatus: "active",
    },
    {
      fullName: "Jaylee Jaeger",
      email: "jaylee@salonenvycc.com",
      squareTeamMemberId: "TMcc0QbHuUZfgcIB",
      position: "stylist",
      inviteStatus: "active",
    },
    {
      fullName: "Aubree Saldana",
      email: "aubree@salonenvycc.com",
      squareTeamMemberId: "TMfFCmgJ5RV-WCBq",
      position: "stylist",
      inviteStatus: "not_invited",
    },
  ];

  const saStaff: typeof ccStaff = [
    {
      fullName: "Melissa Cruz",
      email: "melissacruz2025@icloud.com",
      squareTeamMemberId: "TMMJKxeQuMlMW1Dw",
      position: "manager",
      inviteStatus: "active",
    },
    {
      fullName: "Clarissa Reyna",
      email: "clarissareyna625@gmail.com",
      squareTeamMemberId: "TMltRlD4OaczAnJr",
      position: "stylist",
      inviteStatus: "active",
    },
    {
      fullName: "Kiyara Smith",
      email: "kiyarals99@gmail.com",
      squareTeamMemberId: "TMk1YstlrnPrKw8p",
      position: "stylist",
      inviteStatus: "active",
    },
    {
      fullName: "Lucia Chumney",
      email: "luluchumney@gmail.com",
      squareTeamMemberId: "TM9RlP1_Gjb5gruX",
      position: "stylist",
      inviteStatus: "active",
    },
  ];

  for (const s of ccStaff) {
    await prisma.staffMember.upsert({
      where: { squareTeamMemberId: s.squareTeamMemberId },
      update: {
        fullName: s.fullName,
        email: s.email,
        position: s.position,
        inviteStatus: s.inviteStatus,
        locationId: cc.id,
      },
      create: {
        ...s,
        locationId: cc.id,
      },
    });
  }

  for (const s of saStaff) {
    await prisma.staffMember.upsert({
      where: { squareTeamMemberId: s.squareTeamMemberId },
      update: {
        fullName: s.fullName,
        email: s.email,
        position: s.position,
        inviteStatus: s.inviteStatus,
        locationId: sa.id,
      },
      create: {
        ...s,
        locationId: sa.id,
      },
    });
  }

  const alertCount = await prisma.adminAlert.count();
  if (alertCount === 0) {
    await prisma.adminAlert.create({
      data: {
        title: "Welcome to Salon Envy® Portal",
        body: "Your dashboard is connected. Sample alerts will appear here.",
        severity: "info",
      },
    });
  }

  console.log("✅ Seeded locations, owner, staff, sample alert");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
