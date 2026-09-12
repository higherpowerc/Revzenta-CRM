import { describe, expect, it } from "bun:test";
import {
  parseAddressString,
  extractAddressFromUrl,
  normalizeAddressForCache,
  normalizeWebhookPayload,
} from "../server/propertyEnrichment";

describe("Property Enrichment & Ingestion", () => {
  describe("Address String Parsing", () => {
    it("parses 3-part comma separated addresses", () => {
      const parsed = parseAddressString("123 Main St, Phoenix, AZ 85001");
      expect(parsed.addressLine1).toBe("123 Main St");
      expect(parsed.city).toBe("Phoenix");
      expect(parsed.state).toBe("AZ");
      expect(parsed.zipCode).toBe("85001");
    });

    it("parses 2-part comma separated addresses with state and zip", () => {
      const parsed = parseAddressString("456 Elm Ave, Dallas TX 75201");
      expect(parsed.addressLine1).toBe("456 Elm Ave");
      expect(parsed.city).toBe("Dallas");
      expect(parsed.state).toBe("TX");
      expect(parsed.zipCode).toBe("75201");
    });
  });

  describe("URL Address Extraction & SSRF Security", () => {
    it("extracts physical address from authorized Zillow URL", () => {
      const url = "https://www.zillow.com/homedetails/123-Main-St-Scottsdale-AZ-85251/12345678_zpid/";
      const extracted = extractAddressFromUrl(url);
      expect(extracted.toLowerCase()).toContain("123 main st");
      expect(extracted.toLowerCase()).toContain("scottsdale");
      expect(extracted.toUpperCase()).toContain("AZ");
    });

    it("extracts physical address from authorized Redfin URL", () => {
      const url = "https://www.redfin.com/AZ/Phoenix/1234-W-Camelback-Rd-85013/home/456789";
      const extracted = extractAddressFromUrl(url);
      expect(extracted.toLowerCase()).toContain("1234 w camelback rd");
      expect(extracted.toLowerCase()).toContain("phoenix");
      expect(extracted.toUpperCase()).toContain("AZ");
    });

    it("passes through standard physical address", () => {
      const addr = "789 Pine Lane, Tampa, FL 33602";
      expect(extractAddressFromUrl(addr)).toBe(addr);
    });

    it("blocks SSRF attempts on internal IP addresses", () => {
      expect(() => extractAddressFromUrl("http://localhost:8080/property/1")).toThrow("Security Violation");
      expect(() => extractAddressFromUrl("http://127.0.0.1:3000")).toThrow("Security Violation");
      expect(() => extractAddressFromUrl("http://192.168.1.1/admin")).toThrow("Security Violation");
      expect(() => extractAddressFromUrl("http://10.0.0.1")).toThrow("Security Violation");
      expect(() => extractAddressFromUrl("http://169.254.169.254/latest/meta-data/")).toThrow("Security Violation");
    });

    it("blocks unauthorized domains", () => {
      expect(() => extractAddressFromUrl("https://evil-hacker-site.com/property")).toThrow("UNAUTHORIZED_URL");
    });
  });

  describe("Cache Key Address Normalization", () => {
    it("normalizes addresses to avoid duplicate queries", () => {
      const raw1 = "123 North Main Street, Apt 4B, Phoenix, AZ 85001";
      const raw2 = "123 N. Main St., Apt 4B Phoenix AZ 85001";

      const key1 = normalizeAddressForCache(raw1);
      const key2 = normalizeAddressForCache(raw2);

      // Both should expand/collapse street suffixes consistently
      expect(key1).toContain("123 n main st");
      expect(key2).toContain("123 n main st");
    });
  });

  describe("Webhook Payload Normalization", () => {
    it("normalizes flat webhook payloads from webforms", () => {
      const payload = {
        address: "5500 Grand Lake Dr",
        city: "San Antonio",
        state: "TX",
        zip: "78244",
        name: "John Doe",
        phone: "210-555-0199",
        email: "john@example.com",
        estimated_value: "320000",
        asking_price: "240000",
        source: "Facebook Ads",
        lead_type: "Pre-Foreclosure",
        bedrooms: 3,
        bathrooms: 2,
        sqft: 1850,
      };

      const norm = normalizeWebhookPayload(payload);

      expect(norm.address).toBe("5500 Grand Lake Dr");
      expect(norm.city).toBe("San Antonio");
      expect(norm.state).toBe("TX");
      expect(norm.sellerName).toBe("John Doe");
      expect(norm.estimatedValue).toBe(320000);
      expect(norm.askingPrice).toBe(240000);
      expect(norm.bedrooms).toBe(3);
      expect(norm.bathrooms).toBe(2);
      expect(norm.squareFootage).toBe(1850);
      expect(norm.source).toContain("Facebook Ads");
    });

    it("normalizes nested webhook payloads (e.g. Zapier / BatchLeads format)", () => {
      const payload = {
        lead: {
          PropertyAddress: "101 River Rd",
          City: "Austin",
          State: "TX",
          Zip: "78701",
          OwnerName: "Jane Smith",
          Phone: "512-555-1234",
          AVM: 450000,
          leadSource: "BatchLeads",
        },
      };

      const norm = normalizeWebhookPayload(payload);

      expect(norm.address).toBe("101 River Rd");
      expect(norm.city).toBe("Austin");
      expect(norm.sellerName).toBe("Jane Smith");
      expect(norm.estimatedValue).toBe(450000);
      expect(norm.source).toBe("BatchLeads");
    });
  });
});
