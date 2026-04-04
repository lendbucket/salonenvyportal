import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  earlyAccess: true,
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
    // @ts-expect-error directUrl is supported by Prisma CLI; omitted from PrismaConfig Datasource typings
    directUrl: process.env.DIRECT_URL ?? "",
  },
});
