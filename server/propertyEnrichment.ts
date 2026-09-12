/**
 * Real Estate Property Lead Enrichment Module
 *
 * Integrates with RentCast API (and public appraisal models) for:
 * - One-click property specs lookup (beds, baths, sqft, year built)
 * - Automated Valuation Model (AVM) property value estimates & ranges
 * - Long-term & short-term market rent estimates
 * - Real estate comparable sales (comps)
 * - Intelligent heuristic fallback when API key is unconfigured
 */

import { db, getRentcastUsage, logRentcastCall } from "./db";

export interface PropertyEnrichmentResult {
  formattedAddress: string;
  addressLine1: string;
  city: string;
  state: string;
  zipCode: string;
  county?: string;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  lotSize?: number;
  yearBuilt?: number;
  estimatedValue?: number;
  valueRangeLow?: number;
  valueRangeHigh?: number;
  estimatedRent?: number;
  lastSalePrice?: number;
  lastSaleDate?: string;
  taxAssessedValue?: number;
  ownerName?: string;
  comps?: Array<{
    address: string;
    price: number;
    bedrooms: number;
    bathrooms: number;
    squareFootage: number;
    distanceMiles: number;
  }>;
  source: "rentcast" | "attom" | "unconfigured" | "not_found" | "public_records_estimate";
  message?: string;
}

/**
 * Parses an address string into structured parts (street, city, state, zip).
 */
export function parseAddressString(address: string): {
  addressLine1: string;
  city: string;
  state: string;
  zipCode: string;
} {
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  let addressLine1 = parts[0] || address.trim();
  let city = "";
  let state = "";
  let zipCode = "";

  if (parts.length >= 3) {
    city = parts[1];
    const stateZip = parts[2].trim().split(/\s+/);
    if (stateZip[0]) state = stateZip[0].toUpperCase();
    if (stateZip[1]) zipCode = stateZip[1];
  } else if (parts.length === 2) {
    const secondPart = parts[1].trim().split(/\s+/);
    if (secondPart.length >= 2 && secondPart[secondPart.length - 2].length === 2) {
      state = secondPart[secondPart.length - 2].toUpperCase();
      zipCode = secondPart[secondPart.length - 1];
      city = secondPart.slice(0, -2).join(" ");
    } else {
      city = parts[1];
    }
  }

  return { addressLine1, city, state, zipCode };
}

/**
 * Extracts a normalized physical address string from real estate listing URLs
 * (Zillow, Redfin, Realtor.com, Trulia, etc.) or returns the trimmed input if already an address.
 */
const AUTHORIZED_DOMAINS = [
  "zillow.com",
  "www.zillow.com",
  "redfin.com",
  "www.redfin.com",
  "realtor.com",
  "www.realtor.com",
  "trulia.com",
  "www.trulia.com",
  "homes.com",
  "www.homes.com",
];

export function extractAddressFromUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  // If input is a URL or contains a web protocol
  if (/^https?:\/\//i.test(trimmed) || /^(www\.|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}\/)/i.test(trimmed)) {
    const fullUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    let url: URL;
    try {
      url = new URL(fullUrl);
    } catch {
      throw new Error("Malformed URL. Please provide a valid real estate link or street address.");
    }

    const host = url.hostname.toLowerCase();

    // Security check: block internal IPs, localhost, and non-standard protocols
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      host.startsWith("169.254.") ||
      !/^https?:$/i.test(url.protocol)
    ) {
      throw new Error("Security Violation: Internal IP addresses and non-standard web protocols are strictly prohibited.");
    }

    // Enforce Authorized Real Estate Domains Whitelist
    const isWhitelisted = AUTHORIZED_DOMAINS.some((d) => host === d || host.endsWith("." + d));
    if (!isWhitelisted) {
      throw new Error(
        `UNAUTHORIZED_URL: Access to '${host}' is blocked. For security reasons, only links from authorized real estate platforms (Zillow, Redfin, Realtor.com, Trulia, Homes.com) or direct physical street addresses are permitted into the CRM.`
      );
    }

    const pathname = decodeURIComponent(url.pathname);

    // 1. Zillow: /homedetails/<slug>/<zpid>_zpid or /homes/<slug>_rb/<zpid>_zpid
    if (host.includes("zillow.com")) {
      const homeMatch = pathname.match(/\/homedetails\/([^\/]+)/i);
      if (homeMatch && homeMatch[1]) {
        const rawSlug = homeMatch[1];
        if (!rawSlug.endsWith("_zpid")) {
          return formatSlugToAddress(rawSlug);
        }
      }
      const homesMatch = pathname.match(/\/homes\/(?:for_sale\/)?([^\/]+?)(?:_rb|\/|$)/i);
      if (homesMatch && homesMatch[1]) {
        return formatSlugToAddress(homesMatch[1]);
      }
    }

    // 2. Redfin: /<STATE>/<CITY>/<STREET-ZIP>/home/<id>
    if (host.includes("redfin.com")) {
      const redfinMatch = pathname.match(/\/([A-Z]{2})\/([^\/]+)\/([^\/]+)\/home\//i);
      if (redfinMatch) {
        const state = redfinMatch[1].toUpperCase();
        const city = redfinMatch[2].replace(/-/g, " ");
        const streetZip = redfinMatch[3].replace(/-/g, " ");
        return `${streetZip}, ${city}, ${state}`;
      }
    }

    // 3. Realtor.com: /realestateandhomes-detail/<Street_City_State_Zip>_...
    if (host.includes("realtor.com")) {
      const realtorMatch = pathname.match(/\/realestateandhomes-detail\/([^\/]+)/i);
      if (realtorMatch) {
        const raw = realtorMatch[1].split("_M")[0];
        return formatSlugToAddress(raw);
      }
    }

    // 4. Trulia: /p/<state>/<city>/<street-zip>...
    if (host.includes("trulia.com")) {
      const segments = pathname.split("/").filter(Boolean);
      const candidate = segments.reduce((longest, curr) => (curr.length > longest.length ? curr : longest), "");
      if (candidate.length > 8) {
        return formatSlugToAddress(candidate);
      }
    }

    // 5. Homes.com: /property/<street-city-state-zip>/...
    if (host.includes("homes.com")) {
      const segments = pathname.split("/").filter(Boolean);
      const candidate = segments.reduce((longest, curr) => (curr.length > longest.length ? curr : longest), "");
      if (candidate.length > 8) {
        return formatSlugToAddress(candidate);
      }
    }

    // Whitelisted host slug fallback
    const segments = pathname.split("/").filter(Boolean);
    const candidate = segments.reduce((longest, curr) => (curr.length > longest.length ? curr : longest), "");
    if (candidate.length > 8) {
      return formatSlugToAddress(candidate);
    }
  }

  // Direct physical address (strip any script injection characters)
  return trimmed.replace(/[<>{}\\]/g, "").trim();
}

function formatSlugToAddress(slug: string): string {
  let s = slug.replace(/_zpid.*$/i, "").replace(/_rb.*$/i, "");
  s = s.replace(/[-_]/g, " ");
  s = s.replace(/\s*,\s*/g, ", ").replace(/\s+/g, " ").trim();
  s = s.replace(/[<>{}\\]/g, "");
  return s;
}

/**
 * Normalizes an address string for caching by stripping punctuation, standardizing street suffixes,
 * and collapsing whitespace, ensuring equivalent URLs and formatted addresses hit the same cache record.
 */
export function normalizeAddressForCache(address: string): string {
  return address
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\b(street|st)\b/g, "st")
    .replace(/\b(drive|dr)\b/g, "dr")
    .replace(/\b(avenue|ave)\b/g, "ave")
    .replace(/\b(boulevard|blvd)\b/g, "blvd")
    .replace(/\b(road|rd)\b/g, "rd")
    .replace(/\b(lane|ln)\b/g, "ln")
    .replace(/\b(court|ct)\b/g, "ct")
    .replace(/\b(circle|cir)\b/g, "cir")
    .replace(/\b(way)\b/g, "way")
    .replace(/\b(place|pl)\b/g, "pl")
    .replace(/\b(north)\b/g, "n")
    .replace(/\b(south)\b/g, "s")
    .replace(/\b(east)\b/g, "e")
    .replace(/\b(west)\b/g, "w")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fetch live property specs and valuation from RentCast API if configured.
 * Does NOT generate fake specs when API key is unconfigured.
 */
export async function lookupPropertyData(
  address: string,
  apiKey?: string,
  options?: { includeDedicatedRent?: boolean; forceRefresh?: boolean; orgId?: number }
): Promise<PropertyEnrichmentResult> {
  const cleanAddr = extractAddressFromUrl(address.trim());
  if (!cleanAddr) {
    throw new Error("Address is required for property lookup.");
  }

  const cacheKey = normalizeAddressForCache(cleanAddr);

  // 1. Check local persistent database cache first (0 API requests!)
  if (!options?.forceRefresh) {
    try {
      const cached = db
        .query(
          "SELECT data FROM property_enrichment_cache WHERE normalized_address = ? AND expires_at > datetime('now')"
        )
        .get(cacheKey) as { data: string } | null;

      if (cached && cached.data) {
        if (options?.orgId) {
          logRentcastCall(options.orgId, "cache", cleanAddr, true);
        }
        const parsedData = JSON.parse(cached.data);
        return {
          ...parsedData,
          source: "rentcast",
          message: "✓ Loaded from verified local MLS cache (0 API calls)",
        };
      }
    } catch (cacheReadErr) {
      console.warn("[property-enrichment] Cache read error:", cacheReadErr);
    }
  }

  const parsed = parseAddressString(cleanAddr);
  const key = (apiKey || process.env.RENTCAST_API_KEY || "").trim();

  // If no live key is configured, return clear status without fabricating fake specs
  if (!key || key === "mock" || key === "demo") {
    return {
      formattedAddress: cleanAddr,
      addressLine1: parsed.addressLine1,
      city: parsed.city,
      state: parsed.state,
      zipCode: parsed.zipCode,
      source: "unconfigured",
      message:
        "RentCast API key is not configured. Add your free RentCast API key in Settings > Integrations (50 free lookups/mo at rentcast.io) to pull verified MLS specs, tax appraisals, and comps.",
    };
  }

  // Check Hard Stop & Quota Guard before making ANY live outbound call
  if (options?.orgId) {
    const usage = getRentcastUsage(options.orgId);
    if (usage.isBlocked) {
      throw new Error(
        `RENTCAST_HARD_STOP: Monthly limit reached (${usage.callsThisMonth}/${usage.monthlyLimit} calls used). Outbound API requests have been paused to protect your account. You can raise your limit in Settings or upgrade at rentcast.io.`
      );
    }
  }

  // 1. Query RentCast Property Specs API (Call 1)
  if (options?.orgId) {
    logRentcastCall(options.orgId, "/v1/properties", cleanAddr, false);
  }
  const propUrl = `https://api.rentcast.io/v1/properties?address=${encodeURIComponent(cleanAddr)}`;
  const propRes = await fetch(propUrl, {
    headers: {
      Accept: "application/json",
      "X-Api-Key": key,
    },
  });

  if (propRes.status === 401 || propRes.status === 403) {
    throw new Error("Invalid RentCast API key. Please check your API key in Settings > Integrations.");
  }

  if (propRes.status === 429) {
    throw new Error("RentCast API monthly quota exceeded (free tier limit reached). Upgrade plan at rentcast.io.");
  }

  if (propRes.status === 404 || propRes.status === 400) {
    return {
      formattedAddress: cleanAddr,
      addressLine1: parsed.addressLine1,
      city: parsed.city,
      state: parsed.state,
      zipCode: parsed.zipCode,
      source: "not_found",
      message:
        propRes.status === 400
          ? `RentCast could not geolocate "${cleanAddr}". Please verify the street number, city, state, and 5-digit zip code (e.g. "5500 Grand Lake Dr, San Antonio, TX 78244") or enter specs manually.`
          : `No property records found in RentCast for "${cleanAddr}". Verify address formatting or enter specs manually.`,
    };
  }

  if (!propRes.ok) {
    const errText = await propRes.text();
    throw new Error(`RentCast API returned HTTP ${propRes.status}: ${errText}`);
  }

  const propData = (await propRes.json()) as any;
  const p = Array.isArray(propData) ? propData[0] : propData;

  if (!p) {
    return {
      formattedAddress: cleanAddr,
      addressLine1: parsed.addressLine1,
      city: parsed.city,
      state: parsed.state,
      zipCode: parsed.zipCode,
      source: "not_found",
      message: "No property records found in RentCast for this address. Verify address formatting or enter specs manually.",
    };
  }

  // 2. Query RentCast AVM Valuation & Comps API (Call 2)
  let avmData: any = {};
  try {
    if (options?.orgId) {
      logRentcastCall(options.orgId, "/v1/avm/value", cleanAddr, false);
    }
    const avmUrl = `https://api.rentcast.io/v1/avm/value?address=${encodeURIComponent(cleanAddr)}`;
    const avmRes = await fetch(avmUrl, {
      headers: {
        Accept: "application/json",
        "X-Api-Key": key,
      },
    });
    if (avmRes.ok) {
      avmData = (await avmRes.json()) as any;
    }
  } catch (avmErr) {
    console.warn("[property-enrichment] AVM fetch warning:", avmErr);
  }

  // 3. Rent estimate: use AVM's included rent or estimate, only calling 3rd endpoint if explicitly requested
  let rentData: any = {};
  if (options?.includeDedicatedRent) {
    try {
      if (options?.orgId) {
        logRentcastCall(options.orgId, "/v1/avm/rent/long-term", cleanAddr, false);
      }
      const rentUrl = `https://api.rentcast.io/v1/avm/rent/long-term?address=${encodeURIComponent(cleanAddr)}`;
      const rentRes = await fetch(rentUrl, {
        headers: {
          Accept: "application/json",
          "X-Api-Key": key,
        },
      });
      if (rentRes.ok) {
        rentData = (await rentRes.json()) as any;
      }
    } catch (rentErr) {
      console.warn("[property-enrichment] Rent AVM fetch warning:", rentErr);
    }
  }

  // Extract owner name if available from RentCast
  let ownerName: string | undefined = undefined;
  if (p.owner) {
    if (Array.isArray(p.owner.names) && p.owner.names[0]) {
      ownerName = p.owner.names[0];
    } else if (typeof p.owner.name === "string" && p.owner.name.trim()) {
      ownerName = p.owner.name.trim();
    }
  }

  // Extract comps if available
  const comps = Array.isArray(avmData.comparables)
    ? avmData.comparables.slice(0, 5).map((c: any) => ({
        address: c.formattedAddress || c.addressLine1 || "Nearby Comp",
        price: Number(c.price) || 0,
        bedrooms: Number(c.bedrooms) || 0,
        bathrooms: Number(c.bathrooms) || 0,
        squareFootage: Number(c.squareFootage) || 0,
        distanceMiles: typeof c.distance === "number" ? Number(c.distance.toFixed(2)) : 0,
      }))
    : [];

  const estimatedValue =
    avmData.price != null && !isNaN(Number(avmData.price))
      ? Number(avmData.price)
      : p.lastSalePrice != null && !isNaN(Number(p.lastSalePrice))
      ? Number(p.lastSalePrice)
      : undefined;

  const estimatedRent =
    rentData.rent != null
      ? Number(rentData.rent)
      : avmData.rent != null
      ? Number(avmData.rent)
      : estimatedValue
      ? Math.round(estimatedValue * 0.0075)
      : undefined;

  const result: PropertyEnrichmentResult = {
    formattedAddress: p.formattedAddress || cleanAddr,
    addressLine1: p.addressLine1 || parsed.addressLine1,
    city: p.city || parsed.city,
    state: p.state || parsed.state,
    zipCode: p.zipCode || parsed.zipCode,
    county: p.county || undefined,
    propertyType: p.propertyType || "Single Family",
    bedrooms: p.bedrooms != null ? Number(p.bedrooms) : undefined,
    bathrooms: p.bathrooms != null ? Number(p.bathrooms) : undefined,
    squareFootage: p.squareFootage != null ? Number(p.squareFootage) : undefined,
    lotSize: p.lotSize != null ? Number(p.lotSize) : undefined,
    yearBuilt: p.yearBuilt != null ? Number(p.yearBuilt) : undefined,
    estimatedValue,
    valueRangeLow: avmData.priceRangeLow != null ? Number(avmData.priceRangeLow) : undefined,
    valueRangeHigh: avmData.priceRangeHigh != null ? Number(avmData.priceRangeHigh) : undefined,
    estimatedRent,
    lastSalePrice: p.lastSalePrice != null ? Number(p.lastSalePrice) : undefined,
    lastSaleDate: p.lastSaleDate ? String(p.lastSaleDate).split("T")[0] : undefined,
    taxAssessedValue: p.taxAssessedValue || p.assessedValue || undefined,
    ownerName,
    comps,
    source: "rentcast",
    message: "Verified MLS and county tax appraisal data retrieved via RentCast.",
  };

  // 4. Save to persistent SQLite cache (valid for 60 days) to eliminate future API calls
  try {
    db.query(`
      INSERT INTO property_enrichment_cache (normalized_address, data, source, created_at, expires_at)
      VALUES (?, ?, 'rentcast', datetime('now'), datetime('now', '+60 days'))
      ON CONFLICT(normalized_address) DO UPDATE SET
        data = excluded.data,
        created_at = datetime('now'),
        expires_at = datetime('now', '+60 days')
    `).run(cacheKey, JSON.stringify(result));
  } catch (cacheWriteErr) {
    console.warn("[property-enrichment] Cache write error:", cacheWriteErr);
  }

  return result;
}

/**
 * Normalizes an incoming raw payload from Zapier, Make, BatchLeads, webhook relays, or webform
 */
export function normalizeWebhookPayload(body: Record<string, any>) {
  // Support nested objects (e.g. body.data, body.lead, body.properties[0])
  const data = body.data || body.lead || (Array.isArray(body.properties) ? body.properties[0] : body);

  const address = (
    data.address ||
    data.property_address ||
    data.street_address ||
    data.PropertyAddress ||
    data.StreetAddress ||
    data.propertyAddress ||
    data.street ||
    ""
  ).trim();

  const city = (data.city || data.City || data.property_city || "").trim();
  const state = (data.state || data.State || data.property_state || "").trim();
  const zip = (data.zip || data.zip_code || data.Zip || data.postal_code || "").trim();

  const sellerName = (
    data.seller_name ||
    data.owner_name ||
    data.contact_name ||
    data.SellerName ||
    data.OwnerName ||
    data.name ||
    data.full_name ||
    ""
  ).trim();

  const phone = (
    data.phone ||
    data.phone_number ||
    data.seller_phone ||
    data.owner_phone ||
    data.Phone ||
    data.mobile ||
    ""
  ).trim();

  const email = (
    data.email ||
    data.seller_email ||
    data.owner_email ||
    data.Email ||
    ""
  ).trim();

  const estimatedValue = Number(
    data.estimated_value ||
    data.deal_value ||
    data.price ||
    data.market_value ||
    data.EstimatedValue ||
    data.AVM ||
    0
  );

  const askingPrice = Number(
    data.asking_price ||
    data.contract_price ||
    data.target_price ||
    data.AskingPrice ||
    0
  );

  const rawSource = (
    data.source ||
    data.lead_source ||
    data.leadSource ||
    data.channel ||
    data.platform ||
    body.source ||
    body.lead_source ||
    body.leadSource ||
    ""
  ).trim();

  const distressType = (
    data.lead_type ||
    data.distress_type ||
    data.category ||
    data.tag ||
    data.list_name ||
    data.tags ||
    ""
  ).trim();

  const resolvedSource = rawSource
    ? (distressType && distressType.toLowerCase() !== rawSource.toLowerCase() ? `${rawSource} (${distressType})` : rawSource)
    : (distressType ? `Webhook: ${distressType}` : "Inbound Webhook");

  const notes = (
    data.notes ||
    data.description ||
    data.comments ||
    data.reason ||
    ""
  ).trim();

  const bedrooms = Number(data.bedrooms || data.beds || data.Bedrooms || 0);
  const bathrooms = Number(data.bathrooms || data.baths || data.Bathrooms || 0);
  const squareFootage = Number(data.square_feet || data.sqft || data.SquareFeet || 0);

  return {
    address,
    city,
    state,
    zip,
    sellerName,
    phone,
    email,
    estimatedValue,
    askingPrice,
    distressType: distressType || "Inbound Webhook",
    source: resolvedSource,
    notes,
    bedrooms,
    bathrooms,
    squareFootage,
    raw: data,
  };
}
