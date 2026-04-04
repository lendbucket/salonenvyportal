// @ts-nocheck

import bcrypt from "bcryptjs"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

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
  })

  const sa = await prisma.location.upsert({
    where: { squareLocationId: "LXJYXDXWR0XZF" },
    update: {},
    create: {
      name: "San Antonio",
      squareLocationId: "LXJYXDXWR0XZF",
      address: "11826 Wurzbach Rd, TX 78230",
      phone: "(210) 660-3339",
    },
  })

  const passwordHash = await bcrypt.hash("ChangeMe123!", 12)

  const owner = await prisma.user.upsert({
    where: { email: "ceo@36west.org" },
    update: {},
    create: {
      email: "ceo@36west.org",
      name: "Robert Reyna",
      role: "OWNER",
      passwordHash: passwordHash,
      locationId: null,
    },
  })

  console.log("✅ Seeded:", cc.name, sa.name, owner.email)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
