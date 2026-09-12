import { describe, expect, it, beforeAll } from "bun:test";
import { db } from "../server/db";
import { searchProperties, convertPropertyToLead, type PropertyRow } from "../server/propertySearch";
import {
  createSavedSearch,
  listSavedSearches,
  executeSavedSearch,
  deleteSavedSearch,
} from "../server/savedSearches";

describe("Property Search & Saved Searches Engine", () => {
  const testOrgId = 9901;
  const otherOrgId = 9902;

  beforeAll(() => {
    // Setup test organizations
    db.query("INSERT OR IGNORE INTO orgs (id, name) VALUES (?, ?)").run(testOrgId, "Test Property Org");
    db.query("INSERT OR IGNORE INTO orgs (id, name) VALUES (?, ?)").run(otherOrgId, "Other Org");

    // Clean test properties
    db.query("DELETE FROM properties WHERE org_id IN (?, ?)").run(testOrgId, otherOrgId);
    db.query("DELETE FROM saved_searches WHERE org_id IN (?, ?)").run(testOrgId, otherOrgId);
    db.query("DELETE FROM clients WHERE org_id IN (?, ?)").run(testOrgId, otherOrgId);

    // Insert 4 varied test properties for testOrgId
    db.query(`
      INSERT INTO properties (
        org_id, apn, address_line1, city, state, zip, county,
        property_type, bedrooms, bathrooms, square_feet, year_built,
        estimated_value, estimated_equity, equity_percent,
        is_absentee_owner, is_vacant, has_liens, tax_delinquent,
        owner_name, revzenta_opportunity_score
      ) VALUES
      (?, 'APN-001', '101 Desert View Rd', 'Phoenix', 'AZ', '85001', 'maricopa', 'Single Family', 3, 2, 1800, 1995, 450000, 225000, 50, 1, 0, 0, 0, 'Robert Taylor', 88),
      (?, 'APN-002', '202 Saguaro Way', 'Mesa', 'AZ', '85201', 'maricopa', 'Single Family', 4, 3, 2400, 2005, 580000, 150000, 25, 0, 0, 0, 0, 'Sarah Jenkins', 45),
      (?, 'APN-003', '303 Cactus Trail', 'Scottsdale', 'AZ', '85251', 'maricopa', 'Single Family', 3, 2, 1600, 1980, 350000, 280000, 80, 1, 1, 1, 1, 'Absentee Estate LLC', 94),
      (?, 'APN-004', '404 Oak Ave', 'Dallas', 'TX', '75201', 'dallas', 'Single Family', 3, 2, 1500, 1970, 275000, 190000, 69, 1, 0, 0, 0, 'David Miller', 78)
    `).run(testOrgId, testOrgId, testOrgId, testOrgId);

    // Insert 1 property for otherOrgId (to verify tenant isolation)
    db.query(`
      INSERT INTO properties (
        org_id, apn, address_line1, city, state, zip, county,
        property_type, bedrooms, bathrooms, square_feet, year_built,
        estimated_value, estimated_equity, equity_percent,
        is_absentee_owner, owner_name, revzenta_opportunity_score
      ) VALUES
      (?, 'OTHER-001', '999 Secret St', 'Phoenix', 'AZ', '85001', 'maricopa', 'Single Family', 3, 2, 1700, 2000, 400000, 200000, 50, 1, 'Alien Owner', 90)
    `).run(otherOrgId);
  });

  describe("searchProperties", () => {
    it("searches with multi-criteria filters: Maricopa County + $300k-$600k + >40% Equity + Absentee", async () => {
      const results = await searchProperties(testOrgId, {
        county: "maricopa",
        minValue: 300000,
        maxValue: 600000,
        minEquityPct: 40,
        isAbsenteeOwner: true,
      });

      // Matches '101 Desert View Rd' (50% eq, $450k) and '303 Cactus Trail' (80% eq, $350k)
      // '202 Saguaro Way' excluded (not absentee, only 25% eq)
      // '404 Oak Ave' excluded (Dallas, TX)
      // '999 Secret St' excluded (belongs to otherOrgId)
      expect(results.totalCount).toBe(2);
      expect(results.properties.length).toBe(2);
      const addresses = results.properties.map((p) => p.address_line1);
      expect(addresses).toContain("101 Desert View Rd");
      expect(addresses).toContain("303 Cactus Trail");
    });

    it("ranks properties by Revzenta Opportunity Score descending by default", async () => {
      const results = await searchProperties(testOrgId, {
        county: "maricopa",
      });

      expect(results.properties.length).toBeGreaterThan(1);
      // First result should have highest score (303 Cactus Trail with 94)
      expect(results.properties[0].revzenta_opportunity_score).toBe(94);
      expect(results.properties[0].address_line1).toBe("303 Cactus Trail");
    });

    it("enforces strict tenant isolation (cannot see other organization records)", async () => {
      const results = await searchProperties(testOrgId, {
        query: "Secret St",
      });
      expect(results.totalCount).toBe(0);
      expect(results.properties.length).toBe(0);
    });

    it("respects pagination limit and offset", async () => {
      const page1 = await searchProperties(testOrgId, { limit: 2, offset: 0 });
      expect(page1.properties.length).toBe(2);

      const page2 = await searchProperties(testOrgId, { limit: 2, offset: 2 });
      expect(page2.properties.length).toBe(2);

      // Ensure no overlapping IDs between page 1 and page 2
      const page1Ids = page1.properties.map((p) => p.id);
      const page2Ids = page2.properties.map((p) => p.id);
      for (const id of page1Ids) {
        expect(page2Ids).not.toContain(id);
      }
    });
  });

  describe("convertPropertyToLead (Lead Generation)", () => {
    it("converts a Property into a CRM Lead and prevents duplicate creation", async () => {
      const prop = db.query("SELECT id, address_line1 FROM properties WHERE org_id = ? AND apn = 'APN-001'").get(testOrgId) as any;
      expect(prop).toBeDefined();

      // First conversion: succeeds
      const res1 = await convertPropertyToLead(testOrgId, prop.id);
      expect(res1.success).toBe(true);
      expect(res1.duplicate).toBe(false);
      expect(res1.clientId).toBeGreaterThan(0);

      // Verify client was added to clients table
      const client = db.query("SELECT * FROM clients WHERE id = ?").get(res1.clientId) as any;
      expect(client.address).toBe("101 Desert View Rd");
      expect(client.stage).toBe("Prospect");
      expect(client.deal_value).toBe(450000);

      // Second conversion of the same property: duplicate detected
      const res2 = await convertPropertyToLead(testOrgId, prop.id);
      expect(res2.success).toBe(false);
      expect(res2.duplicate).toBe(true);
      expect(res2.clientId).toBe(res1.clientId);
    });
  });

  describe("Saved Searches", () => {
    it("creates, lists, executes, and deletes saved searches with tenant isolation", async () => {
      const filterConfig = {
        county: "maricopa",
        minEquityPct: 40,
        isAbsenteeOwner: true,
      };

      // 1. Create Saved Search
      const saved = createSavedSearch(
        testOrgId,
        1,
        "Maricopa High-Equity Absentee Owners",
        filterConfig,
        "Find absentee owners in Maricopa County with at least 40% equity"
      );

      expect(saved.id).toBeGreaterThan(0);
      expect(saved.name).toBe("Maricopa High-Equity Absentee Owners");
      expect(saved.filters.county).toBe("maricopa");

      // 2. List Saved Searches
      const list = listSavedSearches(testOrgId);
      expect(list.length).toBeGreaterThan(0);
      expect(list.some((s) => s.id === saved.id)).toBe(true);

      // Tenant isolation: other org sees empty list
      const otherList = listSavedSearches(otherOrgId);
      expect(otherList.some((s) => s.id === saved.id)).toBe(false);

      // 3. Execute Saved Search
      const execution = await executeSavedSearch(saved.id, testOrgId);
      expect(execution.results.totalCount).toBe(2);
      expect(execution.savedSearch.matching_count).toBe(2);
      expect(execution.savedSearch.last_executed_at).not.toBeNull();

      // 4. Delete Saved Search
      const deleted = deleteSavedSearch(saved.id, testOrgId);
      expect(deleted).toBe(true);
      const afterDeleteList = listSavedSearches(testOrgId);
      expect(afterDeleteList.some((s) => s.id === saved.id)).toBe(false);
    });
  });
});
