import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run the seed script.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.location.createMany({
    data: [
      {
        name: "Corpus Christi",
        squareLocationId: "LTJSA6QR1HGW6",
        address: "5601 S Padre Island Dr STE E",
        phone: "(361) 889-1102",
      },
      {
        name: "San Antonio",
        squareLocationId: "LXJYXDXWR0XZF",
        address: "11826 Wurzbach Rd",
        phone: "(210) 660-3339",
      },
    ],
    skipDuplicates: true,
  });

  const passwordHash = await hash("ChangeMe123!", 10);
  await prisma.user.upsert({
    where: { email: "ceo@36west.org" },
    create: {
      email: "ceo@36west.org",
      name: "Owner",
      passwordHash,
      role: "OWNER",
    },
    update: {
      passwordHash,
      role: "OWNER",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
