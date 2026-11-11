import { bigint, timestamp, uuid } from "drizzle-orm/pg-core";

export const idColumn = () => uuid("id").defaultRandom().primaryKey();

export const utcTimestamp = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

export const createdAtColumn = () =>
  timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow();

export const updatedAtColumn = () =>
  timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow();

export const moneyMinor = (name: string) =>
  bigint(name, { mode: "number" }).notNull().default(0);
