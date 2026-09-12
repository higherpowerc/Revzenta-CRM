import express from "express";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { handleApi } from "./api";
import { ensureAdmin } from "./auth";
import { renderSignPage, readAgreementPdf, backfillSignedClients, backfillBrandRename } from "./agreements";
import { renderConfirmPage, renderReschedulePage } from "./appointmentPages";
import { readOfferPdf } from "./offerPdf";
import { readContractPdf, generateContractPdf, storeContractPdf } from "./contractPdf";
import { renderContractSignPage, renderTitlePortalPage } from "./transactionPages";
import { db } from "./db";
import { getDatabaseConfig, initPostgresSchema } from "./db/connection";
import { startDistressMonitor, stopDistressMonitor } from "./jobs/distressMonitor";
import { createServer as createViteServer } from "vite";

/**
 * Revzenta CRM — Node.js Express + Vite server:
 * serves the JSON API under /api, public document/sign endpoints, and the React frontend via Vite in dev / dist in prod.
 */

const PORT = Number(process.env.PORT ?? 3001);
const DIST_DIR = join(import.meta.dirname ?? process.cwd(), "..", "dist");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
};

// If PostgreSQL is configured via DATABASE_URL, initialize & verify schema.
const dbConfig = getDatabaseConfig();
if (dbConfig.isPostgres) {
  try {
    const pgInit = await initPostgresSchema();
    console.log(`[crm] ${pgInit.message}`);
  } catch (err) {
    console.error("[crm] PostgreSQL initialization failed:", err);
  }
}

// Boot-time branding backfill:
try {
  const b = backfillBrandRename(db);
  if (b.renamed) {
    console.log(
      `[crm] Branding backfill: owner org renamed to Revzenta (agreement template ${b.templates > 0 ? "re-brushed" : "already clean"}).`,
    );
  }
} catch (err) {
  console.error("[crm] Branding backfill failed (continuing boot):", err);
}

// Seed the admin account at startup if ADMIN_EMAIL / ADMIN_PASSWORD are set.
const seed = await ensureAdmin();
console.log(seed.message);

// Auto-backfill existing signed agreements into formal clients
try {
  const backfilled = backfillSignedClients(db);
  if (backfilled > 0) {
    console.log(`[crm] Backfilled ${backfilled} existing signed agreement(s) into formal clients.`);
  }
} catch (err) {
  console.error("[crm] Backfill signed clients failed (continuing boot):", err);
}

// Convert Express Request to Web Standard Request for handleApi
async function nodeReqToWebRequest(req: express.Request): Promise<Request> {
  const protocol = req.protocol || "http";
  const host = req.get("host") || `localhost:${PORT}`;
  const fullUrl = `${protocol}://${host}${req.originalUrl || req.url}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }

  let body: any = undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    if (req.body !== undefined && req.body !== null) {
      if (typeof req.body === "string" || Buffer.isBuffer(req.body)) {
        body = req.body;
      } else if (typeof req.body === "object") {
        const ct = (req.headers["content-type"] as string) || "";
        if (ct.includes("json") || Object.keys(req.body).length > 0) {
          body = JSON.stringify(req.body);
          if (!headers.has("content-type")) {
            headers.set("content-type", "application/json");
          }
        }
      }
    } else if (!req.readableEnded) {
      body = await new Promise<Buffer>((resolve) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        req.on("end", () => resolve(Buffer.concat(chunks)));
        req.on("error", () => resolve(Buffer.concat(chunks)));
      });
      if (body.length === 0) body = undefined;
    }
  }

  return new Request(fullUrl, {
    method: req.method,
    headers,
    body,
  });
}

// Send Web Standard Response back through Express Response
async function sendWebResponse(webRes: Response, res: express.Response) {
  res.status(webRes.status);
  webRes.headers.forEach((value, key) => {
    // Express res.setHeader can take array or string
    res.setHeader(key, value);
  });

  const arrayBuffer = await webRes.arrayBuffer();
  res.send(Buffer.from(arrayBuffer));
}

async function startServer() {
  const app = express();

  // Basic middleware
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Custom routing adapter to retain exact behavior of current APIs and page renderers
  app.use(async (req, res, next) => {
    const urlPath = req.path;
    const srv = {
      requestIP(_req: Request) {
        const addr = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
        return addr ? { address: addr } : null;
      },
    };

    if (req.method === "GET" && urlPath === "/robots.txt") {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send("User-agent: *\nDisallow: /\n");
      return;
    }

    if (urlPath.startsWith("/api/")) {
      try {
        const webReq = await nodeReqToWebRequest(req);
        const url = new URL(webReq.url);
        const webRes = await handleApi(webReq, url, srv);
        await sendWebResponse(webRes, res);
      } catch (err) {
        console.error("[crm] API error:", err);
        res.status(500).json({ ok: false, error: "Internal server error" });
      }
      return;
    }

    if (req.method === "GET" && urlPath.startsWith("/sign/")) {
      const token = decodeURIComponent(urlPath.slice("/sign/".length));
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
      const webRes = renderSignPage(token, ip);
      await sendWebResponse(webRes, res);
      return;
    }

    if (req.method === "GET" && urlPath.startsWith("/offer-pdf/")) {
      const pdfId = urlPath.slice("/offer-pdf/".length);
      const bytes = readOfferPdf(pdfId);
      if (!bytes) {
        res.status(404).send("Not found");
      } else {
        res.setHeader("Content-Type", MIME[".pdf"]);
        res.setHeader("Cache-Control", "private, max-age=3600");
        res.setHeader("Content-Disposition", `inline; filename="purchase-offer-${pdfId}.pdf"`);
        res.send(Buffer.from(bytes));
      }
      return;
    }

    if (req.method === "GET" && urlPath.startsWith("/agreement-pdf/")) {
      const pdfId = urlPath.slice("/agreement-pdf/".length);
      const bytes = readAgreementPdf(pdfId);
      if (!bytes) {
        res.status(404).send("Not found");
      } else {
        res.setHeader("Content-Type", MIME[".pdf"]);
        res.setHeader("Cache-Control", "private, max-age=3600");
        res.setHeader("Content-Disposition", `inline; filename="agreement-${pdfId}.pdf"`);
        res.send(Buffer.from(bytes));
      }
      return;
    }

    if (req.method === "GET" && urlPath.startsWith("/sign-contract/")) {
      const token = decodeURIComponent(urlPath.slice("/sign-contract/".length));
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
      const webRes = renderContractSignPage(token, ip);
      await sendWebResponse(webRes, res);
      return;
    }

    if (req.method === "GET" && urlPath.startsWith("/contract-pdf/")) {
      const pdfId = urlPath.slice("/contract-pdf/".length);
      let bytes = readContractPdf(pdfId);
      if (!bytes) {
        const tx = db.query("SELECT * FROM transactions WHERE contract_pdf_id = ?").get(pdfId) as any;
        if (tx) {
          try {
            const org = db.query("SELECT name FROM orgs WHERE id = ?").get(tx.org_id) as { name: string } | null;
            bytes = await generateContractPdf({
              contractType: tx.contract_type,
              propertyAddress: tx.property_address,
              sellerName: tx.seller_name,
              sellerEmail: tx.seller_email,
              sellerPhone: tx.seller_phone,
              buyerName: tx.buyer_name,
              buyerEmail: tx.buyer_email,
              buyerPhone: tx.buyer_phone,
              companyName: org?.name || "Revzenta Wholesale Biz",
              purchasePrice: tx.purchase_price,
              assignmentFee: tx.assignment_fee,
              earnestMoney: tx.earnest_money,
              emdDueDate: tx.emd_due_date,
              inspectionDays: tx.inspection_days,
              closingDate: tx.closing_date,
              titleCompany: tx.title_company_name,
              stateJurisdiction: tx.state_jurisdiction,
              signerName: tx.signer_name,
              signedAt: tx.signed_at,
              signerIp: tx.signer_ip,
              customTerms: tx.custom_terms,
            });
            storeContractPdf(bytes, pdfId);
          } catch (err) {
            console.error("[contract-pdf] On-demand fallback generation failed:", err);
          }
        }
      }
      if (!bytes) {
        res.status(404).send("Contract PDF not found");
      } else {
        res.setHeader("Content-Type", MIME[".pdf"]);
        res.setHeader("Cache-Control", "private, max-age=3600");
        res.setHeader("Content-Disposition", `inline; filename="contract-${pdfId}.pdf"`);
        res.send(Buffer.from(bytes));
      }
      return;
    }

    if (req.method === "GET" && urlPath.startsWith("/title-portal/")) {
      const token = decodeURIComponent(urlPath.slice("/title-portal/".length));
      const webRes = renderTitlePortalPage(token);
      await sendWebResponse(webRes, res);
      return;
    }

    if (req.method === "GET" && urlPath.startsWith("/appointment/")) {
      const rest = urlPath.slice("/appointment/".length);
      const slash = rest.indexOf("/");
      if (slash > 0) {
        const token = decodeURIComponent(rest.slice(0, slash));
        const action = rest.slice(slash + 1);
        if (action === "confirm") {
          const webRes = renderConfirmPage(token);
          await sendWebResponse(webRes, res);
          return;
        } else if (action === "reschedule") {
          const webRes = renderReschedulePage(token);
          await sendWebResponse(webRes, res);
          return;
        }
      }
    }

    // For all other routes, pass to Vite in dev or static serving in prod
    next();
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(DIST_DIR));
    app.get("*all", (_req, res) => {
      res.sendFile(join(DIST_DIR, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[crm] Revzenta CRM listening on http://localhost:${PORT}`);
    if (dbConfig.isPostgres) {
      const maskedConn = dbConfig.connectionString?.replace(/:[^:@]+@/, ":****@");
      console.log(`[crm] Database: PostgreSQL (${maskedConn})`);
    } else {
      console.log(`[crm] Database: SQLite (${process.env.DATA_DIR ?? join(import.meta.dirname ?? process.cwd(), "..", "data")}/crm.db)`);
    }

    // Start automated property distress monitor background worker
    startDistressMonitor(Number(process.env.DISTRESS_MONITOR_INTERVAL_MS || 15 * 60 * 1000));
  });
}

// Keep the process alive or gracefully stop background workers on SIGINT
process.on("SIGINT", () => {
  stopDistressMonitor();
  process.exit(0);
});

startServer().catch((err) => {
  console.error("[crm] Failed to start server:", err);
  process.exit(1);
});
