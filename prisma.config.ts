import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // CLI / migrations: prefer direct URL when set (replaces schema `directUrl` in Prisma 7+)
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
