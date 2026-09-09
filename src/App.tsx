import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import Login from "./Login";
import ResetPassword from "./ResetPassword";
import Signup from "./Signup";
import SignupSuccess from "./SignupSuccess";
import Dashboard from "./Dashboard";
import Clients, { type Filter } from "./Clients";
import ClientsDirectory from "./ClientsDirectory";
import Calendar from "./Calendar";
import Appointments from "./Appointments";
import Tasks from "./Tasks";
import Buyers from "./Buyers";
import Finance from "./Finance";
import Admin from "./Admin";
import Documents from "./Documents";
import Tickets from "./Tickets";
import Settings from "./Settings";
import Offers from "./Offers";
import BuyBoxMatcher from "./BuyBoxMatcher";
import TransactionHub from "./TransactionHub";
import Connections from "./Connections";
import Compliance from "./Compliance";
import Website from "./Website";
import UpgradeGate from "./UpgradeGate";
import { api } from "./api";
import { DEFAULT_STAGES, TENANT_TABS, type TenantTab, type User, type PackageTier, normalizeTier, hasTierAccess, TIER_LABELS, TIER_SHORT_LABELS, TIER_BADGES } from "./types";
import revzentaLogo from "./assets/revzenta-logo.png";
import { initials } from "./bits";
import { PiiContext, PII_HIDDEN_KEY, blurPii, PiiEyeIcon, PiiEyeOffIcon } from "./pii";
import ThemeToggle from "./ThemeToggle";

/* Owner request 2026-08-14 — the single "Clients" tab splits into TWO:
 *   "leads"  → the pipeline view (stage chips, Active/Archived/All, stage
 *              actions, Manage stages) — today's Clients tab, reframed.
 *   "clients" → the independent directory of ALL clients (any stage, incl.
 *              archived), flat and alphabetically sorted.
 * Owner request 2026-08-15 — tab labels are unified across EVERY workspace:
 * the pipeline tab always reads "Leads" and the directory tab always reads
 * "Clients", for the owner and each client account alike (the member-org
 * "Clients"/"All clients" variant labels are gone).
 * Owner request 2026-08-15 — the OWNER workspace gains an "Onboarding" tab:
 * the owner's pipeline is a three-bucket split — Leads = the FIRST stage
 * (prospects), Onboarding = the MIDDLE stages (intake leads), Clients = the
 * terminal stage (sold). Client accounts (role=member) are unchanged: their
 * Leads tab keeps showing every stage except their terminal one. */
type View = "dashboard" | "leads" | "offers" | "buybox" | "onboarding" | "clients" | "calendar" | "appointments" | "tasks" | "finance" | "admin" | "documents" | "tickets" | "settings" | "buyers" | "connections" | "compliance";


/** 3k — the emailed reset link is `<appUrl>/#/reset?token=...`; pull the
 *  token out of the hash on boot so the login screen can render the
 *  reset-password form in place of the sign-in card. */
function resetTokenFromHash(): string | null {
  const h = window.location.hash;
  if (!h.startsWith("#/reset")) return null;
  const q = h.includes("?") ? h.slice(h.indexOf("?")) : "";
  const token = new URLSearchParams(q).get("token");
  return token && token.trim() ? token.trim() : null;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [booted, setBooted] = useState(false);
  const [view, setView] = useState<View>("dashboard");
  /** Owner request 2026-08-14 — deep-linked stage filter for the Leads view.
   *  The Dashboard's stage-card "View →" stores the stage name here and
   *  switches to the leads view; the nav "Leads" tab clears it so a normal
   *  tab visit opens the pipeline on "All". */
  const [leadsStage, setLeadsStage] = useState<string | null>(null);
  /** Owner request 2026-08-15 — same deep-link for the OWNER's Onboarding
   *  view (the middle pipeline stages). Kept separate from leadsStage so the
   *  two pipeline tabs never inherit each other's filter. */
  const [onboardingStage, setOnboardingStage] = useState<string | null>(null);
  /** Owner direction 2026-08-26 — deep-linked FILTER for the Leads view. The
   *  Dashboard's "Lost" card "View →" sets this to "lost" and switches to the
   *  Leads view, which opens on the Lost listing. A plain Leads-nav visit (and
   *  any stage deep-link) resets it to "active" so a normal tab visit opens
   *  the pipeline on Active. */
  const [leadsFilter, setLeadsFilter] = useState<Filter>("active");
  /** 3k — a reset token from the URL hash (`#/reset?token=…`), shown while
   *  the user is signed out. */
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState<boolean>(() => window.location.hash.startsWith("#/login"));
  const isWebsiteOrLegalHash = (h: string) => {
    const l = h.toLowerCase();
    return l.startsWith("#/website") || l.includes("privacy") || l.includes("terms") || l.includes("security") || l.includes("agreement");
  };
  const isSignupHash = (h: string) => h.startsWith("#/signup") && !h.startsWith("#/signup-success");
  const isSignupSuccessHash = (h: string) => h.startsWith("#/signup-success");

  const [viewingWebsite, setViewingWebsite] = useState<boolean>(() => isWebsiteOrLegalHash(window.location.hash));
  const [viewingSignup, setViewingSignup] = useState<boolean>(() => isSignupHash(window.location.hash));
  const [viewingSignupSuccess, setViewingSignupSuccess] = useState<boolean>(() => isSignupSuccessHash(window.location.hash));
  const [signupTier, setSignupTier] = useState<string>(() => {
    const h = window.location.hash;
    const q = h.includes("?") ? h.slice(h.indexOf("?") + 1) : "";
    return new URLSearchParams(q).get("tier") || "pro";
  });

  useEffect(() => {
    const onHash = () => {
      if (isSignupSuccessHash(window.location.hash)) {
        setViewingSignupSuccess(true);
        setViewingSignup(false);
        setShowLogin(false);
        setViewingWebsite(false);
      } else if (isSignupHash(window.location.hash)) {
        const q = window.location.hash.includes("?") ? window.location.hash.slice(window.location.hash.indexOf("?") + 1) : "";
        const t = new URLSearchParams(q).get("tier") || "pro";
        setSignupTier(t);
        setViewingSignup(true);
        setViewingSignupSuccess(false);
        setShowLogin(false);
        setViewingWebsite(false);
      } else if (window.location.hash.startsWith("#/login")) {
        setShowLogin(true);
        setViewingSignup(false);
        setViewingSignupSuccess(false);
        setViewingWebsite(false);
      } else if (isWebsiteOrLegalHash(window.location.hash)) {
        setShowLogin(false);
        setViewingSignup(false);
        setViewingSignupSuccess(false);
        setViewingWebsite(true);
      } else {
        setViewingWebsite(false);
        setViewingSignup(false);
        if (!window.location.hash.startsWith("#/signup-success")) setViewingSignupSuccess(false);
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  /* Phase 3d — owner impersonation. True while the owner's session is swapped
     into a client tenant's workspace; drives the banner in the shell. */
  const [impersonating, setImpersonating] = useState(false);
  const [returning, setReturning] = useState(false);

  /* Global privacy eye (owner request 2026-08-14): one toggle in the top nav,
     visible on EVERY screen of EVERY workspace, that blurs all PII (client/
     company names, phone, email, address). Default off; the choice persists
     per browser via localStorage (same pattern as the Dashboard money eye —
     that one stays Dashboard-only and untouched). */
  const [piiHidden, setPiiHidden] = useState<boolean>(() => {
    try {
      return localStorage.getItem(PII_HIDDEN_KEY) === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(PII_HIDDEN_KEY, piiHidden ? "1" : "0");
    } catch {
      /* storage unavailable (private mode) — the toggle just won't persist */
    }
  }, [piiHidden]);
  const piiTitle = piiHidden ? "Show client details" : "Hide client details";

  useEffect(() => {
    /* Owner bug 2026-08-27 (§67): a 401 from any API call (including the boot
     * /api/auth/me when signed out) signs the shell back out, but it must NOT
     * sabotage a password reset. The old handler wiped `resetToken`
     * unconditionally — a signed-out visitor opening the emailed
     * `#/reset?token=…` link lost the token to this handler the moment the
     * boot me() 401'd, and got the login card instead of the reset form. Now:
     * a token still live in the URL hash survives (the emailed link IS the
     * credential), and a dying session also leaves a #/reset hash alone. */
    const onUnauthorized = () => {
      setUser((u) => {
        if (u && !window.location.hash.startsWith("#/reset")) window.location.hash = "";
        return null;
      });
      setImpersonating(false);
      if (!resetTokenFromHash()) setResetToken(null);
    };
    window.addEventListener("crm:unauthorized", onUnauthorized);
    api
      .me()
      .then((res) => {
        setUser(res.user);
        setImpersonating(res.impersonating === true);
      })
      .catch(() => setUser(null))
      .finally(() => setBooted(true));
    setResetToken(resetTokenFromHash());
    return () => window.removeEventListener("crm:unauthorized", onUnauthorized);
  }, []);

  // Per-tenant branding (Phase 3a): once signed in, the shell (and the
  // document title) carries the tenant's own org name + accent color.
  const orgName = user?.orgName?.trim() || "";
  /** Owner live-test 2026-08-28 (128c3ad7): the nav shows a NAME, not the raw
   *  email — "Owner" for the owner session; a display name when the account
   *  carries one (additive User.name); the email only as the tenant-user
   *  fallback. The email stays on the nav-user span's title (hover) and PII
   *  blur is unchanged. */
  const navUserName = user?.name?.trim() || (user?.isOwner ? "Owner" : user?.email ?? "");
  useEffect(() => {
    document.title = orgName ? `${orgName} — CRM` : "Revzenta — CRM";
  }, [orgName]);

  /* Branding (accent color): drives --accent on the app root.
     Dashboard KPI colors are driven by the theme (Light/Dark mode) to ensure
     complete legibility and contrast across all pages without manual adjustment. */
  const brandStyle = useMemo<CSSProperties | undefined>(
    () => ({
      "--accent": user?.accentColor && user.accentColor !== "#d6ff3f" ? user.accentColor : "#00a89f",
      "--brand-teal": "#00a89f",
      "--brand-navy": "#124690",
    } as CSSProperties),
    [user?.accentColor],
  );

  const stages = useMemo(() => user?.stages ?? DEFAULT_STAGES, [user?.stages]);

  /* Owner-org detection for terminology (owner direction 2026-08-14): the
     owner workspace is the org whose members hold the admin role — exactly
     the org where the Admin tab appears. It calls its pipeline records
     "leads"; tenant orgs (role=member) keep "clients" for their customers.
     Branding rename (2026-08-18): the server reports owner status as
     user.isOwner (its isOwnerSession — owner org AND role='admin'), so this
     no longer depends on the org NAME string. Tenant team members with
     stored role='admin' stay in their client account's workspace and never
     inherit the owner cockpit (server sends isOwner:false for them). Also
     gates the owner-only Onboarding tab (owner direction 2026-08-15). */
  const isOwnerOrg = !impersonating && user?.isOwner === true;

  /** Business Type Preview mode (owner only) — allows the owner to view and explore
   *  each business type CRM (B2B, B2C, Wholesale Real Estate) directly from the side menu. */
  const [previewVertical, setPreviewVertical] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  /** Whether the owner is in their cockpit vs previewing a business type CRM */
  const isOwnerCockpit = isOwnerOrg && !previewVertical;

  /* Wholesale Biz custom menu (owner direction 2026-09-04) — the account's
     business type (orgs.vertical_key, delivered on the session user as
     verticalKey) switches the client workspace to the wholesale tab set.
     Synchronously derived so owner impersonation switches immediately. */
  const verticalKey = previewVertical || (user?.verticalKey ?? "");
  const isWholesale = Boolean(
    previewVertical === "wholesalebiz" || (
      !isOwnerOrg && (
        verticalKey === "wholesalebiz" ||
        verticalKey === "wholesale" ||
        verticalKey.toLowerCase().includes("wholesale") ||
        (user?.orgName && user.orgName.toLowerCase().includes("wholesale")) ||
        (orgName && orgName.toLowerCase().includes("wholesale"))
      )
    )
  );

  /** Package tier preview toggle (allows owner to test Starter / Pro / Scale behavior) */
  const [previewTier, setPreviewTier] = useState<PackageTier | null>(null);

  /** Package tier outfitting: starter ($24.99/mo), pro ($59.99/mo), scale ($79/mo).
   *  Owner cockpit has unconstrained superadmin access (scale).
   *  Subscribers read their org's package tier from user.tier. */
  const effectiveTier: PackageTier =
    previewTier ||
    normalizeTier(isOwnerCockpit || user?.isOwner ? "scale" : (user?.tier || "pro"));

  /* Team users per client account (owner request 2026-08-14) — tab gating.
     Restricted members carry per-tab grants on user.permissions; org admins
     (stored role='admin' OR the account's original owner login — the server
     reports this as user.isOrgAdmin) bypass everything, and the OWNER is
     never permission-restricted. The server enforces all of this on every
     route; these helpers only drive the nav and the edit affordances (UX). */
  const canSeeTab = (tab: TenantTab): boolean => {
    if (isOwnerOrg) return true;
    if (user?.isOrgAdmin === true) return true;
    if (user?.permissions?.[tab] !== undefined) return true;
    // Backwards compatibility for users with legacy 5-tab grants
    if (tab === "dashboard" || tab === "appointments") return true;
    if (isWholesale) {
      if (
        (tab === "offers" || tab === "documents" || tab === "buybox" || tab === "investors") &&
        user?.permissions?.["clients"] !== undefined
      ) {
        return true;
      }
      if (tab === "connections" && user?.permissions?.["settings"] !== undefined) {
        return true;
      }
    }
    return false;
  };
  const canEditTab = (tab: TenantTab): boolean => {
    if (isOwnerOrg) return true;
    if (user?.isOrgAdmin === true) return true;
    if (user?.permissions?.[tab] !== undefined) return user?.permissions?.[tab]?.edit === true;
    if (isWholesale) {
      if (
        (tab === "offers" || tab === "documents" || tab === "buybox" || tab === "investors") &&
        user?.permissions?.["clients"] !== undefined
      ) {
        return user?.permissions?.["clients"]?.edit === true;
      }
      if (tab === "connections" && user?.permissions?.["settings"] !== undefined) {
        return user?.permissions?.["settings"]?.edit === true;
      }
    }
    return false;
  };
  /* If the current view is a tab the session user can no longer access
     (e.g. an admin revoked it mid-session), fall back to the Dashboard
     instead of rendering a view whose API calls would 403. */
  const viewAllowed = (v: View): boolean => {
    switch (v) {
      case "dashboard":
        return canSeeTab("dashboard");
      case "leads":
        return canSeeTab("clients");
      case "offers":
        return canSeeTab("offers");
      case "buybox":
        return canSeeTab("buybox");
      case "clients":
        return isWholesale ? canSeeTab("investors") : canSeeTab("clients");
      case "calendar":
        return isOwnerCockpit;
      case "appointments":
        return canSeeTab("appointments");
      case "tasks":
        return canSeeTab("tasks");
      case "finance":
        return canSeeTab("finance");
      case "tickets":
        return canSeeTab("support");
      case "settings":
        return canSeeTab("settings");
      case "onboarding":
      case "appointments":
        return false;
      case "admin":
        return isOwnerCockpit;
      case "documents":
        return isOwnerCockpit || canSeeTab("documents");
      case "buyers":
        return isWholesale && (canSeeTab("investors") || canSeeTab("tasks"));
      case "connections":
        return isWholesale && canSeeTab("connections");
      case "compliance":
        return isWholesale ? (canSeeTab("settings") || canSeeTab("clients")) : isOwnerCockpit;
    }
  };
  const effectiveView: View = viewAllowed(view) ? view : "dashboard";
  /* Wholesale Biz custom menu (owner 2026-09-04): if the signed-in account's
     vertical changed while a wholesale-hidden view was open (or a stale
     wholesale-only view is somehow active), fall back to the Dashboard. */
  const viewWholesaleAllowed = (v: View): boolean => {
    if (!isWholesale) {
      return v !== "buyers" && (isOwnerCockpit ? true : v !== "documents") && v !== "offers" && v !== "buybox" && v !== "connections";
    }
    return !(v === "appointments" || v === "finance");
  };
  const effectiveViewFinal: View = viewWholesaleAllowed(effectiveView) ? effectiveView : "dashboard";

  const activeTabLabel = useMemo(() => {
    if (previewVertical === "wholesalebiz") {
      return "Wholesale Real Estate (Preview)";
    }
    if (isOwnerCockpit) {
      switch (effectiveViewFinal) {
        case "dashboard": return "Dashboard & ROI";
        case "finance": return "Revenue & Stripe";
        case "clients": return "Subscribers";
        case "leads": return "Sales Leads";
        case "tasks": return "Tasks";
        case "tickets": return "Support Tickets";
        case "documents": return "Signed Agreements";
        case "admin": return "Template & Admin";
        case "compliance": return "Compliance & DNC";
        case "settings": return "Settings";
        default: return "Menu";
      }
    }
    if (isWholesale) {
      switch (effectiveViewFinal) {
        case "dashboard": return "Dashboard";
        case "leads": return "Creative Hub";
        case "documents": return "Transaction Hub";
        case "offers": return "Offers Repository";
        case "buybox": return "Buy Box";
        case "clients": return "Investors";
        case "connections": return "Connections";
        case "tasks": return "Tasks";
        case "tickets": return "Support";
        case "settings": return "Settings";
        case "compliance": return "Compliance & DNC";
        default: return "Menu";
      }
    }
    switch (effectiveViewFinal) {
      case "dashboard": return "Dashboard";
      case "leads": return "Leads";
      case "clients": return "Clients";
      case "appointments": return "Appointments";
      case "tasks": return "Tasks";
      case "tickets": return "Support";
      case "finance": return "Finance";
      case "settings": return "Settings";
      default: return "Menu";
    }
  }, [previewVertical, isOwnerCockpit, effectiveViewFinal, isWholesale]);

  const activeTabIcon = useMemo(() => {
    if (previewVertical === "wholesalebiz") return "🏠";
    if (isOwnerCockpit) {
      switch (effectiveViewFinal) {
        case "dashboard": return "📊";
        case "finance": return "💰";
        case "clients": return "👥";
        case "onboarding": return "🚀";
        case "leads": return "🎯";
        case "appointments": return "📅";
        case "tasks": return "📋";
        case "tickets": return "🎫";
        case "documents": return "📑";
        case "admin": return "📝";
        case "compliance": return "🛡️";
        case "settings": return "⚙️";
        default: return "☰";
      }
    }
    if (isWholesale) {
      switch (effectiveViewFinal) {
        case "dashboard": return "📊";
        case "leads": return "🏘️";
        case "offers": return "📑";
        case "documents": return "🤝";
        case "buybox": return "🎯";
        case "clients": return "💼";
        case "connections": return "🔌";
        case "tasks": return "📋";
        case "tickets": return "🎫";
        case "settings": return "⚙️";
        case "compliance": return "🛡️";
        default: return "☰";
      }
    }
    return "☰";
  }, [previewVertical, isOwnerCockpit, effectiveViewFinal, isWholesale]);

  const handleLogout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* session already gone is fine */
    }
    setUser(null);
    setImpersonating(false);
    setView("dashboard");
    setResetToken(null);
    setLeadsStage(null);
    setOnboardingStage(null);
    setLeadsFilter("active");
  }, []);

  /* Phase 3d — "View account" from the owner's Clients tab (Accounts panel):
     the server swaps this session into the tenant's member user. Land on that
     tenant's dashboard — their nav, data, branding and role rules now apply as
     if the owner had logged in as them. */
  const handleImpersonate = useCallback(async (orgId: number) => {
    const res = await api.adminImpersonate(orgId);
    setUser(res.user);
    setImpersonating(true);
    setView("dashboard");
  }, []);

  /* Phase 3d — banner "Return to my dashboard": swap back to the owner's own
     session and land on the Admin view where they started. */
  const handleImpersonateReturn = useCallback(async () => {
    setReturning(true);
    try {
      const res = await api.impersonateReturn();
      setUser(res.user);
      setImpersonating(false);
      setView("admin");
    } catch {
      // Session round-trip failed — reload so /api/auth/me reports the truth.
      window.location.reload();
    } finally {
      setReturning(false);
    }
  }, []);

  /* Owner request 2026-08-14/15 — open the pipeline tab that owns a stage,
     optionally pre-filtered to it. Called by the Dashboard's stage-card
     "View →" (with the stage name) and its empty-state CTA (no stage →
     Leads "All"). Routing is POSITIONAL over the org's ordered stages
     (rename-safe, never hardcoded names):
       stages[0]            → Leads tab, pre-filtered to that stage
       a MIDDLE stage       → OWNER: Onboarding tab, pre-filtered; tenant:
                              their single Leads tab, pre-filtered
       the TERMINAL stage   → Clients tab (sold customers live in the
                              directory — the pipeline has no chip for them)
     The nav tabs call setView directly and clear both stage filters so a
     plain tab visit never inherits a stale deep-link. */
  const goToStage = useCallback(
    (stage?: string) => {
      setOnboardingStage(null);
      if (!stage) {
        setLeadsStage(null);
        setLeadsFilter("active");
        setView("leads");
        return;
      }
      const idx = stages.indexOf(stage);
      if (idx < 0) {
        setLeadsStage(null);
        setLeadsFilter("active");
        setView("leads");
        return;
      }
      if (idx === stages.length - 1) {
        setLeadsStage(null);
        setLeadsFilter("active");
        setView("clients");
        return;
      }
      if (isOwnerOrg && idx > 0) {
        setOnboardingStage(stage);
        setView("onboarding");
        return;
      }
      setLeadsStage(stage);
      setLeadsFilter("active");
      setView("leads");
    },
    [stages, isOwnerOrg],
  );

  /* Owner direction 2026-08-26 — the Dashboard "Lost" card's "View →".
     Switches to the owner's Leads view with the "Lost" filter active (the
     Lost listing). Owner-only (the card is owner-only), so this is only ever
     reached from the owner dashboard. */
  const goToLost = useCallback(() => {
    setLeadsStage(null);
    setOnboardingStage(null);
    setLeadsFilter("lost");
    setView("leads");
  }, []);

  if (!booted) {
    return (
      <div className="splash" role="status" aria-label="Loading Revzenta">
        <div className="splash-inner">
          <div className="splash-ring">
            <span className="splash-mark">R</span>
          </div>
          <div className="splash-name">
            Revzenta
          </div>
          <div className="splash-sub">CRM</div>
        </div>
      </div>
    );
  }

  /* Owner bug 2026-08-27 (§67): the reset page renders whenever a live
   * `#/reset?token=…` token is in the URL — SIGNED-IN OR NOT. The branch used
   * to sit inside `if (!user)`, so an authenticated user opening the emailed
   * link landed in the app shell and never saw the form. Onward routing:
   *  • signed out → "Sign in" after a successful reset clears the hash and
   *    returns to the normal login card;
   *  • signed in  → back into the app shell (the reset changed only a
   *    password; their session is untouched). */
  if (resetToken) {
    return (
      <ResetPassword
        token={resetToken}
        onDone={() => {
          window.location.hash = "";
          setResetToken(null);
        }}
      />
    );
  }

  if (!user) {
    if (viewingSignupSuccess) {
      return (
        <SignupSuccess
          onDone={(u) => {
            setUser(u);
            setViewingSignupSuccess(false);
            window.location.hash = "";
          }}
          onSignIn={() => {
            setViewingSignupSuccess(false);
            setShowLogin(true);
            window.location.hash = "#/login";
          }}
        />
      );
    }
    if (viewingSignup) {
      return (
        <Signup
          initialTier={signupTier}
          onSuccess={(u) => {
            setUser(u);
            setViewingSignup(false);
            window.location.hash = "";
          }}
          onSignIn={() => {
            setViewingSignup(false);
            setViewingSignupSuccess(false);
            setShowLogin(true);
            window.location.hash = "#/login";
          }}
        />
      );
    }
    if (showLogin) {
      return (
        <Login
          onLogin={(u) => {
            setUser(u);
            setResetToken(null);
            if (window.location.hash.startsWith("#/reset") || window.location.hash.startsWith("#/login")) {
              window.location.hash = "";
            }
          }}
          onBackToWebsite={() => {
            setShowLogin(false);
            if (window.location.hash.startsWith("#/login")) window.location.hash = "";
          }}
        />
      );
    }
    return (
      <Website
        onSignIn={() => {
          setShowLogin(true);
          window.location.hash = "#/login";
        }}
        onLaunchApp={(selectedTier) => {
          const t = selectedTier || "pro";
          setSignupTier(t);
          setViewingSignup(true);
          window.location.hash = `#/signup?tier=${t}`;
        }}
      />
    );
  }

  if (viewingWebsite) {
    return (
      <Website
        onSignIn={() => {
          setViewingWebsite(false);
          window.location.hash = "";
        }}
        onLaunchApp={(selectedTier) => {
          if (selectedTier) {
            setPreviewTier(selectedTier);
          }
          setViewingWebsite(false);
          window.location.hash = "";
        }}
      />
    );
  }

  const isOwner = user?.isOwner === true;
  const brandMark = isOwner ? "R" : initials(orgName) || "R";

  return (
    <div className={isOwnerOrg ? "app owner-workspace" : "app"} style={brandStyle}>
      <PiiContext.Provider value={piiHidden}>
        {/* Owner 2026-08-28 — nav moved to a LEFT SIDEBAR ("Put the
            navigation menu on the left side of the screen"). .shell is a
            row: the sticky .nav sidebar on the left, .content (impersonate
            banner + main + footer) flowing to its right. Same tabs, same
            controls — only their position changed. */}
        <div className="shell">
        <header className={`nav ${mobileMenuOpen ? "mobile-nav-open" : ""}`}>
        <div className="nav-inner">
          <div className="nav-header-row">
            <button
              className="brand"
              onClick={() => {
                setView("dashboard");
                setMobileMenuOpen(false);
              }}
              aria-label="Go to dashboard"
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "none",
                border: "none",
                padding: "2px 6px",
                cursor: "pointer",
              }}
            >
              <img
                src={revzentaLogo}
                alt="Revzenta"
                className="brand-logo-img"
                style={{
                  height: "40px",
                  width: "auto",
                  objectFit: "contain",
                  display: "block",
                }}
              />
              {!isOwner && orgName && orgName.toLowerCase() !== "revzenta" && (
                <span className="brand-text">
                  {orgName}
                  <span className="brand-sub">CRM</span>
                </span>
              )}
            </button>

            {/* Mobile-only header controls (visible <= 960px) */}
            <div className="mobile-nav-tools">
              <ThemeToggle />
              <button
                type="button"
                className={`mobile-menu-toggle ${mobileMenuOpen ? "active" : ""}`}
                onClick={() => setMobileMenuOpen((o) => !o)}
                aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                aria-expanded={mobileMenuOpen}
              >
                <span className="mobile-menu-toggle-icon">{mobileMenuOpen ? "✕" : "☰"}</span>
                <span className="mobile-menu-toggle-text">{mobileMenuOpen ? "Close" : "Menu"}</span>
              </button>
            </div>
          </div>

          <nav className={`tabs ${mobileMenuOpen ? "mobile-open" : ""}`} aria-label="Main">
            {isOwnerCockpit ? (
              <>
                {/* 1. Executive Overview & ROI */}
                <div className="nav-section-title">
                  <span>Executive &amp; Metrics</span>
                </div>
                <button
                  className={effectiveViewFinal === "dashboard" ? "tab active" : "tab"}
                  onClick={() => {
                    setView("dashboard");
                    setMobileMenuOpen(false);
                  }}
                  title="Pulse overview: MRR, Active Subscribers, Pipeline, and ROI"
                >
                  <span className="tab-icon">📊</span>
                  <span>Dashboard &amp; ROI</span>
                </button>
                <button
                  className={effectiveViewFinal === "finance" ? "tab active" : "tab"}
                  onClick={() => {
                    setView("finance");
                    setMobileMenuOpen(false);
                  }}
                  title="Stripe subscription billing, revenue metrics, and cash flow"
                >
                  <span className="tab-icon">💰</span>
                  <span>Revenue &amp; Stripe</span>
                </button>

                {/* 2. Subscribers & Workspaces */}
                <div className="nav-section-title">
                  <span>Subscribers &amp; Workspaces</span>
                </div>
                <button
                  className={effectiveViewFinal === "clients" ? "tab active" : "tab"}
                  onClick={() => {
                    setView("clients");
                    setMobileMenuOpen(false);
                  }}
                  title="Website subscribers, tenant workspaces, and 1-click CRM launch"
                >
                  <span className="tab-icon">👥</span>
                  <span>Subscribers</span>
                </button>

                {/* 3. Sales & Growth Pipeline */}
                <div className="nav-section-title">
                  <span>Sales &amp; Growth</span>
                </div>
                <button
                  className={effectiveViewFinal === "leads" ? "tab active" : "tab"}
                  onClick={() => {
                    setLeadsStage(null);
                    setOnboardingStage(null);
                    setLeadsFilter("active");
                    setView("leads");
                    setMobileMenuOpen(false);
                  }}
                  title="Website inquiries, new signups, and prospective subscriber leads"
                >
                  <span className="tab-icon">🎯</span>
                  <span>Sales Leads</span>
                </button>
                <button
                  className={effectiveViewFinal === "tasks" ? "tab active" : "tab"}
                  onClick={() => {
                    setView("tasks");
                    setMobileMenuOpen(false);
                  }}
                  title="Operational to-do list, sales follow-ups, and action items"
                >
                  <span className="tab-icon">📋</span>
                  <span>Tasks</span>
                </button>
                <button
                  className={effectiveViewFinal === "tickets" ? "tab active" : "tab"}
                  onClick={() => {
                    setView("tickets");
                    setMobileMenuOpen(false);
                  }}
                  title="Customer support tickets and inquiries submitted from subscriber CRMs"
                >
                  <span className="tab-icon">🎫</span>
                  <span>Support Tickets</span>
                </button>

                {/* 4. Legal & Platform Administration */}
                <div className="nav-section-title">
                  <span>Legal &amp; System</span>
                </div>
                <button
                  className={effectiveViewFinal === "documents" ? "tab active" : "tab"}
                  onClick={() => {
                    setView("documents");
                    setMobileMenuOpen(false);
                  }}
                  title="Audit trail and signed Master SaaS Agreements for all subscribers"
                >
                  <span className="tab-icon">📑</span>
                  <span>Signed Agreements</span>
                </button>
                <button
                  className={effectiveViewFinal === "admin" ? "tab active" : "tab"}
                  onClick={() => {
                    setView("admin");
                    setMobileMenuOpen(false);
                  }}
                  title="Master agreement contract editor, PIN security, and full data export"
                >
                  <span className="tab-icon">📝</span>
                  <span>Template &amp; Admin</span>
                </button>
                <button
                  className={effectiveViewFinal === "compliance" ? "tab active" : "tab"}
                  onClick={() => {
                    setView("compliance");
                    setMobileMenuOpen(false);
                  }}
                  title="TCPA DNC compliance, non-agency disclosures, and regulatory safeguards"
                >
                  <span className="tab-icon">🛡️</span>
                  <span>Compliance &amp; DNC</span>
                </button>
                <button
                  className={effectiveViewFinal === "settings" ? "tab active" : "tab"}
                  onClick={() => {
                    setView("settings");
                    setMobileMenuOpen(false);
                  }}
                  title="Master organization settings, API credentials, and billing keys"
                >
                  <span className="tab-icon">⚙️</span>
                  <span>Settings</span>
                </button>

                {/* 5. Marketing & Public Website (Owner Only) */}
                <div className="nav-section-title">
                  <span>Marketing Site</span>
                </div>
                <button
                  type="button"
                  className="tab"
                  onClick={() => {
                    setViewingWebsite(true);
                    window.location.hash = "#/website";
                    setMobileMenuOpen(false);
                  }}
                  title="View live Revzenta marketing website"
                >
                  <span className="tab-icon">🌐</span>
                  <span>View Website</span>
                </button>
              </>
            ) : isWholesale ? (
              /* Wholesale Vertical CRM Menu in exact user requested order:
                 (Dashboard, Properties, Offers Repository, Transaction Hub, Buy Box, Investors, Connections, Tasks, Support, Settings) */
              <>
                {/* 1. Dashboard */}
                {canSeeTab("dashboard") && (
                  <button
                    className={effectiveViewFinal === "dashboard" ? "tab active" : "tab"}
                    onClick={() => {
                      setView("dashboard");
                      setMobileMenuOpen(false);
                    }}
                    title="Real estate wholesale pipeline metrics, revenue, and active opportunities"
                  >
                    <span className="tab-icon">📊</span>
                    <span>Dashboard</span>
                  </button>
                )}

                {/* 2. Creative Hub */}
                {canSeeTab("clients") && (
                  <button
                    className={effectiveViewFinal === "leads" ? "tab active" : "tab"}
                    onClick={() => {
                      setLeadsStage(null);
                      setOnboardingStage(null);
                      setLeadsFilter("active");
                      setView("leads");
                      setMobileMenuOpen(false);
                    }}
                    title="Wholesale property pipeline and creative underwriting hub"
                  >
                    <span className="tab-icon">🏘️</span>
                    <span>Creative Hub</span>
                  </button>
                )}

                {/* 3. Transaction Hub */}
                {canSeeTab("documents") && (
                  <button
                    className={effectiveViewFinal === "documents" ? "tab active" : "tab"}
                    onClick={() => {
                      setView("documents");
                      setMobileMenuOpen(false);
                    }}
                    title={hasTierAccess(effectiveTier, "documents") ? "Title, escrow, and contract transaction hub" : "Transaction Hub (Pro & Scale feature)"}
                  >
                    <span className="tab-icon">🤝</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", width: "100%", justifyContent: "space-between" }}>
                      <span>Transaction Hub</span>
                      {!hasTierAccess(effectiveTier, "documents") && (
                        <span style={{ fontSize: "11px", opacity: 0.75 }} title="Available on Pro & Scale">🔒</span>
                      )}
                    </span>
                  </button>
                )}

                {/* 4. Offers Repository */}
                {canSeeTab("offers") && (
                  <button
                    className={effectiveViewFinal === "offers" ? "tab active" : "tab"}
                    onClick={() => {
                      setView("offers");
                      setMobileMenuOpen(false);
                    }}
                    title={hasTierAccess(effectiveTier, "offers") ? "Wholesale purchase proposals & dispatched offers repository" : "Offers Repository (Pro & Scale feature)"}
                  >
                    <span className="tab-icon">📑</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", width: "100%", justifyContent: "space-between" }}>
                      <span>Offers Repository</span>
                      {!hasTierAccess(effectiveTier, "offers") && (
                        <span style={{ fontSize: "11px", opacity: 0.75 }} title="Available on Pro & Scale">🔒</span>
                      )}
                    </span>
                  </button>
                )}

                {/* 5. Buy Box */}
                {canSeeTab("buybox") && (
                  <button
                    className={effectiveViewFinal === "buybox" ? "tab active" : "tab"}
                    onClick={() => {
                      setView("buybox");
                      setMobileMenuOpen(false);
                    }}
                    title={hasTierAccess(effectiveTier, "buybox") ? "Investor buy box criteria matching engine" : "Buy Box Matcher (Pro & Scale feature)"}
                  >
                    <span className="tab-icon">🎯</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", width: "100%", justifyContent: "space-between" }}>
                      <span>Buy Box</span>
                      {!hasTierAccess(effectiveTier, "buybox") && (
                        <span style={{ fontSize: "11px", opacity: 0.75 }} title="Available on Pro & Scale">🔒</span>
                      )}
                    </span>
                  </button>
                )}

                {/* 6. Investors */}
                {canSeeTab("investors") && (
                  <button
                    className={effectiveViewFinal === "clients" ? "tab active" : "tab"}
                    onClick={() => {
                      setView("clients");
                      setMobileMenuOpen(false);
                    }}
                    title="Vetted cash buyers and creative finance network"
                  >
                    <span className="tab-icon">💼</span>
                    <span>Investors</span>
                  </button>
                )}

                {/* 7. Connections */}
                {canSeeTab("connections") && (
                  <button
                    className={effectiveViewFinal === "connections" ? "tab active" : "tab"}
                    onClick={() => {
                      setView("connections");
                      setMobileMenuOpen(false);
                    }}
                    title="Inbound webhook channels & data connections"
                  >
                    <span className="tab-icon">🔌</span>
                    <span>Connections</span>
                  </button>
                )}

                {/* 8. Tasks */}
                {canSeeTab("tasks") && (
                  <button
                    className={effectiveViewFinal === "tasks" ? "tab active" : "tab"}
                    onClick={() => {
                      setView("tasks");
                      setMobileMenuOpen(false);
                    }}
                    title="Daily acquisition tasks, seller follow-ups, and closing items"
                  >
                    <span className="tab-icon">📋</span>
                    <span>Tasks</span>
                  </button>
                )}

                {/* 9. Support */}
                {canSeeTab("support") && (
                  <button
                    className={effectiveViewFinal === "tickets" ? "tab active" : "tab"}
                    onClick={() => {
                      setView("tickets");
                      setMobileMenuOpen(false);
                    }}
                    title="Submit tickets and get help from Revzenta platform support"
                  >
                    <span className="tab-icon">🎫</span>
                    <span>Support</span>
                  </button>
                )}

                {/* 10. Settings */}
                {canSeeTab("settings") && (
                  <button
                    className={effectiveViewFinal === "settings" ? "tab active" : "tab"}
                    onClick={() => {
                      setView("settings");
                      setMobileMenuOpen(false);
                    }}
                    title="Workspace profile, pipeline stages, custom fields, and team members"
                  >
                    <span className="tab-icon">⚙️</span>
                    <span>Settings</span>
                  </button>
                )}

                {/* 11. Compliance & DNC (Under Settings) */}
                {(canSeeTab("settings") || canSeeTab("clients")) && (
                  <button
                    className={effectiveViewFinal === "compliance" ? "tab active" : "tab"}
                    onClick={() => {
                      setView("compliance");
                      setMobileMenuOpen(false);
                    }}
                    title="TCPA DNC compliance, non-agency disclosures, and legal safeguards"
                  >
                    <span className="tab-icon">🛡️</span>
                    <span>Compliance &amp; DNC</span>
                  </button>
                )}
              </>
            ) : (
              /* Tenant or Preview Business Type CRM */
              <>
                <button
                  className={effectiveViewFinal === "dashboard" ? "tab active" : "tab"}
                  onClick={() => {
                    setView("dashboard");
                    setMobileMenuOpen(false);
                  }}
                >
                  <span className="tab-icon">📊</span>
                  <span>Dashboard</span>
                </button>
                {canSeeTab("clients") && (
                  <button
                    className={effectiveViewFinal === "leads" ? "tab active" : "tab"}
                    onClick={() => {
                      setLeadsStage(null);
                      setOnboardingStage(null);
                      setLeadsFilter("active");
                      setView("leads");
                      setMobileMenuOpen(false);
                    }}
                  >
                    <span className="tab-icon">🎯</span>
                    <span>Leads</span>
                  </button>
                )}
                {canSeeTab("clients") && (
                  <button
                    className={effectiveViewFinal === "clients" ? "tab active" : "tab"}
                    onClick={() => {
                      setView("clients");
                      setMobileMenuOpen(false);
                    }}
                  >
                    <span className="tab-icon">👥</span>
                    <span>Clients</span>
                  </button>
                )}
                <button
                  className={effectiveViewFinal === "appointments" ? "tab active" : "tab"}
                  onClick={() => {
                    setView("appointments");
                    setMobileMenuOpen(false);
                  }}
                >
                  <span className="tab-icon">📅</span>
                  <span>Appointments</span>
                </button>
                {canSeeTab("tasks") && (
                  <button
                    className={effectiveViewFinal === "tasks" ? "tab active" : "tab"}
                    onClick={() => {
                      setView("tasks");
                      setMobileMenuOpen(false);
                    }}
                  >
                    <span className="tab-icon">📋</span>
                    <span>Tasks</span>
                  </button>
                )}
                {canSeeTab("support") && (
                  <button
                    className={effectiveViewFinal === "tickets" ? "tab active" : "tab"}
                    onClick={() => {
                      setView("tickets");
                      setMobileMenuOpen(false);
                    }}
                  >
                    <span className="tab-icon">🎫</span>
                    <span>Support</span>
                  </button>
                )}
                {canSeeTab("finance") && (
                  <button
                    className={effectiveViewFinal === "finance" ? "tab active" : "tab"}
                    onClick={() => {
                      setView("finance");
                      setMobileMenuOpen(false);
                    }}
                  >
                    <span className="tab-icon">💰</span>
                    <span>Finance</span>
                  </button>
                )}
                {canSeeTab("settings") && (
                  <button
                    className={effectiveViewFinal === "settings" ? "tab active" : "tab"}
                    onClick={() => {
                      setView("settings");
                      setMobileMenuOpen(false);
                    }}
                  >
                    <span className="tab-icon">⚙️</span>
                    <span>Settings</span>
                  </button>
                )}

                {/* If owner is previewing this business type CRM, show quick exit in sidebar */}
                {previewVertical && (
                  <div className="nav-preview-exit-box">
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost nav-preview-exit-btn"
                      onClick={() => {
                        setPreviewVertical(null);
                        setMobileMenuOpen(false);
                      }}
                      title="Return to Owner / Admin CRM"
                    >
                      <span>←</span>
                      <span>Exit to Owner CRM</span>
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Mobile menu footer with user info & sign-out button (visible only in mobile vertical menu) */}
            <div className="mobile-menu-footer">
              <div className="mobile-menu-user-row">
                <span className="mobile-menu-user-badge">User:</span>
                <span className={`mobile-menu-user-name${blurPii(piiHidden)}`}>
                  {navUserName} {orgName ? `· ${orgName}` : ""}
                </span>
              </div>
              {!isOwnerCockpit && (
                <div style={{ marginTop: "6px", marginBottom: "8px" }}>
                  <span
                    className="plan-tier-badge"
                    title={`Active Subscription Plan: ${TIER_LABELS[effectiveTier] || effectiveTier}`}
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: "999px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      background:
                        effectiveTier === "scale"
                          ? "rgba(245, 158, 11, 0.15)"
                          : effectiveTier === "pro"
                          ? "rgba(168, 85, 247, 0.15)"
                          : "rgba(6, 182, 212, 0.15)",
                      border:
                        effectiveTier === "scale"
                          ? "1px solid rgba(245, 158, 11, 0.4)"
                          : effectiveTier === "pro"
                          ? "1px solid rgba(168, 85, 247, 0.4)"
                          : "1px solid rgba(6, 182, 212, 0.4)",
                      color:
                        effectiveTier === "scale"
                          ? "#fbbf24"
                          : effectiveTier === "pro"
                          ? "#c084fc"
                          : "#22d3ee",
                      letterSpacing: "0.03em",
                      textTransform: "uppercase"
                    }}
                  >
                    <span>{TIER_BADGES[effectiveTier]?.icon || "⚡"}</span>
                    <span>{TIER_SHORT_LABELS[effectiveTier] || effectiveTier}</span>
                  </span>
                </div>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm mobile-menu-signout"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
              >
                Sign out
              </button>
            </div>
          </nav>
          <div className="nav-right">
            {/* Global theme toggle (Light / Dark mode) */}
            <ThemeToggle />
            {/* Global privacy eye (owner request 2026-08-14) — blurs names,
                phone, email, address everywhere while ON; "active" styling
                (accent border/fill) marks the blurring state. */}
            <button
              type="button"
              className={`eye-btn pii-eye-btn${piiHidden ? " active" : ""}`}
              onClick={() => setPiiHidden((v) => !v)}
              aria-label={piiTitle}
              aria-pressed={piiHidden}
              title={piiTitle}
            >
              {piiHidden ? <PiiEyeOffIcon /> : <PiiEyeIcon />}
            </button>
            {!isOwnerCockpit ? (
              <span
                className="plan-tier-badge"
                title={`Active Subscription Plan: ${TIER_LABELS[effectiveTier] || effectiveTier}`}
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: "999px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  background:
                    effectiveTier === "scale"
                      ? "rgba(245, 158, 11, 0.15)"
                      : effectiveTier === "pro"
                      ? "rgba(168, 85, 247, 0.15)"
                      : "rgba(6, 182, 212, 0.15)",
                  border:
                    effectiveTier === "scale"
                      ? "1px solid rgba(245, 158, 11, 0.4)"
                      : effectiveTier === "pro"
                      ? "1px solid rgba(168, 85, 247, 0.4)"
                      : "1px solid rgba(6, 182, 212, 0.4)",
                  color:
                    effectiveTier === "scale"
                      ? "#fbbf24"
                      : effectiveTier === "pro"
                      ? "#c084fc"
                      : "#22d3ee",
                  letterSpacing: "0.03em",
                  textTransform: "uppercase"
                }}
              >
                <span>{TIER_BADGES[effectiveTier]?.icon || "⚡"}</span>
                <span>{TIER_SHORT_LABELS[effectiveTier] || effectiveTier}</span>
              </span>
            ) : previewVertical ? (
              <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }} title="Preview CRM as tier">
                {(["starter", "pro", "scale"] as PackageTier[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPreviewTier(t)}
                    title={`Test CRM as ${TIER_LABELS[t]}`}
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      padding: "2px 7px",
                      borderRadius: "6px",
                      border: effectiveTier === t ? "1px solid #a855f7" : "1px solid rgba(255,255,255,0.15)",
                      background: effectiveTier === t ? "rgba(168, 85, 247, 0.25)" : "transparent",
                      color: effectiveTier === t ? "#ffffff" : "var(--muted)",
                      cursor: "pointer",
                      textTransform: "uppercase"
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            ) : null}
            <span className={`nav-user${blurPii(piiHidden)}`} title={user.email}>
              {navUserName}
              {orgName ? ` · ${orgName}` : ""}
            </span>
            <button className="btn btn-ghost btn-sm nav-signout" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </div>
      </header>
      <div className="content">
        {impersonating && (
          <div className="impersonate-banner" role="status" aria-label="Impersonation notice">
            <span className="impersonate-icon" aria-hidden="true">
              ⚠
            </span>
            <span className="impersonate-text">
              Viewing as <strong>{orgName || "tenant"}</strong> — you are inside this client's
              workspace. Everything you see is exactly what they see.
            </span>
            <button
              className="btn btn-sm impersonate-return"
              onClick={handleImpersonateReturn}
              disabled={returning}
            >
              {returning ? "Returning…" : "Return to my dashboard"}
            </button>
          </div>
        )}
      <main className="main">
        {effectiveViewFinal === "dashboard" ? (
          <Dashboard
            onGoToStage={goToStage}
            onGoToLost={goToLost}
            onGoToBuyBox={() => setView("buybox")}
            onGoToBuyers={() => setView("buyers")}
            onGoToTransactions={() => setView("documents")}
            onGoToOffers={() => setView("offers")}
            onGoToSubscribers={() => setView("clients")}
            onGoToFinance={() => setView("finance")}
            onGoToLeads={() => {
              setLeadsStage(null);
              setOnboardingStage(null);
              setLeadsFilter("active");
              setView("leads");
            }}
            onLaunchSubscriber={handleImpersonate}
            stages={stages}
            ownerOrg={isOwnerCockpit}
            isWholesale={isWholesale}
          />
        ) : effectiveViewFinal === "leads" ? (
          /* Owner request 2026-08-15 — the owner's Leads tab scopes to the
             FIRST stage only; client accounts (role=member) keep the full
             pipeline (every stage except their terminal one, PR #35).
             Team-users: a view-only "clients" member still opens the tab —
             only the create/edit affordances are hidden (canEdit). */
          <Clients
            stages={stages}
            ownerOrg={isOwnerCockpit}
            scope={isOwnerCockpit ? "first" : "all"}
            initialStage={leadsStage}
            initialFilter={leadsFilter}
            canEdit={canEditTab("clients")}
            isWholesale={isWholesale}
            crmBusinessName={orgName}
            onGoToBuyBox={() => setView("buybox")}
            onGoToTransactions={() => setView("documents")}
            verticalKey={verticalKey}
          />
        ) : effectiveViewFinal === "offers" ? (
          !hasTierAccess(effectiveTier, "offers") ? (
            <UpgradeGate
              featureName="Offers Repository & Contract Dispatch"
              featureDescription="Standardized purchase proposals, assignment fee calculations, and automated contract dispatch are included with Pro Dealmaker and Scale & Brokerage packages."
              requiredTier="pro"
              currentTier={effectiveTier}
            />
          ) : (
            <Offers
              crmBusinessName={orgName}
              onNavigateToProperty={() => {
                setLeadsStage(null);
                setOnboardingStage(null);
                setLeadsFilter("active");
                setView("leads");
              }}
            />
          )
        ) : effectiveViewFinal === "buybox" ? (
          !hasTierAccess(effectiveTier, "buybox") ? (
            <UpgradeGate
              featureName="AI Buy Box Matcher & Auto-Disposition"
              featureDescription="Instantaneously match underwritten properties against vetted cash buyer acquisition criteria and rank buyers by match confidence on the Pro Dealmaker and Scale & Brokerage packages."
              requiredTier="pro"
              currentTier={effectiveTier}
            />
          ) : (
            <BuyBoxMatcher canEdit={canEditTab("buybox")} />
          )
        ) : effectiveViewFinal === "clients" ? (
          /* Owner live-test reorg 2026-08-18 — the owner's Clients tab hosts
             the ACCOUNT management panel (create / view / reset / delete) via
             ClientsDirectory's Accounts sub-component. Owner 2026-08-20 — the
             owner's Clients tab is now the CLIENT ACCOUNTS list (the single
             client list), not a sold directory. */
          <ClientsDirectory
            stages={stages}
            ownerOrg={isOwnerCockpit}
            canEdit={isWholesale ? canEditTab("investors") : canEditTab("clients")}
            ownerOrgId={isOwnerOrg ? user.orgId : undefined}
            onViewAccount={isOwnerOrg ? handleImpersonate : undefined}
            isWholesale={isWholesale}
          />
        ) : effectiveViewFinal === "calendar" ? (
          /* Owner 2026-08-20 sales rework — the owner's Calendar view of
             demo-call appointments. Owner-workspace only. */
          <Calendar />
        ) : effectiveViewFinal === "tasks" ? (
          <Tasks canEdit={canEditTab("tasks")} />
        ) : effectiveViewFinal === "buyers" ? (
          /* Wholesale Real Estate vertical (owner 2026-09-04) — the
             account's end-buyer list, gated by the tasks grant. */
          <Buyers canEdit={isWholesale ? canEditTab("investors") : canEditTab("tasks")} />
        ) : effectiveViewFinal === "finance" ? (
          <Finance canEdit={canEditTab("finance")} ownerOrg={isOwnerCockpit} />
        ) : effectiveViewFinal === "admin" ? (
          /* Owner 2026-08-28 consolidation — Administration hosts the
             Agreements template editor (PIN-protected, moved back from
             Documents), the Agreements PIN control and the owner's "Your
             data" export copy (both from Settings; owner decision
             2026-08-29 option b keeps the tenant export in tenant Settings).
             Client-account management moved to the Clients tab (2026-08-18). */
          <Admin />
        ) : effectiveViewFinal === "documents" ? (
          !hasTierAccess(effectiveTier, "documents") ? (
            <UpgradeGate
              featureName="Transaction Hub & Escrow Milestone Tracker"
              featureDescription="Coordinate title companies, escrow officers, earnest money deposits, and closing milestones seamlessly in one centralized pipeline on the Pro Dealmaker and Scale & Brokerage packages."
              requiredTier="pro"
              currentTier={effectiveTier}
            />
          ) : isWholesale ? (
            <TransactionHub crmBusinessName={orgName} />
          ) : (
            <Documents verticalLabel={undefined} />
          )
        ) : effectiveViewFinal === "connections" ? (
          <Connections canEdit={canEditTab("connections")} />
        ) : effectiveViewFinal === "compliance" ? (
          <Compliance
            onNavigateToConnections={() => setView("connections")}
            onNavigateToLeads={() => setView("leads")}
          />
        ) : effectiveViewFinal === "tickets" ? (
          <Tickets ownerOrg={isOwnerCockpit} canEdit={canEditTab("support")} />
        ) : (
          <Settings
            canEdit={canEditTab("settings")}
            isOrgAdmin={user.isOrgAdmin === true}
            currentUserId={user.id}
            isOwnerOrg={isOwnerOrg}
            isWholesale={isWholesale}
            tier={effectiveTier}
          />
        )}
      </main>
      <footer className="foot" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div>Revzenta CRM {orgName && orgName !== "Revzenta" ? `· Workspace: ${orgName}` : ""} · product build · v0.1</div>
        <div style={{ display: "flex", gap: "16px", fontSize: "12px", flexWrap: "wrap" }}>
          <a
            href="#/agreement"
            onClick={(e) => {
              e.preventDefault();
              setViewingWebsite(true);
              window.location.hash = "#/agreement";
            }}
            style={{ color: "var(--muted)", textDecoration: "none", cursor: "pointer" }}
          >
            Customer Agreement
          </a>
          <a
            href="#/privacy"
            onClick={(e) => {
              e.preventDefault();
              setViewingWebsite(true);
              window.location.hash = "#/privacy";
            }}
            style={{ color: "var(--muted)", textDecoration: "none", cursor: "pointer" }}
          >
            Privacy Policy
          </a>
          <a
            href="#/terms"
            onClick={(e) => {
              e.preventDefault();
              setViewingWebsite(true);
              window.location.hash = "#/terms";
            }}
            style={{ color: "var(--muted)", textDecoration: "none", cursor: "pointer" }}
          >
            Terms of Service
          </a>
          <a
            href="#/security"
            onClick={(e) => {
              e.preventDefault();
              setViewingWebsite(true);
              window.location.hash = "#/security";
            }}
            style={{ color: "var(--muted)", textDecoration: "none", cursor: "pointer" }}
          >
            Security &amp; Safeguards
          </a>
        </div>
      </footer>
      </div>
      </div>
      </PiiContext.Provider>
    </div>
  );
}
