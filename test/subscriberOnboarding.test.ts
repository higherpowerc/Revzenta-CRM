import { describe, it, expect, beforeEach } from "bun:test";
import { db } from "../server/db";
import { handleApi } from "../server/api";
import { createSession } from "../server/auth";

describe("Subscriber Onboarding & Pricing Restructure Suite", () => {
  let testOrgId: number;
  let testUserId: number;
  let testToken: string;

  beforeEach(() => {
    const orgRes = db.query(`
      INSERT INTO orgs (name, stages, accent_color, vertical_key, tier, onboarding_completed, created_at)
      VALUES (?, '[]', '#d6ff3f', 'wholesalebiz', 'solo', 0, datetime('now'))
    `).run("New Subscriber Test Org " + Math.random().toString(36).slice(2));
    testOrgId = Number(orgRes.lastInsertRowid);

    const userRes = db.query(`
      INSERT INTO users (email, password_hash, org_id, role, permissions, created_at)
      VALUES (?, 'dummy_hash', ?, 'admin', '{}', datetime('now'))
    `).run("test_sub_" + Math.random().toString(36).slice(2) + "@revzentatest.com", testOrgId);
    testUserId = Number(userRes.lastInsertRowid);

    testToken = createSession(testUserId);
  });

  it("blocks unauthenticated access to /api/subscriber/onboarding", async () => {
    const req = new Request("http://localhost:3001/api/subscriber/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyLegalName: "Test LLC" }),
    });
    const res = await handleApi(req, new URL(req.url));
    expect(res.status).toBe(401);
  });

  it("checks that newly created subscriber user reports onboardingCompleted: false", async () => {
    const req = new Request("http://localhost:3001/api/auth/me", {
      headers: { Authorization: "Bearer " + testToken },
    });
    const res = await handleApi(req, new URL(req.url));
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.user.onboardingCompleted).toBe(false);
  });

  it("completes subscriber onboarding as a Business with title company and demo lead", async () => {
    const payload = {
      operatingType: "business",
      companyLegalName: "Apex Acquisitions Group LLC",
      primaryMarketCity: "Detroit, MI",
      preferredTitleCompany: "First American Title",
      seedDemoLead: true,
    };

    const req = new Request("http://localhost:3001/api/subscriber/onboarding", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + testToken,
      },
      body: JSON.stringify(payload),
    });
    const res = await handleApi(req, new URL(req.url));

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.ok).toBe(true);
    expect(data.user.onboardingCompleted).toBe(true);
    expect(data.user.orgName).toBe("Apex Acquisitions Group LLC");

    // Check database org record
    const orgRow = db.query("SELECT * FROM orgs WHERE id = ?").get(testOrgId) as any;
    expect(orgRow.onboarding_completed).toBe(1);
    expect(orgRow.operating_type).toBe("business");
    expect(orgRow.company_legal_name).toBe("Apex Acquisitions Group LLC");
    expect(orgRow.primary_market_city).toBe("Detroit, MI");
    expect(orgRow.preferred_title_company).toBe("First American Title");

    // Verify demo lead was seeded
    const leads = db.query("SELECT * FROM clients WHERE org_id = ?").all(testOrgId) as any[];
    expect(leads.length).toBeGreaterThanOrEqual(1);
    expect(leads[0].contact_name).toContain("Marcus Vance");
  });

  it("completes subscriber onboarding as an Individual with alternate communication email and no title company", async () => {
    const payload = {
      operatingType: "individual",
      legalName: "Marcus Vance",
      companyLegalName: "Marcus Vance",
      primaryMarketCity: "Austin, TX",
      communicationsEmail: "marcus.acquisitions@gmail.com",
      preferredTitleCompany: "",
      seedDemoLead: false,
    };

    const req = new Request("http://localhost:3001/api/subscriber/onboarding", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + testToken,
      },
      body: JSON.stringify(payload),
    });
    const res = await handleApi(req, new URL(req.url));

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.ok).toBe(true);
    expect(data.user.onboardingCompleted).toBe(true);
    expect(data.user.orgName).toBe("Marcus Vance");

    // Check database org record
    const orgRow = db.query("SELECT * FROM orgs WHERE id = ?").get(testOrgId) as any;
    expect(orgRow.onboarding_completed).toBe(1);
    expect(orgRow.operating_type).toBe("individual");
    expect(orgRow.company_legal_name).toBe("Marcus Vance");
    expect(orgRow.communications_email).toBe("marcus.acquisitions@gmail.com");
    expect(orgRow.preferred_title_company).toBe("");
  });
});
