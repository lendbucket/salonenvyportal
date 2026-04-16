const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

async function run() {
  const tables = ["social_connections", "social_oauth_states", "api_keys", "api_key_logs"];
  for (const t of tables) {
    try {
      await p.$executeRawUnsafe(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY`);
      await p.$executeRawUnsafe(`DROP POLICY IF EXISTS service_role_full_access ON public.${t}`);
      await p.$executeRawUnsafe(`CREATE POLICY service_role_full_access ON public.${t} FOR ALL TO service_role USING (true) WITH CHECK (true)`);
      await p.$executeRawUnsafe(`DROP POLICY IF EXISTS postgres_full_access ON public.${t}`);
      await p.$executeRawUnsafe(`CREATE POLICY postgres_full_access ON public.${t} FOR ALL TO postgres USING (true) WITH CHECK (true)`);
      console.log("RLS enabled:", t);
    } catch (e) {
      console.error("Failed:", t, e.message);
    }
  }
  await p.$disconnect();
}
run();
