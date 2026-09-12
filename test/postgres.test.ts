import { describe, expect, it } from "bun:test";
import { getDatabaseConfig, checkDatabaseHealth } from "../server/db/connection";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

describe("Database Abstraction & PostgreSQL Schema", () => {
  it("detects local SQLite configuration by default when DATABASE_URL is unset", () => {
    const originalUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    const config = getDatabaseConfig();
    expect(config.isPostgres).toBe(false);

    if (originalUrl) process.env.DATABASE_URL = originalUrl;
  });

  it("identifies valid postgres connection strings", () => {
    const originalUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgres://user:password@localhost:5432/revzenta";

    const config = getDatabaseConfig();
    expect(config.isPostgres).toBe(true);
    expect(config.connectionString).toContain("revzenta");

    if (originalUrl) process.env.DATABASE_URL = originalUrl;
    else delete process.env.DATABASE_URL;
  });

  it("checks database health reporting engine and status", async () => {
    const health = await checkDatabaseHealth();
    expect(health.status).toBe("healthy");
    expect(["postgres", "sqlite"]).toContain(health.engine);
  });

  it("verifies server/db/schema.sql exists and defines all required enterprise tables", () => {
    const schemaPath = join(import.meta.dir, "..", "server", "db", "schema.sql");
    expect(existsSync(schemaPath)).toBe(true);

    const sql = readFileSync(schemaPath, "utf8");

    // Check for core tables required by Revzenta specification
    const requiredTables = [
      "organizations",
      "users",
      "properties",
      "property_owners",
      "saved_searches",
      "clients",
      "tasks",
      "invoices",
      "appointments",
      "offers",
      "transactions",
      "buyers",
      "property_enrichment_cache",
      "privacy_suppression_registry",
      "audit_logs",
      "usage_meter",
      "property_distress_alerts",
    ];

    for (const table of requiredTables) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }

    // Check for high-performance indexes on properties
    expect(sql).toContain("idx_prop_org_id");
    expect(sql).toContain("idx_prop_apn");
    expect(sql).toContain("idx_prop_address");
    expect(sql).toContain("idx_prop_zip");
    expect(sql).toContain("idx_prop_county");
    expect(sql).toContain("idx_prop_value");
    expect(sql).toContain("idx_prop_equity");
  });

  it("safely guards migrateSqliteToPostgres when DATABASE_URL is missing", async () => {
    const { migrateSqliteToPostgres } = await import("../server/db/migrate-to-pg");
    const originalUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    expect(migrateSqliteToPostgres()).rejects.toThrow("DATABASE_URL is not configured");

    if (originalUrl) process.env.DATABASE_URL = originalUrl;
  });

  it("responds to unauthenticated GET /api/health with healthy status and database metrics", async () => {
    const { handleApi } = await import("../server/api");
    const req = new Request("http://localhost:3001/api/health", { method: "GET" });
    const res = await handleApi(req, new URL(req.url));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.version).toBe("2.0.0");
    expect(body.database).toBeDefined();
    expect(body.database.status).toBe("healthy");
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });
});
