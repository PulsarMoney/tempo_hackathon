import { Pool } from "pg";

let pool: Pool | null = null;

export function getPgPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return null;
  }

  if (pool) {
    return pool;
  }

  pool = new Pool({
    connectionString,
    max: 5,
  });

  return pool;
}
