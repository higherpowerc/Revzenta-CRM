import { describe, test, expect, beforeEach, beforeAll } from "bun:test";
import { db } from "../server/db";
import {
  createDistressAlertIfNew,
  listDistressAlerts,
  markAlertsRead,
  runDistressCheck,
  startDistressMonitor,
  stopDistressMonitor,
} from "../server/jobs/distressMonitor";
import {
  createSavedSearch,
  toggleSavedSearchAlert,
  getSavedSearchById,
} from "../server/savedSearches";

describe("Automated Property Distress Monitor & Alert Engine", () => {
  const TEST_ORG_ID = 9911;
  let testPropertyId: number;

  beforeAll(() => {
    db.query("INSERT OR IGNORE INTO orgs (id, name) VALUES (?, ?)").run(TEST_ORG_ID, "Test Distress Org");
    db.query("INSERT OR IGNORE INTO orgs (id, name) VALUES (?, ?)").run(9912, "Other Distress Org");
  });

  beforeEach(() => {
    // Clean up test org tables
    db.query("DELETE FROM property_distress_alerts WHERE org_id IN (?, ?)").run(TEST_ORG_ID, 9912);
    db.query("DELETE FROM saved_searches WHERE org_id IN (?, ?)").run(TEST_ORG_ID, 9912);
    db.query("DELETE FROM properties WHERE org_id IN (?, ?)").run(TEST_ORG_ID, 9912);

    // Insert a test distressed property
    const propRes = db.query(`
      INSERT INTO properties (
        org_id, apn, address_line1, city, state, zip, county,
        estimated_value, estimated_equity, equity_percent,
        is_pre_foreclosure, tax_delinquent, is_vacant, is_absentee_owner,
        revzenta_opportunity_score, opportunity_score_reasons, source_provider,
        created_at, updated_at
      ) VALUES (
        ?, 'TEST-APN-999', '123 Distress Blvd', 'Phoenix', 'AZ', '85001', 'maricopa',
        450000, 220000, 48.88,
        1, 1, 1, 1,
        88, '["Pre-Foreclosure", "Vacant", "Tax Delinquent"]', 'attom',
        datetime('now'), datetime('now')
      )
    `).run(TEST_ORG_ID);

    testPropertyId = Number(propRes.lastInsertRowid);
  });

  test("creates a distress alert for a delinquent/pre-foreclosure property", () => {
    const alert = createDistressAlertIfNew(TEST_ORG_ID, null, testPropertyId, {
      alert_type: "pre_foreclosure",
      severity: "urgent",
      headline: "Pre-Foreclosure Notice: 123 Distress Blvd, Phoenix",
      details: { estimated_value: 450000, opportunity_score: 88 },
    });

    expect(alert).not.toBeNull();
    expect(alert!.org_id).toBe(TEST_ORG_ID);
    expect(alert!.alert_type).toBe("pre_foreclosure");
    expect(alert!.severity).toBe("urgent");
    expect(alert!.is_read).toBe(false);
    expect(alert!.property).not.toBeNull();
    expect(alert!.property!.address_line1).toBe("123 Distress Blvd");
    expect(alert!.property!.revzenta_opportunity_score).toBe(88);
  });

  test("enforces deduplication window: rejects duplicate alerts within 7 days", () => {
    const firstAlert = createDistressAlertIfNew(TEST_ORG_ID, null, testPropertyId, {
      alert_type: "pre_foreclosure",
      severity: "urgent",
      headline: "Pre-Foreclosure Notice: 123 Distress Blvd, Phoenix",
      details: { estimated_value: 450000 },
    });
    expect(firstAlert).not.toBeNull();

    // Second call with same org, property, and alert_type
    const duplicateAlert = createDistressAlertIfNew(TEST_ORG_ID, null, testPropertyId, {
      alert_type: "pre_foreclosure",
      severity: "urgent",
      headline: "Duplicate Pre-Foreclosure Notice",
      details: { estimated_value: 450000 },
    });
    expect(duplicateAlert).toBeNull();

    // But a DIFFERENT alert type for the same property is allowed
    const differentTypeAlert = createDistressAlertIfNew(TEST_ORG_ID, null, testPropertyId, {
      alert_type: "tax_delinquent",
      severity: "high",
      headline: "Tax Delinquent Notice",
      details: { estimated_value: 450000 },
    });
    expect(differentTypeAlert).not.toBeNull();
  });

  test("lists alerts with unread filtering and tenant isolation", () => {
    const a1 = createDistressAlertIfNew(TEST_ORG_ID, null, testPropertyId, {
      alert_type: "pre_foreclosure",
      severity: "urgent",
      headline: "Alert 1",
      details: {},
    });
    const a2 = createDistressAlertIfNew(TEST_ORG_ID, null, testPropertyId, {
      alert_type: "vacant",
      severity: "medium",
      headline: "Alert 2",
      details: {},
    });

    expect(a1).not.toBeNull();
    expect(a2).not.toBeNull();

    const all = listDistressAlerts(TEST_ORG_ID);
    expect(all.total).toBe(2);
    expect(all.unreadCount).toBe(2);

    // Other organization sees 0 alerts (tenant isolation)
    const otherOrg = listDistressAlerts(9912);
    expect(otherOrg.total).toBe(0);
    expect(otherOrg.alerts.length).toBe(0);
  });

  test("marks alerts as read individually and in bulk", () => {
    const a1 = createDistressAlertIfNew(TEST_ORG_ID, null, testPropertyId, {
      alert_type: "pre_foreclosure",
      severity: "urgent",
      headline: "Alert 1",
      details: {},
    });
    const a2 = createDistressAlertIfNew(TEST_ORG_ID, null, testPropertyId, {
      alert_type: "high_opportunity_score",
      severity: "high",
      headline: "Alert 2",
      details: {},
    });

    // Mark single alert read
    const res1 = markAlertsRead(TEST_ORG_ID, [a1!.id]);
    expect(res1.updatedCount).toBe(1);

    const unread = listDistressAlerts(TEST_ORG_ID, { unreadOnly: true });
    expect(unread.total).toBe(1);
    expect(unread.alerts[0].id).toBe(a2!.id);

    // Mark all remaining alerts read
    const res2 = markAlertsRead(TEST_ORG_ID);
    expect(res2.updatedCount).toBe(1);

    const finalUnread = listDistressAlerts(TEST_ORG_ID, { unreadOnly: true });
    expect(finalUnread.total).toBe(0);
    expect(finalUnread.unreadCount).toBe(0);
  });

  test("toggles alert_enabled on saved searches", () => {
    const search = createSavedSearch(
      TEST_ORG_ID,
      null,
      "Phoenix High Equity Wholesale",
      { state: "AZ", county: "maricopa", minEquityPct: 40 },
      "absentee in Phoenix with high equity",
      false
    );

    expect(search.alert_enabled).toBe(false);

    // Toggle on
    const toggledOn = toggleSavedSearchAlert(search.id, TEST_ORG_ID);
    expect(toggledOn.alert_enabled).toBe(true);

    // Verify persisted in DB
    const fetched = getSavedSearchById(search.id, TEST_ORG_ID);
    expect(fetched!.alert_enabled).toBe(true);

    // Toggle off explicitly
    const toggledOff = toggleSavedSearchAlert(search.id, TEST_ORG_ID, false);
    expect(toggledOff.alert_enabled).toBe(false);
  });

  test("runs automated distress check scan and generates alerts", async () => {
    // Create an alert-enabled saved search targeting Arizona
    createSavedSearch(
      TEST_ORG_ID,
      null,
      "AZ Distress Watchlist",
      { state: "AZ" },
      "all az distressed",
      true
    );

    const result = await runDistressCheck(TEST_ORG_ID);
    expect(result.scannedSearches).toBe(1);
    expect(result.scannedProperties).toBeGreaterThanOrEqual(1);
    expect(result.newAlertsCreated).toBe(1);
    expect(result.alerts[0].property_id).toBe(testPropertyId);
    expect(result.alerts[0].severity).toBe("urgent"); // pre-foreclosure
  });

  test("starts and stops distress monitor timer safely", () => {
    startDistressMonitor(10000);
    expect(() => stopDistressMonitor()).not.toThrow();
  });
});
