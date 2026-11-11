import "dotenv/config";
import { getEnv } from "../src/env";
import { getDb } from "../src/db/client";
import { seedSyntheticDemo } from "../src/demo/seed";

const isDemoFlag = process.argv.includes("--demo");
const env = getEnv();

if (env.NODE_ENV === "production" && !isDemoFlag && env.ALLOW_PROD_SEED !== "1") {
  console.error(
    "Refusing to seed in production without --demo or ALLOW_PROD_SEED=1."
  );
  process.exit(1);
}

const db = await getDb();
await seedSyntheticDemo(db);
console.log("Synthetic demo workspace seeded (idempotent).");
process.exit(0);
