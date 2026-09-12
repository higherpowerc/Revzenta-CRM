import { Database } from "bun:sqlite";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { getPgPool, initPostgresSchema, getDatabaseConfig } from "./connection";

/**
 * Migration Script: Transfers all data from SQLite (data/crm.db) to PostgreSQL.
 * Safe and idempotent: can be run to migrate production data to Render PostgreSQL.
 */
export async function migrateSqliteToPostgres(): Promise<{
  success: boolean;
  counts: Record<string, number>;
  message: string;
}> {
  const config = getDatabaseConfig();
  if (!config.isPostgres) {
    throw new Error("Cannot run migration: DATABASE_URL is not configured.");
  }

  const dataDir = process.env.DATA_DIR ?? join(import.meta.dir, "..", "..", "data");
  const sqlitePath = join(dataDir, "crm.db");

  if (!existsSync(sqlitePath)) {
    return {
      success: true,
      counts: {},
      message: `No SQLite database found at ${sqlitePath} — starting with fresh PostgreSQL database.`,
    };
  }

  console.log(`[migrate] Initializing PostgreSQL schema...`);
  await initPostgresSchema();

  console.log(`[migrate] Opening source SQLite database from ${sqlitePath}...`);
  const sqlite = new Database(sqlitePath);

  const pool = getPgPool();
  const client = await pool.connect();
  const counts: Record<string, number> = {};

  try {
    await client.query("BEGIN");

    // 1. Organizations
    const orgs = sqlite.query("SELECT * FROM orgs ORDER BY id").all() as any[];
    for (const o of orgs) {
      await client.query(
        `INSERT INTO organizations (
          id, name, stages, accent_color, dashboard_color, custom_fields,
          service_model, delivery_type, industry, intake_opts, custom_intake_groups,
          vertical_key, monthly_subscription_amount, revenue_model, billing_cycle_date,
          tier, status, canceled_at, retention_until, allow_self_schedule,
          agreement_template, agreements_pin_hash, email_sender_name, email_reply_to,
          webhook_secret, rentcast_api_key, rentcast_monthly_limit, rentcast_hard_stop_enabled,
          rentcast_usage_offset, created_at
        ) VALUES (
          $1, $2, $3::jsonb, $4, $5, $6::jsonb,
          $7, $8, $9, $10::jsonb, $11::jsonb,
          $12, $13, $14, $15,
          $16, $17, $18, $19, $20,
          $21, $22, $23, $24,
          $25, $26, $27, $28,
          $29, $30
        ) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
        [
          o.id,
          o.name,
          o.stages || "[]",
          o.accent_color || "#d6ff3f",
          o.dashboard_color || "",
          o.custom_fields || "[]",
          o.service_model || "both",
          o.delivery_type || "both",
          o.industry || "",
          o.intake_opts || "[]",
          o.custom_intake_groups || "[]",
          o.vertical_key || "",
          o.monthly_subscription_amount || 0,
          o.revenue_model || "sales",
          o.billing_cycle_date || "",
          o.tier || "pro",
          o.status || "active",
          o.canceled_at ? new Date(o.canceled_at) : null,
          o.retention_until ? new Date(o.retention_until) : null,
          Boolean(o.allow_self_schedule),
          o.agreement_template || "",
          o.agreements_pin_hash || "",
          o.email_sender_name || "",
          o.email_reply_to || "",
          o.webhook_secret || "",
          o.rentcast_api_key || "",
          o.rentcast_monthly_limit ?? 50,
          (o.rentcast_hard_stop_enabled ?? 1) === 1,
          o.rentcast_usage_offset ?? 0,
          o.created_at ? new Date(o.created_at) : new Date(),
        ]
      );
    }
    counts.organizations = orgs.length;

    // 2. Users
    const users = sqlite.query("SELECT * FROM users ORDER BY id").all() as any[];
    for (const u of users) {
      await client.query(
        `INSERT INTO users (id, org_id, email, password_hash, role, permissions, first_login_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
         ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email`,
        [
          u.id,
          u.org_id,
          u.email,
          u.password_hash,
          u.role || "member",
          u.permissions || "{}",
          u.first_login_at ? new Date(u.first_login_at) : null,
          u.created_at ? new Date(u.created_at) : new Date(),
        ]
      );
    }
    counts.users = users.length;

    // 3. Clients / Leads
    const clients = sqlite.query("SELECT * FROM clients ORDER BY id").all() as any[];
    for (const c of clients) {
      await client.query(
        `INSERT INTO clients (
          id, org_id, company_name, contact_name, email, phone, industry,
          services, custom_fields, deal_value, stage, next_action, notes,
          archived, client_type, address, city, state, zip, website, lead_source,
          lost, lost_reason, dnc, dnc_reason, dnc_date, provisioned_org_id,
          monthly_amount, agreement_status, payment_status, payment_link_url,
          paid_at, payment_amount_cents, stripe_customer_id, stripe_price_id, stripe_link_id,
          demo_outcome, demo_scheduled_at, demo_meeting_link, follow_up_note,
          timezone, tier, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8::jsonb, $9::jsonb, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19, $20, $21,
          $22, $23, $24, $25, $26, $27,
          $28, $29, $30, $31,
          $32, $33, $34, $35, $36,
          $37, $38, $39, $40,
          $41, $42, $43, $44
        ) ON CONFLICT (id) DO UPDATE SET company_name = EXCLUDED.company_name`,
        [
          c.id,
          c.org_id,
          c.company_name,
          c.contact_name || "",
          c.email || "",
          c.phone || "",
          c.industry || "",
          c.services || "[]",
          c.custom_fields || "[]",
          c.deal_value || 0,
          c.stage || "Prospect",
          c.next_action || "",
          c.notes || "",
          Boolean(c.archived),
          c.client_type || "residential",
          c.address || "",
          c.city || "",
          c.state || "",
          c.zip || "",
          c.website || "",
          c.lead_source || "",
          Boolean(c.lost),
          c.lost_reason || "",
          Boolean(c.dnc),
          c.dnc_reason || "",
          c.dnc_date || "",
          c.provisioned_org_id || 0,
          c.monthly_amount || 0,
          c.agreement_status || "not_sent",
          c.payment_status || "none",
          c.payment_link_url || "",
          c.paid_at ? new Date(c.paid_at) : null,
          c.payment_amount_cents || 0,
          c.stripe_customer_id || "",
          c.stripe_price_id || "",
          c.stripe_link_id || "",
          c.demo_outcome || "",
          c.demo_scheduled_at || "",
          c.demo_meeting_link || "",
          c.follow_up_note || "",
          c.timezone || "",
          c.tier || "",
          c.created_at ? new Date(c.created_at) : new Date(),
          c.updated_at ? new Date(c.updated_at) : new Date(),
        ]
      );
    }
    counts.clients = clients.length;

    // 4. Properties
    try {
      const properties = sqlite.query("SELECT * FROM properties ORDER BY id").all() as any[];
      for (const p of properties) {
        await client.query(
          `INSERT INTO properties (
            id, organization_id, apn, address_line1, address_line2, city, state, zip, county,
            property_type, bedrooms, bathrooms, square_feet, lot_size_sqft, year_built,
            estimated_value, value_range_low, value_range_high, estimated_equity, equity_percent,
            estimated_rent, last_sale_price, mortgage_balance, tax_assessed_value, tax_annual_amount,
            tax_delinquent, has_liens, is_foreclosure, is_pre_foreclosure, is_probate, is_vacant,
            is_absentee_owner, revzenta_opportunity_score, opportunity_score_reasons, source_provider,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9,
            $10, $11, $12, $13, $14, $15,
            $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25,
            $26, $27, $28, $29, $30, $31,
            $32, $33, $34::jsonb, $35,
            $36, $37
          ) ON CONFLICT (id) DO NOTHING`,
          [
            p.id,
            p.org_id,
            p.apn || "",
            p.address_line1 || "",
            p.address_line2 || "",
            p.city || "",
            p.state || "",
            p.zip || "",
            p.county || "",
            p.property_type || "Single Family",
            p.bedrooms ?? null,
            p.bathrooms ?? null,
            p.square_feet ?? null,
            p.lot_size_sqft ?? null,
            p.year_built ?? null,
            p.estimated_value ?? null,
            p.value_range_low ?? null,
            p.value_range_high ?? null,
            p.estimated_equity ?? null,
            p.equity_percent ?? null,
            p.estimated_rent ?? null,
            p.last_sale_price ?? null,
            p.mortgage_balance ?? null,
            p.tax_assessed_value ?? null,
            p.tax_annual_amount ?? null,
            Boolean(p.tax_delinquent),
            Boolean(p.has_liens),
            Boolean(p.is_foreclosure),
            Boolean(p.is_pre_foreclosure),
            Boolean(p.is_probate),
            Boolean(p.is_vacant),
            Boolean(p.is_absentee_owner),
            p.revzenta_opportunity_score ?? 0,
            p.opportunity_score_reasons || "[]",
            p.source_provider || "unified",
            p.created_at ? new Date(p.created_at) : new Date(),
            p.updated_at ? new Date(p.updated_at) : new Date(),
          ]
        );
      }
      counts.properties = properties.length;
    } catch {
      counts.properties = 0;
    }

    // 5. Saved Searches
    try {
      const savedSearches = sqlite.query("SELECT * FROM saved_searches ORDER BY id").all() as any[];
      for (const s of savedSearches) {
        await client.query(
          `INSERT INTO saved_searches (
            id, organization_id, created_by_user_id, name, natural_language_query,
            filters, auto_refresh, alert_enabled, matching_count, last_executed_at, created_at
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6::jsonb, $7, $8, $9, $10, $11
          ) ON CONFLICT (id) DO NOTHING`,
          [
            s.id,
            s.org_id,
            s.user_id ?? null,
            s.name || "Saved Search",
            s.natural_language_query || "",
            s.filters || "{}",
            Boolean(s.auto_refresh),
            Boolean(s.alert_enabled),
            s.matching_count ?? 0,
            s.last_executed_at ? new Date(s.last_executed_at) : null,
            s.created_at ? new Date(s.created_at) : new Date(),
          ]
        );
      }
      counts.saved_searches = savedSearches.length;
    } catch {
      counts.saved_searches = 0;
    }

    // 6. Property Distress Alerts
    try {
      const alerts = sqlite.query("SELECT * FROM property_distress_alerts ORDER BY id").all() as any[];
      for (const a of alerts) {
        await client.query(
          `INSERT INTO property_distress_alerts (
            id, organization_id, saved_search_id, property_id, alert_type,
            severity, headline, details, is_read, created_at
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8::jsonb, $9, $10
          ) ON CONFLICT (id) DO NOTHING`,
          [
            a.id,
            a.org_id,
            a.saved_search_id ?? null,
            a.property_id ?? null,
            a.alert_type || "general",
            a.severity || "medium",
            a.headline || "Distress Alert",
            a.details || "{}",
            Boolean(a.is_read),
            a.created_at ? new Date(a.created_at) : new Date(),
          ]
        );
      }
      counts.property_distress_alerts = alerts.length;
    } catch {
      counts.property_distress_alerts = 0;
    }

    // Reset sequences for auto-incrementing PKs
    const tablesWithSequences = [
      { table: "organizations", seq: "organizations_id_seq" },
      { table: "users", seq: "users_id_seq" },
      { table: "clients", seq: "clients_id_seq" },
      { table: "properties", seq: "properties_id_seq" },
      { table: "saved_searches", seq: "saved_searches_id_seq" },
      { table: "property_distress_alerts", seq: "property_distress_alerts_id_seq" },
    ];

    for (const { table, seq } of tablesWithSequences) {
      try {
        await client.query(
          `SELECT setval('${seq}', COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1, false)`
        );
      } catch {
        /* Sequence may not exist if table wasn't created */
      }
    }

    await client.query("COMMIT");

    return {
      success: true,
      counts,
      message: `Successfully migrated ${counts.organizations ?? 0} orgs, ${counts.users ?? 0} users, ${counts.clients ?? 0} clients, ${counts.properties ?? 0} properties, and ${counts.saved_searches ?? 0} saved searches to PostgreSQL.`,
    };
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("[migrate] Migration failed, transaction rolled back:", err);
    throw err;
  } finally {
    client.release();
  }
}

if (import.meta.main) {
  migrateSqliteToPostgres()
    .then((res) => {
      console.log("[migrate] Result:", res.message);
      process.exit(0);
    })
    .catch((err) => {
      console.error("[migrate] Fatal error:", err);
      process.exit(1);
    });
}
