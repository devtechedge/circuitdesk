import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "drizzle");
const files = readdirSync(dir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  throw new Error("No migrations found in ./drizzle; run drizzle-kit generate first.");
}

const migrationSql = files
  .map((file) => readFileSync(join(dir, file), "utf8").replace(/--> statement-breakpoint/g, ""))
  .join("\n");

const rlsPath = join(process.cwd(), "src/db/rls.sql");
const rlsSql = existsSync(rlsPath) ? readFileSync(rlsPath, "utf8") : "";

const combined = `${migrationSql}\n\n${rlsSql}`;
const header =
  "// AUTO-GENERATED from drizzle/*.sql and src/db/rls.sql by scripts/gen-ddl.ts. Do not edit by hand.\n";

writeFileSync(
  join(process.cwd(), "src/db/ddl.ts"),
  `${header}export const ddl = ${JSON.stringify(combined)};\nexport const rlsDdl = ${JSON.stringify(rlsSql)};\n`,
  "utf8"
);

console.log(`Generated src/db/ddl.ts from ${files.length} migration(s) + RLS policies.`);

export {};
