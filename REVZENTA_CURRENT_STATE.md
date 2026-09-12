# Revzenta — Current State Analysis & Architecture Audit
**Date:** September 11, 2026  
**Document Version:** 1.0.0  
**Repository:** `https://github.com/higherpowerc/Revzenta-CRM.git` (`branch: main`)  
**Target Platform:** Production-grade, Multi-Tenant SaaS CRM & Property Intelligence Platform

---

## Executive Summary

Revzenta is currently implemented as an integrated real estate wholesaling CRM and transaction platform. It originated as "Elevate CRM" and has undergone significant recent evolution toward the Revzenta brand, introducing deal calculators, wholesale transaction workflows, e-signatures, inbound webhooks, and third-party property enrichment via RentCast.

The current codebase is functional, compiles cleanly (`tsc --noEmit`), and builds successfully with Bun in under 300ms. However, it operates on a single-file SQLite database (`bun:sqlite`) rather than the target PostgreSQL database, relies on a single monolithic API handler (`server/api.ts`, 8,347 lines), enforces multi-tenant boundaries via manual string-concatenated SQL queries, lacks genuine AI/LLM integration (relying instead on deterministic heuristic formulas), and does not yet have an abstracted multi-source property intelligence layer or nationwide searchable property catalog.

This document details the current state, identifies critical security risks and technical debt, outlines the target architecture, and proposes a controlled, phased engineering roadmap.

---

## 1. Current Architecture Assessment

### 1.1 Frontend Architecture
* **Framework:** React 19 (`react@^19.1.0`, `react-dom@^19.1.0`) with TypeScript (`typescript@^7.0.2`).
* **Build System:** Bundled directly via Bun (`bun build ./index.html --outdir ./dist --minify`). No Vite or Webpack.
* **Routing & State:** 
  * Custom client-side state routing in `src/App.tsx` (`type View = "dashboard" | "leads" | "offers" | "buybox" | "onboarding" | "clients" | "calendar" | "appointments" | "tasks" | "finance" | "admin" | "documents" | "tickets" | "settings" | "buyers" | "connections" | "compliance"`).
  * URL hash routing (`#/login`, `#/signup`, `#/reset`, `#/website`) for public/auth entry points.
  * Internal state passed via React props and callbacks; no global state store (e.g., Redux, Zustand).
* **Styling & UI:**
  * Vanilla CSS architecture (`src/styles.css` ~148 KB, `src/website.css` ~20 KB) with CSS variables for dynamic theming (`DEFAULT_ACCENT` hex codes).
  * Responsive sidebar layout with sticky navigation and collapsible submenus.
  * Theme system (`ThemeToggle.tsx`, `theme.ts`) supporting dark and light themes.
  * Client-side PII privacy toggle (`src/pii.tsx`) utilizing browser `localStorage` and CSS blur filters to protect sensitive owner/seller data during demos or screen sharing.
* **Component Granularity:**
  * Highly monolithic components. For example:
    * `src/DealCalculatorModal.tsx` (~185 KB, 3,400+ lines)
    * `src/TransactionHub.tsx` (~176 KB, 3,200+ lines)
    * `src/Clients.tsx` (~157 KB, 3,100+ lines)
    * `src/App.tsx` (~66 KB, 1,540 lines)

### 1.2 Backend Architecture
* **Runtime:** Bun (`bun:serve` via `server/index.ts`).
* **Server Model:** Single-process unified server:
  * Serves bundled static frontend assets from `./dist`.
  * Handles JSON REST API routes under `/api/*`.
  * Directly renders public standalone HTML portals (`/sign/*`, `/sign-contract/*`, `/title-portal/*`, `/appointment/*`).
  * Serves dynamically generated PDF files (`/offer-pdf/*`, `/agreement-pdf/*`, `/contract-pdf/*`).
* **Controller Structure:**
  * `server/api.ts` acts as a monolithic request dispatcher (~8,347 lines) parsing `pathname` and HTTP methods with manual `if/else` checks.
  * No standard routing framework (such as Elysia, Hono, Express, or Fastify).
* **Auxiliary Backend Modules:**
  * `server/auth.ts`: Session tokens, password hashing, and role checks.
  * `server/db.ts`: SQLite connection and schema migrations.
  * `server/email.ts`: Transactional email delivery via Resend API.
  * `server/agreements.ts` & `server/contractPdf.ts` & `server/offerPdf.ts`: PDF generation and e-signature stamping via `pdf-lib`.
  * `server/propertyEnrichment.ts`: URL address parsing, RentCast API integration, comps extraction, and webhook payload normalization.
  * `server/stripe.ts`: Stripe customer, price, and payment link creation.

### 1.3 Database Architecture
* **Database Engine:** Embedded SQLite via `bun:sqlite` (`new Database(join(dataDir, "crm.db"))`).
* **Database Configuration:**
  * `PRAGMA journal_mode = WAL`
  * `PRAGMA foreign_keys = ON`
  * `PRAGMA busy_timeout = 3000`
* **Schema Management:**
  * Imperative, ad-hoc inline migrations executed at server boot in `server/db.ts`.
  * Uses `CREATE TABLE IF NOT EXISTS` and inspects `PRAGMA table_info` to run `ALTER TABLE ADD COLUMN`.
  * No formal migration tool (Prisma, Drizzle, Kysely, or Flyway).
* **Existing Tables:**
  1. `orgs`: Tenants/organizations (custom pipeline stages, branding accent, vertical config, Stripe billing tier, RentCast limits, webhook secret).
  2. `users`: User accounts (email, bcrypt password hash, org reference, role, tab permissions JSON).
  3. `clients`: Primary CRM records (contacts, sellers, property addresses, deal values, stages, DNC/lost flags, custom fields JSON).
  4. `tasks`: Action items linked to client and org.
  5. `invoices`: Manual invoicing records and statuses.
  6. `appointments`: Demo/sales calls and appointments with public action tokens.
  7. `provision_events`: Notifications for auto-provisioned workspaces when leads are sold.
  8. `password_resets`: Password reset tokens stored as SHA-256 hashes with millisecond epoch expiry.
  9. `tickets` & `ticket_replies`: Customer support ticketing system.
  10. `agreement_envelopes`: Native e-signature envelope tracking and audit trails.
  11. `offers`: Wholesale formal offers repository (Cash, SubTo, Seller Financing).
  12. `transactions`: Contract escrow pipeline (EMD, inspection deadlines, Title Company portal).
  13. `buyers`: End cash buyers directory with investment criteria.
  14. `onboarding_items`: Per-tier onboarding checklist items.
  15. `inbound_webhooks`: Audit log for incoming webhook payloads.
  16. `property_enrichment_cache`: 60-day cache of normalized address property specs & RentCast AVM valuations.
  17. `rentcast_api_usage_log`: Outbound API call counter for quota enforcement.
  18. `privacy_suppression_registry`: CCPA delete and TCPA DNC suppression registry.

### 1.4 Authentication & Authorization
* **Session Management:**
  * Signed session cookie (`elevate_session`) containing an HMAC-SHA256 signature over a Base64URL-encoded JSON payload (`{ uid, exp, imp? }`).
  * 7-day session TTL (`SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000`).
  * Session secret: Read from `SESSION_SECRET` env var, falling back to a generated secret saved in `data/.secret`.
* **Password Security:**
  * Bcrypt hashing using Bun's native `Bun.password.hash` (cost 10) and `Bun.password.verify`.
* **Tenant Isolation & Roles:**
  * Two primary roles: `admin` and `member`.
  * Platform Owner: Identified dynamically by `isOwnerOrg` (lowest ID org named "Revzenta") and `role === 'admin'`. Owner has cross-tenant impersonation capabilities (`/api/admin/impersonate`).
  * Granular Member Permissions: `users.permissions` stores JSON mapping tabs (`clients`, `tasks`, `finance`, `settings`, `support`) to edit/view rights.
  * Server-side authorization: Checked manually in each endpoint inside `server/api.ts` (e.g. verifying `org_id === session.org_id`).

### 1.5 API Structure
* Over 50 REST-like endpoints under `/api/*` responding with `application/json`.
* Direct SQL execution using prepared statements (`db.query(...).get(...)`, `db.query(...).all(...)`, `db.query(...).run(...)`).
* No data validation library (such as Zod, Valibot, or TypeBox); input sanitization is performed manually.
* Public external access points:
  * `/api/leads/webhook`: Inbound lead receiver authenticated via `x-webhook-secret` header or query parameter `key`.
  * `/api/public/sign-contract/:token`: Public e-signature submission for contracts.
  * `/api/public/title-update/:token`: Public status update for title companies.
  * `/sign/:token`: Client agreement signing web view.
  * `/title-portal/:token`: Title escrow officer web portal.

### 1.6 Deployment Configuration
* **Target Host:** Render Web Service defined in `render.yaml`:
  * `runtime: bun`
  * `plan: free`
  * `buildCommand: bun install && bun run build`
  * `startCommand: bun run start`
  * Environment variables: `PORT=3001`, `COOKIE_SECURE=true`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
* **Containerization:** `Dockerfile` is present based on `oven/bun:latest`.

### 1.7 GitHub Configuration
* Git repository: `https://github.com/higherpowerc/Revzenta-CRM.git`
* Active branch: `main`
* Commit history: Focuses on wholesale CRM features, self-serve signup, Stripe checkout, branding updates, and Deal Calculators.
* CI/CD: No GitHub Actions workflows (`.github/workflows/`) currently configured.

### 1.8 Existing CRM Functionality
* **Real Estate Wholesale Workflow:**
  * Lead stages: Prospect, Intake, Kickoff, Build, Launch, Retainer (default) or Leads, Onboarding, Sold (owner), plus tenant-customizable pipelines.
  * Deal Underwriting: Creative deal analysis calculator (`dealUnderwriting.ts`) supporting Maximum Allowable Offer (MAO), Subject-To mortgage assumption, and Seller Financing amortizations.
  * Offer Repository: Formal PDF purchase offer generation and dispatch (`server/offerPdf.ts`).
  * Transaction Hub: PSA and assignment agreements, inspection clocks, EMD contingency tracking, and title company coordination (`server/contractPdf.ts`, `src/TransactionHub.tsx`).
  * Cash Buyer Matching: Buyer database with buy-box criteria (budget, locations, property strategies).
  * Webhook Lead Ingestion: Inbound lead capture from Zapier, Make, BatchLeads, etc.
  * Compliance & Suppression: CCPA deletion registry and DNC suppression list.

### 1.9 Existing AI Functionality
* **Current Status:** **ZERO actual AI / LLM integration.**
* The "AI Buy Box Matcher" (`src/buyBoxUtils.ts`) is a purely deterministic heuristic function (`evaluateMatch`) comparing property price against buyer max budget, matching county strings, and filtering tags.
* There are no Gemini, OpenAI, Claude, or other LLM SDKs installed, nor any natural language search or generative deal summary capabilities.

### 1.10 Existing Security Controls
* Bcrypt password hashing.
* HttpOnly cookie session management with optional Secure flag.
* Address URL extraction SSRF protections: restricts real estate URLs to whitelisted domains (`zillow.com`, `redfin.com`, `realtor.com`, `trulia.com`, `homes.com`) and blocks loopback/private IPv4 subnets.
* Security HTTP headers set globally: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `X-Robots-Tag: noindex, nofollow`.
* PII blurring mechanism on frontend.

### 1.11 Existing Environment Variables
* `ADMIN_EMAIL`, `ADMIN_PASSWORD`: Seeding platform administrator.
* `PORT`: Listening port (default 3001).
* `SESSION_SECRET`: HMAC key for session cookies.
* `COOKIE_SECURE`: Flag for HTTPS-only cookies.
* `DATA_DIR`: Directory path for SQLite database file and generated PDFs.
* `RESEND_API_KEY`, `TEST_EMAIL_TO`, `RESEND_URL`: Email delivery configuration.
* `RENTCAST_API_KEY`: Fallback property enrichment key.
* `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`: Billing integration.

### 1.12 Existing Tests
* `test/api-e2e.sh`: 745 KB bash script running over 1,600 curl assertions across auth, multi-tenancy, and API endpoints.
* `test/render-smoke.sh`: 14 KB browser test verifying that the built bundle loads and mounts `#root` across unauthenticated, tenant, and owner states.
* No unit testing framework (e.g. `bun test`, Vitest) exists for isolated function/component verification.

---

## 2. Identified Problems, Security Risks & Technical Debt

### 2.1 Critical Architecture & Data Integrity Risks
1. **SQLite in Production on Render:**
   * SQLite stored in `./data/crm.db` will be wiped on every deployment or dyno restart on Render unless backed by a persistent disk. Render's free web service does not support persistent disks.
   * Concurrent writes under heavy multi-tenant load risk database lock contention (`busy_timeout = 3000`).
   * Requirement from Master Prompt: Must use **PostgreSQL** as the primary relational database.
2. **Fragile Multi-Tenant Isolation:**
   * Multi-tenancy is enforced solely by manually adding `WHERE org_id = ?` into raw SQL query strings across 8,300+ lines of `server/api.ts`.
   * A single omitted `org_id` check in any endpoint exposes one tenant's sensitive seller, lead, or financial data to another tenant.
   * Lack of Row-Level Security (RLS) or an enforced tenant-scoped data access layer.
3. **Monolithic Backend Controller (`server/api.ts`):**
   * Over 8,300 lines in a single file with hand-rolled routing (`if (pathname === ...)`).
   * Lack of structured request schema validation (e.g., Zod) increases risk of unhandled exceptions, malformed payloads, or type coercion vulnerabilities.

### 2.2 Property Intelligence & Data Provider Limitations
1. **Coupled Single-Provider Architecture:**
   * Property lookups directly invoke RentCast (`server/propertyEnrichment.ts`) without an abstraction interface.
   * If RentCast changes its API, fails, or hits rate limits, the property enrichment system has no failover provider.
2. **Lack of a Nationwide Property Data Repository:**
   * Property records only exist as client leads (`clients` table).
   * There is no standalone `properties` entity capable of storing parcel data, APNs, physical characteristics, equity, mortgages, tax history, and distressed signals across millions of records.
3. **No Natural Language Property Search:**
   * Search is currently limited to client table text matching.

### 2.3 AI & Intelligence Deficits
1. **Misleading "AI" Labeling:**
   * The "AI Buy Box Matcher" uses simple arithmetic and string comparisons. There is no machine learning or generative AI model running.
2. **Missing Product Vision AI Capabilities:**
   * No AI assistant for deal analysis, lead scoring explanations, automated outreach generation, or natural language query parsing.
   * No AI Development Command Center for system diagnostics, log review, or health checks.

---

## 3. Recommended Target Architecture

```
+-------------------------------------------------------------------------+
|                              REVZENTA UI                                |
|   React 19 + TypeScript + Modular Component Architecture (Tailwind/CSS)  |
|  [CRM Views] [Property Intel Search] [Deal Calculator] [AI Assistant]   |
+------------------------------------+------------------------------------+
                                     | (REST / Streaming APIs)
                                     v
+-------------------------------------------------------------------------+
|                         APPLICATION SERVER (BUN)                        |
|  Modular Routing (Elysia / Hono / Router) + Zod Schema Validation       |
|                                                                         |
|  +-----------------+  +-------------------+  +-----------------------+  |
|  | Auth & Security |  | CRM Business Core |  | Property Intel Engine |  |
|  | RBAC & TenantCtx|  | Leads/Deals/Offers|  | Search & Normalization|  |
|  +-----------------+  +-------------------+  +-----------------------+  |
|           |                     |                        |              |
|  +-----------------+  +-------------------+  +-----------------------+  |
|  | AI Assistant    |  | Billing & Usage   |  | Data Provider Layer   |  |
|  | (Gemini SDK)    |  | (Stripe Plans)    |  | RentCast/ATTOM/Public |  |
|  +-----------------+  +-------------------+  +-----------------------+  |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                       POSTGRESQL RELATIONAL DATABASE                    |
|    Row-Level Security (RLS) + Indexed Parcel/APN/Address Search         |
|                                                                         |
|  [organizations]  [users]      [contacts]    [properties]               |
|  [property_owners][leads]      [deals]       [saved_searches]           |
|  [data_sources]   [audit_logs] [usage_meter] [compliance_registry]      |
+-------------------------------------------------------------------------+
```

### Key Architectural Tenets:
1. **Database Migration to PostgreSQL:**
   * Adopt PostgreSQL (managed on Render, Supabase, Neon, or Railway).
   * Implement strict foreign keys, specialized indexes (B-tree, GIN for search, GiST for geo coordinates).
   * Enforce tenant isolation at the database session or query layer.
2. **Data Provider Abstraction Layer:**
   * Implement standard interfaces (`IPropertyDataProvider`, `IOwnerDataProvider`, `ITaxDataProvider`, `ISalesDataProvider`).
   * Normalize provider responses into Revzenta internal property schema.
   * Multi-source tracking with confidence scoring, timestamping, and deterministic conflict resolution.
3. **First-Class Property Intelligence System:**
   * Dedicated `properties`, `property_owners`, `property_financials`, `property_deeds`, and `property_distress` models.
   * Support nationwide parcel identification (APN, County, State, Lat/Lng).
   * Fast indexed search across price, equity, ownership duration, distress indicators, and geography.
4. **Authentic Gemini AI Integration:**
   * Integrate official Google GenAI SDK (`@google/genai`).
   * Power natural language structured search translation ("Find absentee owners in Maricopa County with >40% equity").
   * Property deal analysis ("What stands out about this property?").
   * Explainable Opportunity Score engine ("Opportunity Score: 87/100 — High equity, 15yr ownership, out-of-state owner").
   * AI Dev Command Center for system diagnostics, log audits, and admin management.

---

## 4. Proposed Phased Engineering Roadmap

To satisfy **Section 2 (Core Principle)** — building incrementally without disrupting working functionality:

| Phase | Title | Primary Focus & Deliverables | Verification Strategy |
|---|---|---|---|
| **Phase 0** | **Baseline & Safety Harness** | Modularize `server/api.ts` into discrete controllers (`routes/auth.ts`, `routes/clients.ts`, `routes/offers.ts`, etc.); introduce Zod validation; establish automated unit & API test runners in CI/CD. | All 1,600+ e2e tests in `test/api-e2e.sh` pass; `tsc --noEmit` clean; `bun run build` clean. |
| **Phase 1** | **PostgreSQL & Multi-Tenant Data Layer** | Setup PostgreSQL schema; implement database migration framework (e.g. Drizzle or Kysely with PostgreSQL adapter); migrate from SQLite to PostgreSQL while preserving SQLite fallback for local offline dev; verify tenant isolation. | Automated multi-tenant leak tests; verify data migration script; test on Render PostgreSQL. |
| **Phase 2** | **Data Provider Abstraction Layer** | Build `DataProvider` interface architecture (`PropertyDataProvider`, `OwnerDataProvider`, `TaxDataProvider`); refactor RentCast into `RentCastProvider`; implement multi-source conflict resolution & source tracking. | Provider unit tests; mock provider fixtures; address normalization tests. |
| **Phase 3** | **Property Intelligence & Nationwide Schema** | Implement core `properties`, `property_owners`, `property_financials`, `saved_searches` tables with indexing (APN, Address, County, Equity, Distressed flags); build Advanced Property Search API & UI filters. | Search query benchmarks (10k+ mocked properties); indexing verification; search UI tests. |
| **Phase 4** | **Gemini AI Assistant & Intelligent Scoring** | Integrate Gemini API via `@google/genai`; implement Natural Language Search parser; create Revzenta Opportunity Score engine with explainable breakdown; property deal analysis card on Property Detail view. | Prompt regression tests; structured JSON output validation; score explanation tests. |
| **Phase 5** | **AI Development Command Center & Observability** | Build authenticated internal developer dashboard for application health, structured log inspection, database diagnostics, and deployment monitoring without secret exposure. | Admin authorization tests; secret sanitization tests; healthcheck endpoint tests. |
| **Phase 6** | **Production Hardening & Render Deployment** | Configure staging/production Render environments with PostgreSQL; enforce rate limiting, CSRF protection, and audit logging; perform security penetration and compliance verification. | Render smoke testing; security audit; zero PII leakage verification. |

---

## 5. Dependencies & Technical Stack

* **Current Runtime:** Bun (v1.2+)
* **Current Core Libraries:** `react@19.1.0`, `react-dom@19.1.0`, `pdf-lib@1.17.1`, `stripe@22.5.0`
* **Target Added Dependencies:**
  * Database: `postgres` or `@neondatabase/serverless` / `pg` with `drizzle-orm` (or `kysely`)
  * Validation: `zod`
  * AI: `@google/genai`
  * Testing: `bun:test` for unit tests alongside existing bash test suites
  * Security: `helmet`-equivalent header hardening, rate limiting middleware

---

## 6. Unknowns Requiring Human Decisions

Before executing Phase 1 (PostgreSQL migration) and Phase 2/3 (Property Intelligence Layer), the following architectural decisions require confirmation from the Lead Architect / Product Owner:

1. **Target PostgreSQL Provider on Render:**
   * Should Revzenta utilize a managed **Render PostgreSQL** database instance, or an external serverless PostgreSQL provider (such as Neon, Supabase, or AWS RDS Aurora)?
2. **Dual-Database Support during Transition:**
   * Should the database layer support dual drivers (SQLite for local offline development, PostgreSQL for staging/production) via a unified query builder (e.g. Drizzle ORM), or switch 100% to PostgreSQL across all environments?
3. **Authorized Real Estate Data Providers:**
   * In addition to RentCast, which licensed commercial providers (e.g., ATTOM Data Solutions, DataTree/First American, Estated, BatchData) are targeted for integration in the property abstraction layer?
4. **Gemini API Model Tier:**
   * For the customer-facing AI Assistant and Natural Language Search, should Revzenta standardize on `gemini-2.5-flash` for high-throughput low-latency tasks, with `gemini-2.5-pro` for complex deal analysis and underwriting?
5. **Preservation of Existing Wholesaling Features:**
   * Confirm that all existing wholesale creative finance features (MAO calculators, SubTo underwriting, formal offer PDF generation, Title Portal, and PSA contract e-signatures) should be preserved exactly as first-class CRM modules within Revzenta.

---
*End of Report — Awaiting approval to proceed with Phase 0/Phase 1 execution.*
