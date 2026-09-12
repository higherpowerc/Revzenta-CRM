import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export interface DatabaseConfig {
  connectionString?: string;
  isPostgres: boolean;
}

let pgPool: Pool | null = null;

export function getDatabaseConfig(): DatabaseConfig {
  const connStr = process.env.DATABASE_URL?.trim();
  return {
    connectionString: connStr,
    isPostgres: Boolean(connStr && (connStr.startsWith("postgres://") || connStr.startsWith("postgresql://"))),
  };
}

export function getPgPool(): Pool {
  if (!pgPool) {
    const config = getDatabaseConfig();
    if (!config.connectionString) {
      throw new Error("DATABASE_URL environment variable is not configured.");
    }
    pgPool = new Pool({
      connectionString: config.connectionString,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pgPool.on("error", (err) => {
      console.error("[postgres] Unexpected client error in pool:", err);
    });
  }
  return pgPool;
}

/**
 * Execute a parameterized query against PostgreSQL
 */
export async function pgQuery<T extends QueryResultRow = any>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const pool = getPgPool();
  const res = await pool.query<T>(sql, params);
  return res.rows;
}

/**
 * Fetch a single row or null
 */
export async function pgQueryOne<T extends QueryResultRow = any>(
  sql: string,
  params: any[] = []
): Promise<T | null> {
  const rows = await pgQuery<T>(sql, params);
  return rows[0] ?? null;
}

/**
 * Execute DDL or non-returning statement
 */
export async function pgExecute(sql: string, params: any[] = []): Promise<number> {
  const pool = getPgPool();
  const res = await pool.query(sql, params);
  return res.rowCount ?? 0;
}

/**
 * Transaction helper
 */
export async function pgTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Initializes the PostgreSQL database schema if tables do not exist
 */
export async function initPostgresSchema(): Promise<{ initialized: boolean; message: string }> {
  const config = getDatabaseConfig();
  if (!config.isPostgres) {
    return { initialized: false, message: "Skipping PostgreSQL schema init: DATABASE_URL not set." };
  }

  const dir = fileURLToPath(new URL(".", import.meta.url));
  const schemaPath = join(dir, "schema.sql");
  if (!existsSync(schemaPath)) {
    throw new Error(`Schema file not found at ${schemaPath}`);
  }

  const ddl = readFileSync(schemaPath, "utf8");
  const pool = getPgPool();

  try {
    await pool.query(ddl);

    // Backward-compatibility: Ensure existing PostgreSQL tables use org_id
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'organization_id') THEN
          ALTER TABLE properties RENAME COLUMN organization_id TO org_id;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saved_searches' AND column_name = 'organization_id') THEN
          ALTER TABLE saved_searches RENAME COLUMN organization_id TO org_id;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'property_owners' AND column_name = 'organization_id') THEN
          ALTER TABLE property_owners RENAME COLUMN organization_id TO org_id;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'property_distress_alerts' AND column_name = 'organization_id') THEN
          ALTER TABLE property_distress_alerts RENAME COLUMN organization_id TO org_id;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'organization_id') THEN
          ALTER TABLE audit_logs RENAME COLUMN organization_id TO org_id;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usage_meter' AND column_name = 'organization_id') THEN
          ALTER TABLE usage_meter RENAME COLUMN organization_id TO org_id;
        END IF;
      END $$;
    `);

    return { initialized: true, message: "PostgreSQL schema successfully initialized and verified." };
  } catch (err: any) {
    console.error("[postgres] Schema initialization error:", err);
    throw new Error(`Failed to initialize PostgreSQL schema: ${err.message}`);
  }
}

/**
 * Database health check helper
 */
export async function checkDatabaseHealth(): Promise<{
  engine: "postgres" | "sqlite";
  status: "healthy" | "unhealthy";
  latencyMs: number;
  message?: string;
}> {
  const config = getDatabaseConfig();
  const start = performance.now();

  if (config.isPostgres) {
    try {
      await pgQuery("SELECT 1 as health");
      const latencyMs = Math.round(performance.now() - start);
      return { engine: "postgres", status: "healthy", latencyMs };
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - start);
      return { engine: "postgres", status: "unhealthy", latencyMs, message: err.message };
    }
  }

  return { engine: "sqlite", status: "healthy", latencyMs: 0, message: "Local SQLite file active" };
}
