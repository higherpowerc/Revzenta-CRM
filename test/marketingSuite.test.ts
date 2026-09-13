import { describe, test, expect, beforeAll } from "bun:test";
import { db } from "../server/db";
import { handleApi } from "../server/api";
import { createSession } from "../server/auth";

describe("Owner Marketing & Attribution Suite", () => {
  const OWNER_USER_ID = 1; // org_id = 1, role = 'admin'
  const TENANT_ADMIN_USER_ID = 3; // org_id = 3, role = 'admin' (tenant)
  const TENANT_MEMBER_USER_ID = 9; // org_id = 7, role = 'member' (tenant)

  let ownerToken: string;
  let tenantAdminToken: string;
  let tenantMemberToken: string;

  beforeAll(() => {
    ownerToken = createSession(OWNER_USER_ID);
    tenantAdminToken = createSession(TENANT_ADMIN_USER_ID);
    tenantMemberToken = createSession(TENANT_MEMBER_USER_ID);
  });

  /* ── 1. Security & Role Isolation ───────────────────────────────── */
  test("rejects unauthenticated request to /api/owner/marketing", async () => {
    const req = new Request("http://localhost:3000/api/owner/marketing", {
      method: "GET",
    });
    const res = await handleApi(req, new URL(req.url));
    expect(res.status).toBe(401);
  });

  test("rejects tenant admin from /api/owner/marketing with 403 Forbidden", async () => {
    const req = new Request("http://localhost:3000/api/owner/marketing", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tenantAdminToken}`,
      },
    });
    const res = await handleApi(req, new URL(req.url));
    expect(res.status).toBe(403);
  });

  test("rejects tenant member from /api/owner/marketing with 403 Forbidden", async () => {
    const req = new Request("http://localhost:3000/api/owner/marketing", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tenantMemberToken}`,
      },
    });
    const res = await handleApi(req, new URL(req.url));
    expect(res.status).toBe(403);
  });

  test("allows platform owner to access /api/owner/marketing and returns full metrics", async () => {
    const req = new Request("http://localhost:3000/api/owner/marketing", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    });
    const res = await handleApi(req, new URL(req.url));
    expect(res.status).toBe(200);

    const body: any = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();

    // Aggregates
    expect(body.data.totalSpend).toBeGreaterThanOrEqual(0);
    expect(body.data.totalClicks).toBeGreaterThanOrEqual(0);
    expect(body.data.totalLeads).toBeGreaterThanOrEqual(0);
    expect(body.data.totalConversions).toBeGreaterThanOrEqual(0);
    expect(body.data.totalAttributedArr).toBeGreaterThanOrEqual(0);
    expect(body.data.blendedCac).toBeDefined();
    expect(body.data.blendedRoas).toBeDefined();

    // Sources channel matrix
    expect(Array.isArray(body.data.sources)).toBe(true);
    const channels = body.data.sources.map((s: any) => s.channel);
    expect(channels).toContain("google_ads");
    expect(channels).toContain("meta_ads");
    expect(channels).toContain("seo_organic");
    expect(channels).toContain("title_viral_loop");
    expect(channels).toContain("community");
    expect(channels).toContain("direct");

    // Check viral loop properties
    const viralLoop = body.data.sources.find((s: any) => s.channel === "title_viral_loop");
    expect(viralLoop).toBeDefined();
    expect(viralLoop.badge).toBe("viral");
    expect(viralLoop.spend).toBe(0);
    expect(viralLoop.conversions).toBeGreaterThan(0);

    // Campaigns list
    expect(Array.isArray(body.data.campaigns)).toBe(true);
    expect(body.data.campaigns.length).toBeGreaterThanOrEqual(6);

    // Recent conversions list
    expect(Array.isArray(body.data.recentConversions)).toBe(true);
    expect(body.data.recentConversions.length).toBeGreaterThan(0);
  });

  /* ── 2. Campaign Mutations & Lifecycle ───────────────────────────── */
  let createdCampaignId: number;

  test("rejects tenant from creating a marketing campaign", async () => {
    const req = new Request("http://localhost:3000/api/owner/marketing/campaigns", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tenantAdminToken}`,
      },
      body: JSON.stringify({
        name: "Unauthorized Campaign",
        channel: "google_ads",
        spend: 500,
      }),
    });
    const res = await handleApi(req, new URL(req.url));
    expect(res.status).toBe(403);
  });

  test("allows owner to create a new campaign via POST", async () => {
    const payload = {
      name: "TikTok & Reels Creative Finance Case Studies",
      channel: "meta_ads",
      status: "active",
      spend: 350,
      clicks: 520,
      impressions: 12500,
      leadsCount: 28,
      conversions: 6,
      targetUrl: "https://revzenta.com/demo",
      utmSource: "tiktok",
      utmMedium: "paid_social",
      utmCampaign: "reels_case_study_2026",
      notes: "Short-form video showcasing double-close HUD settlement.",
    };

    const req = new Request("http://localhost:3000/api/owner/marketing/campaigns", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify(payload),
    });
    const res = await handleApi(req, new URL(req.url));
    expect(res.status).toBe(201);

    const body: any = await res.json();
    expect(body.ok).toBe(true);
    expect(body.campaign).toBeDefined();
    expect(body.campaign.name).toBe(payload.name);
    expect(body.campaign.spend).toBe(350);
    expect(body.campaign.conversions).toBe(6);

    createdCampaignId = body.campaign.id;
    expect(createdCampaignId).toBeGreaterThan(0);
  });

  test("allows owner to update campaign status and spend via PATCH", async () => {
    expect(createdCampaignId).toBeDefined();

    const req = new Request(`http://localhost:3000/api/owner/marketing/campaigns/${createdCampaignId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        status: "paused",
        spend: 450,
        conversions: 8,
      }),
    });
    const res = await handleApi(req, new URL(req.url));
    expect(res.status).toBe(200);

    const body: any = await res.json();
    expect(body.ok).toBe(true);
    expect(body.campaign.status).toBe("paused");
    expect(body.campaign.spend).toBe(450);
    expect(body.campaign.conversions).toBe(8);
  });

  test("rejects tenant from updating a campaign via PATCH", async () => {
    const req = new Request(`http://localhost:3000/api/owner/marketing/campaigns/${createdCampaignId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tenantAdminToken}`,
      },
      body: JSON.stringify({
        status: "active",
      }),
    });
    const res = await handleApi(req, new URL(req.url));
    expect(res.status).toBe(403);
  });

  test("allows owner to delete a campaign via DELETE", async () => {
    expect(createdCampaignId).toBeDefined();

    const req = new Request(`http://localhost:3000/api/owner/marketing/campaigns/${createdCampaignId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    });
    const res = await handleApi(req, new URL(req.url));
    expect(res.status).toBe(200);

    const body: any = await res.json();
    expect(body.ok).toBe(true);

    // Verify campaign is deleted
    const check = db.query("SELECT * FROM marketing_campaigns WHERE id = ?").get(createdCampaignId);
    expect(check).toBeFalsy();
  });
});
