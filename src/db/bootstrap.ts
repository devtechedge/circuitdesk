import type { PGlite } from "@electric-sql/pglite";
import { ddl } from "./ddl";

export async function bootstrapPglite(client: PGlite): Promise<void> {
  await client.exec(ddl);
}
