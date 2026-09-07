/**
 * URL Address Parser Utility
 * Extracts physical addresses from Zillow, Redfin, Realtor.com, Trulia, and real estate URLs.
 */

export interface ParsedUrlAddress {
  raw: string;
  isUrl: boolean;
  address: string;
  source: "zillow" | "redfin" | "realtor" | "trulia" | "homes" | "direct_address";
  authorized: boolean;
  rejectionReason?: string;
}

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

function formatSlugToAddress(slug: string): string {
  let s = slug.replace(/_zpid.*$/i, "").replace(/_rb.*$/i, "");
  s = s.replace(/[-_]/g, " ");
  s = s.replace(/\s*,\s*/g, ", ").replace(/\s+/g, " ").trim();
  // Strip any suspicious characters or scripts
  s = s.replace(/[<>{}\\]/g, "");
  return s;
}

export function isAuthorizedPropertyUrl(urlStr: string): { authorized: boolean; domain?: string; reason?: string } {
  try {
    const url = new URL(urlStr);
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
      return {
        authorized: false,
        reason: "Security Violation: Internal IP addresses and non-standard protocols are strictly prohibited.",
      };
    }

    const isWhitelisted = AUTHORIZED_DOMAINS.some((d) => host === d || host.endsWith("." + d));
    if (!isWhitelisted) {
      return {
        authorized: false,
        domain: host,
        reason: `Unauthorized Domain (${host}). For security reasons, only links from authorized real estate platforms (Zillow, Redfin, Realtor.com, Trulia, Homes.com) are permitted.`,
      };
    }

    return { authorized: true, domain: host };
  } catch {
    return { authorized: false, reason: "Malformed URL. Please paste a valid web address or enter a street address directly." };
  }
}

export function extractAddressFromUrl(input: string): ParsedUrlAddress {
  const trimmed = input.trim();
  if (!trimmed) {
    return { raw: "", isUrl: false, address: "", source: "direct_address", authorized: true };
  }

  // If input contains a protocol or looks like a URL
  if (/^https?:\/\//i.test(trimmed) || /^(www\.|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}\/)/i.test(trimmed)) {
    const fullUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const check = isAuthorizedPropertyUrl(fullUrl);

    if (!check.authorized) {
      return {
        raw: trimmed,
        isUrl: true,
        address: "",
        source: "direct_address",
        authorized: false,
        rejectionReason: check.reason,
      };
    }

    try {
      const url = new URL(fullUrl);
      const host = url.hostname.toLowerCase();
      const pathname = decodeURIComponent(url.pathname);

      // 1. Zillow
      if (host.includes("zillow.com")) {
        const homeMatch = pathname.match(/\/homedetails\/([^\/]+)/i);
        if (homeMatch && homeMatch[1]) {
          const rawSlug = homeMatch[1];
          if (!rawSlug.endsWith("_zpid")) {
            return {
              raw: trimmed,
              isUrl: true,
              address: formatSlugToAddress(rawSlug),
              source: "zillow",
              authorized: true,
            };
          }
        }
        const homesMatch = pathname.match(/\/homes\/(?:for_sale\/)?([^\/]+?)(?:_rb|\/|$)/i);
        if (homesMatch && homesMatch[1]) {
          return {
            raw: trimmed,
            isUrl: true,
            address: formatSlugToAddress(homesMatch[1]),
            source: "zillow",
            authorized: true,
          };
        }
      }

      // 2. Redfin: /<STATE>/<CITY>/<STREET-ZIP>/home/<id>
      if (host.includes("redfin.com")) {
        const redfinMatch = pathname.match(/\/([A-Z]{2})\/([^\/]+)\/([^\/]+)\/home\//i);
        if (redfinMatch) {
          const state = redfinMatch[1].toUpperCase();
          const city = redfinMatch[2].replace(/-/g, " ");
          const streetZip = redfinMatch[3].replace(/-/g, " ");
          return {
            raw: trimmed,
            isUrl: true,
            address: `${streetZip}, ${city}, ${state}`,
            source: "redfin",
            authorized: true,
          };
        }
      }

    // 3. Realtor.com: /realestateandhomes-detail/<Street_City_State_Zip>_...
    if (host.includes("realtor.com")) {
      const realtorMatch = pathname.match(/\/realestateandhomes-detail\/([^\/]+)/i);
      if (realtorMatch) {
        const raw = realtorMatch[1].split("_M")[0];
        return {
          raw: trimmed,
          isUrl: true,
          address: formatSlugToAddress(raw),
          source: "realtor",
          authorized: true,
        };
      }
    }

    // 4. Trulia: /p/<state>/<city>/<street-zip>...
    if (host.includes("trulia.com")) {
      const segments = pathname.split("/").filter(Boolean);
      const candidate = segments.reduce((longest, curr) => (curr.length > longest.length ? curr : longest), "");
      if (candidate.length > 8) {
        return {
          raw: trimmed,
          isUrl: true,
          address: formatSlugToAddress(candidate),
          source: "trulia",
          authorized: true,
        };
      }
    }

    // 5. Homes.com: /property/<street-city-state-zip>/...
    if (host.includes("homes.com")) {
      const segments = pathname.split("/").filter(Boolean);
      const candidate = segments.reduce((longest, curr) => (curr.length > longest.length ? curr : longest), "");
      if (candidate.length > 8) {
        return {
          raw: trimmed,
          isUrl: true,
          address: formatSlugToAddress(candidate),
          source: "homes",
          authorized: true,
        };
      }
    }

    // If host was whitelisted but pattern wasn't standard, use safest path slug
    const segments = pathname.split("/").filter(Boolean);
    const candidate = segments.reduce((longest, curr) => (curr.length > longest.length ? curr : longest), "");
    if (candidate.length > 8) {
      return {
        raw: trimmed,
        isUrl: true,
        address: formatSlugToAddress(candidate),
        source: "zillow",
        authorized: true,
      };
    }
  } catch {}
}

  // Direct raw physical address
  return {
    raw: trimmed,
    isUrl: false,
    address: trimmed.replace(/[<>{}\\]/g, "").trim(),
    source: "direct_address",
    authorized: true,
  };
}

