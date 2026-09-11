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
import { createServer as createViteServer } from "vite";

/**
 * Revzenta CRM — Node.js Express + Vite server:
 * serves the JSON API under /api, public document/sign endpoints, and the React frontend via Vite in dev / dist in prod.
 */

const PORT = 3000;
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

// Boot-time signed-client backfill:
try {
  const advanced = backfillSignedClients(db);
  if (advanced > 0) {
    console.log(`[crm] Signed-client backfill: advanced ${advanced} record(s) to their terminal stage.`);
  }
} catch (err) {
  console.error("[crm] Signed-client backfill failed (continuing boot):", err);
}

async function nodeReqToWebRequest(req: express.Request): Promise<Request> {
  const protocol = req.protocol || "http";
  const host = req.get("host") || `localhost:${PORT}`;
  const fullUrl = new URL(req.originalUrl || req.url, `${protocol}://${host}`);

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      for (const val of v) headers.append(k, val);
    } else {
      headers.set(k, v);
    }
  }

  let body: Buffer | undefined = undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    if (chunks.length > 0) {
      body = Buffer.concat(chunks);
    }
  }

  return new Request(fullUrl.toString(), {
    method: req.method,
    headers,
    body,
    ...(body ? { duplex: "half" } : {}),
  } as RequestInit);
}

async function sendWebResponse(webRes: Response, res: express.Response): Promise<void> {
  res.status(webRes.status);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");

  webRes.headers.forEach((value, key) => {
    const lk = key.toLowerCase();
    if (lk === "set-cookie") {
      const getSetCookie = (webRes.headers as any).getSetCookie;
      if (typeof getSetCookie === "function") {
        res.setHeader("set-cookie", getSetCookie.call(webRes.headers));
      } else {
        res.setHeader("set-cookie", value);
      }
    } else {
      res.setHeader(key, value);
    }
  });

  if (webRes.body) {
    const buf = Buffer.from(await webRes.arrayBuffer());
    res.send(buf);
  } else {
    res.end();
  }
}

async function startServer() {
  const app = express();

  // Handle all API, sign, document, and custom endpoints
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
    console.log(`[crm] Database: ${process.env.DATA_DIR ?? join(import.meta.dirname ?? process.cwd(), "..", "data")}/crm.db`);
  });
}

startServer().catch((err) => {
  console.error("[crm] Failed to start server:", err);
  process.exit(1);
});
