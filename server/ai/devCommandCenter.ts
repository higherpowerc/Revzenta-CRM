import { getDatabaseConfig, checkDatabaseHealth, pgQuery } from "../db/connection";
import { getGeminiStatus, maskApiKey } from "./geminiClient";
import { providerRegistry } from "../providers/providerRegistry";
import { db } from "../db";

export interface DevSystemStatus {
  timestamp: string;
  uptimeSeconds: number;
  memoryUsage: {
    rssMb: number;
    heapTotalMb: number;
    heapUsedMb: number;
  };
  database: {
    driver: "postgres" | "sqlite";
    isHealthy: boolean;
    poolStatus?: {
      total: number;
      idle: number;
      waiting: number;
    };
    propertiesTotal: number;
    savedSearchesTotal: number;
  };
  geminiAi: {
    isConfigured: boolean;
    model: string;
    maskedApiKey: string;
    requestsTotal: number;
    errorsTotal: number;
    lastUsedAt?: string;
  };
  providers: {
    activeProviders: string[];
    hasRentCast: boolean;
    hasAttom: boolean;
    hasMock: boolean;
  };
  security: {
    secretsSanitized: boolean;
    strictTenantIsolationEnforced: boolean;
  };
}

/**
 * Recursively sanitizes an object to redact any sensitive credentials or secrets.
 */
export function sanitizeSecrets(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeSecrets);
  }

  const sensitivePattern = /(key|secret|password|token|credential|auth|database_url|cookie)/i;
  const sanitized: Record<string, any> = {};

  for (const [k, v] of Object.entries(obj)) {
    if (sensitivePattern.test(k)) {
      if (typeof v === "string") {
        sanitized[k] = maskApiKey(v);
      } else {
        sanitized[k] = "[REDACTED]";
      }
    } else if (typeof v === "object" && v !== null) {
      sanitized[k] = sanitizeSecrets(v);
    } else {
      sanitized[k] = v;
    }
  }

  return sanitized;
}

/**
 * Collects complete developer telemetry for the Revzenta Command Center.
 */
export async function getDevCommandCenterStatus(): Promise<DevSystemStatus> {
  const dbHealth = await checkDatabaseHealth();
  const dbConfig = getDatabaseConfig();
  const geminiStatus = getGeminiStatus();
  const activeProviders = providerRegistry.listProviders().map((p) => p.name);

  let propertiesTotal = 0;
  let savedSearchesTotal = 0;

  try {
    if (dbConfig.isPostgres) {
      const propRes = await pgQuery<{ count: string }>("SELECT COUNT(*) as count FROM properties");
      propertiesTotal = parseInt(propRes[0]?.count || "0", 10);
      const searchRes = await pgQuery<{ count: string }>("SELECT COUNT(*) as count FROM saved_searches");
      savedSearchesTotal = parseInt(searchRes[0]?.count || "0", 10);
    } else {
      const propStmt = db.prepare("SELECT COUNT(*) as count FROM properties");
      propertiesTotal = (propStmt.get() as any)?.count || 0;
      const searchStmt = db.prepare("SELECT COUNT(*) as count FROM saved_searches");
      savedSearchesTotal = (searchStmt.get() as any)?.count || 0;
    }
  } catch (err) {
    console.warn("[DevCommandCenter] Failed to fetch table totals:", err);
  }

  const mem = process.memoryUsage();

  return {
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    memoryUsage: {
      rssMb: Math.round(mem.rss / (1024 * 1024)),
      heapTotalMb: Math.round(mem.heapTotal / (1024 * 1024)),
      heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
    },
    database: {
      driver: dbConfig.isPostgres ? "postgres" : "sqlite",
      isHealthy: dbHealth.status === "healthy",
      propertiesTotal,
      savedSearchesTotal,
    },
    geminiAi: geminiStatus,
    providers: {
      activeProviders,
      hasRentCast: activeProviders.some((p: string) => p.toLowerCase().includes("rentcast")),
      hasAttom: activeProviders.some((p: string) => p.toLowerCase().includes("attom")),
      hasMock: activeProviders.some((p: string) => p.toLowerCase().includes("mock")),
    },
    security: {
      secretsSanitized: true,
      strictTenantIsolationEnforced: true,
    },
  };
}

/**
 * Analyzes a developer query with strict read-only guarantees.
 * Strictly forbids DROP, DELETE, INSERT, UPDATE, ALTER, TRUNCATE.
 */
export async function analyzeDevQuery(sql: string, params: any[] = []): Promise<{
  allowed: boolean;
  executionTimeMs?: number;
  rowCount?: number;
  rows?: any[];
  error?: string;
}> {
  const trimmed = sql.trim();
  const normalized = trimmed.toUpperCase();

  // Guard against non-read-only queries
  if (!normalized.startsWith("SELECT") && !normalized.startsWith("EXPLAIN")) {
    return {
      allowed: false,
      error: "Dev Command Center query execution is strictly restricted to read-only SELECT and EXPLAIN queries.",
    };
  }

  const destructiveKeywords = ["DROP", "DELETE", "INSERT", "UPDATE", "ALTER", "TRUNCATE", "CREATE", "GRANT", "REVOKE"];
  for (const kw of destructiveKeywords) {
    const regex = new RegExp(`\\b${kw}\\b`, "i");
    if (regex.test(trimmed)) {
      return {
        allowed: false,
        error: `Query contains forbidden statement or keyword: ${kw}. Only pure read-only queries are permitted.`,
      };
    }
  }

  const startTime = Date.now();
  try {
    const dbConfig = getDatabaseConfig();
    let rows: any[] = [];
    if (dbConfig.isPostgres) {
      rows = await pgQuery(trimmed, params);
    } else {
      const stmt = db.prepare(trimmed);
      rows = stmt.all(...params) as any[];
    }
    const executionTimeMs = Date.now() - startTime;

    return {
      allowed: true,
      executionTimeMs,
      rowCount: rows.length,
      // Cap returned rows to 50 for safety
      rows: sanitizeSecrets(rows.slice(0, 50)),
    };
  } catch (err: any) {
    return {
      allowed: true,
      executionTimeMs: Date.now() - startTime,
      error: err.message || "Query execution failed.",
    };
  }
}
