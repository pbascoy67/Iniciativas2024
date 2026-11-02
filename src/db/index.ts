import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = PostgresJsDatabase<typeof schema>;
const g = globalThis as unknown as { __pg?: ReturnType<typeof postgres>; __db?: Db };

/** Lazily connects so `next build` works without a database. */
export function getDb(): Db {
  if (!g.__db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
    g.__pg = postgres(url, { max: 10, onnotice: () => {} });
    g.__db = drizzle(g.__pg, { schema });
  }
  return g.__db;
}

export const db = new Proxy({} as Db, {
  get: (_t, prop) => Reflect.get(getDb(), prop),
});

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;
export * from "./schema";
