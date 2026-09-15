/**
 * Revzenta Real Estate Wholesaling State Compliance & Statutory Addenda Database
 * Covers all 50 US States + District of Columbia
 *
 * Classifies jurisdictions into:
 * - 'license_required': State law strictly requires a real estate license or limits unlicensed activity (e.g. OK, IL, VA, PA).
 * - 'mandatory_disclosure': State law permits equitable wholesaling but mandates explicit written equitable interest & non-title disclosures (e.g. TX, AR, SC, FL, OH, GA, AZ, NC).
 * - 'standard': Governed by common-law contract assignability and the Doctrine of Equitable Conversion.
 */

export type WholesaleComplianceCategory = "license_required" | "mandatory_disclosure" | "standard";

export interface StateWholesaleRule {
  code: string;
  name: string;
  category: WholesaleComplianceCategory;
  statuteTitle: string;
  citation: string;
  effectiveDate: string;
  summary: string;
  licenseRequiredNotice?: string;
  keyRequirements: string[];
  agreementAddendumTitle: string;
  agreementAddendumClauses: string[];
}

export const STATE_WHOLESALE_RULES: Record<string, StateWholesaleRule> = {
  OK: {
    code: "OK",
    name: "Oklahoma",
    category: "license_required",
    statuteTitle: "Oklahoma Predatory Real Estate Wholesaler Prohibition Act",
    citation: "HB 2673 / 59 O.S. § 858-301 et seq.",
    effectiveDate: "November 1, 2021",
    summary:
      "Oklahoma strictly prohibits any unlicensed individual from publicly marketing or offering to assign equitable interest in a residential sales contract. Wholesalers must hold an active real estate license issued by the Oklahoma Real Estate Commission (OREC) or execute a traditional double close where title is taken prior to resale.",
    licenseRequiredNotice:
      "OREC Active License Mandate: Public marketing of equitable interest in Oklahoma residential real estate without an active OREC license violates 59 O.S. § 858-301. Unlicensed investors must either hold an active license, partner with a licensed brokerage, or fund a legal double-close taking fee-simple title before resale.",
    keyRequirements: [
      "Active Oklahoma Real Estate Commission (OREC) broker or sales associate license required to publicly market equitable interest.",
      "Unlicensed marketing of contracts of sale constitutes unlawful brokerage.",
      "Traditional double closing (taking actual fee-simple title via transactional funding) is permitted without an OREC license.",
      "Licensed individuals must disclose their licensee status in writing to all parties.",
    ],
    agreementAddendumTitle: "Schedule OK-1: Oklahoma Real Estate Wholesaling & OREC Licensing Addendum",
    agreementAddendumClauses: [
      "Subscriber warrants and represents that any marketing, disposition, or contract assignment conducted within the State of Oklahoma complies strictly with the Oklahoma Predatory Real Estate Wholesaler Prohibition Act (59 O.S. § 858-301 et seq.).",
      "Subscriber certifies that if it publicly markets equitable interest or purchase agreements in Oklahoma, Subscriber or its authorized broker of record maintains an active, valid license in good standing with the Oklahoma Real Estate Commission (OREC), OR Subscriber acquires title directly as principal via an independent closing (double-close) prior to conveyance.",
      "Subscriber acknowledges that Revzenta LLC is a software provider only and does not hold an Oklahoma real estate license or authorize unlicensed real estate brokerage.",
    ],
  },
  IL: {
    code: "IL",
    name: "Illinois",
    category: "license_required",
    statuteTitle: "Illinois Real Estate License Act of 2000 (Amended)",
    citation: "SB 1872 / Public Act 101-0357 / 225 ILCS 454/1-10",
    effectiveDate: "August 9, 2019",
    summary:
      "Illinois law defines real estate brokerage to include anyone who wholesales, assigns, or acquires and resells equitable interest in more than one (1) residential property in any 12-month period. Conducting 2 or more wholesale assignments per year requires an active Illinois Real Estate Broker License.",
    licenseRequiredNotice:
      "Illinois 1-Deal Annual Exemption Rule: In Illinois, wholesaling more than one (1) property or contract assignment in any rolling 12-month period constitutes real estate brokerage under 225 ILCS 454/1-10. Conducting multiple wholesale deals requires an active Illinois Broker License or double closing.",
    keyRequirements: [
      "A person may wholesale / assign exactly one (1) residential purchase agreement per rolling 12-month period without a license.",
      "Wholesaling two (2) or more transactions in a 12-month period legally requires an active Illinois Real Estate Broker License.",
      "Double-closing (taking fee simple title at closing A-B, then selling B-C) remains lawful without an Illinois broker license.",
      "All marketing of equitable interest must disclose that the assignor holds contractual rights only.",
    ],
    agreementAddendumTitle: "Schedule IL-1: Illinois Statutory 1-Deal Limit & Broker Licensing Addendum",
    agreementAddendumClauses: [
      "Subscriber warrants that all real estate acquisitions and dispositions within the State of Illinois comply with the Illinois Real Estate License Act of 2000 (225 ILCS 454/1-10 as amended by Public Act 101-0357).",
      "Subscriber acknowledges and agrees that wholesaling or assigning more than one (1) residential real estate contract in any 12-month period in Illinois requires an active Illinois Real Estate Broker License, unless exempt by law.",
      "Subscriber represents that it holds the required Illinois license or restricts its activities to permissible statutory limits, transactional double-closings, or corporate principal acquisitions.",
    ],
  },
  VA: {
    code: "VA",
    name: "Virginia",
    category: "license_required",
    statuteTitle: "Virginia Real Estate Licensing & Equitable Interest Mandate",
    citation: "Senate Bill 358 / Va. Code § 54.1-2100 & § 54.1-2101",
    effectiveDate: "July 1, 2024",
    summary:
      "Virginia Senate Bill 358 classifies any person marketing or offering to sell an equitable interest in a single-family residential contract for valuable consideration as a real estate broker or salesperson, requiring an active Virginia Real Estate Board license.",
    licenseRequiredNotice:
      "Virginia Real Estate Board Mandate (SB 358): Effective July 1, 2024, marketing an equitable interest in residential property for compensation in Virginia requires an active real estate license under Va. Code § 54.1-2100.",
    keyRequirements: [
      "Active Virginia Real Estate Board license required to market residential equitable interest for a fee.",
      "Direct double closings (where the wholesaler takes legal title) remain lawful as a principal investor.",
      "Written disclosure of contractual interest required in all communications.",
    ],
    agreementAddendumTitle: "Schedule VA-1: Virginia SB 358 Real Estate Licensing Mandate Addendum",
    agreementAddendumClauses: [
      "Subscriber warrants that all operations in the Commonwealth of Virginia adhere strictly to Virginia Senate Bill 358 (Va. Code § 54.1-2100 et seq.).",
      "Subscriber certifies that if it markets an equitable interest in single-family residential property for a fee or assignment consideration, it operates under an active Virginia real estate license or lawful exemption.",
    ],
  },
  PA: {
    code: "PA",
    name: "Pennsylvania",
    category: "license_required",
    statuteTitle: "Pennsylvania Real Estate Licensing and Registration Act (RELRA) Amendment",
    citation: "Act 52 / 63 P.S. § 455.201 et seq.",
    effectiveDate: "July 2024",
    summary:
      "Pennsylvania Act 52 amends RELRA to prohibit unlicensed individuals from publicly marketing or offering to assign equitable interests in residential agreements of sale without an active real estate license, unless operating as an exempt owner or trustee.",
    licenseRequiredNotice:
      "Pennsylvania RELRA Act 52 Notice: Marketing equitable interests in residential contracts without a Pennsylvania real estate license is restricted under 63 P.S. § 455.201.",
    keyRequirements: [
      "Real estate license required to market equitable interests to third parties.",
      "Double closing with actual acquisition of deed title permitted.",
      "Clear written non-agency disclosure required.",
    ],
    agreementAddendumTitle: "Schedule PA-1: Pennsylvania Act 52 Real Estate Licensing Addendum",
    agreementAddendumClauses: [
      "Subscriber covenants that all transactions in the Commonwealth of Pennsylvania comply with the Pennsylvania Real Estate Licensing and Registration Act (63 P.S. § 455.201 et seq. as amended by Act 52).",
      "Subscriber agrees that marketing equitable interest in residential contracts shall be conducted only by licensed individuals or pursuant to statutory double-closing procedures.",
    ],
  },
  TX: {
    code: "TX",
    name: "Texas",
    category: "mandatory_disclosure",
    statuteTitle: "Texas Real Estate License Act (TRELA) Equitable Interest Disclosure",
    citation: "Texas Occupations Code § 1101.0045 (Senate Bill 2212)",
    effectiveDate: "September 1, 2017",
    summary:
      "Texas expressly permits wholesaling equitable interest, but mandates that the wholesaler disclose in writing to both the seller and any prospective buyer that the wholesaler holds only equitable interest and does not hold legal title. Failing to provide this disclosure constitutes unlicensed real estate brokerage under TREC rules.",
    licenseRequiredNotice:
      "Texas Mandatory Equitable Disclosure (SB 2212): Under Tex. Occ. Code § 1101.0045, you MUST disclose in writing to any potential buyer that you hold equitable interest only and not legal title. Revzenta's Texas contracts include this mandatory TREC disclosure.",
    keyRequirements: [
      "Mandatory written disclosure to all buyers and sellers: 'Assignor holds equitable interest only and does not hold legal title.'",
      "Assignor cannot market the physical real estate property itself, only the assignment of contract rights.",
      "Equitable interest disclosure must be prominent in all marketing flyers, texts, emails, and purchase contracts.",
      "Licensed Texas agents wholesaling must disclose their licensed status and use approved TREC forms or attorney addenda.",
    ],
    agreementAddendumTitle: "Schedule TX-1: Texas SB 2212 Mandatory Equitable Interest & Title Disclosure Addendum",
    agreementAddendumClauses: [
      "Subscriber acknowledges that under Texas Occupations Code § 1101.0045, it is lawful to acquire an option or enter into a purchase contract to purchase real property and then sell or assign the equitable interest, PROVIDED THAT Subscriber discloses the nature of the equitable interest in writing to any prospective buyer.",
      "Subscriber warrants that all marketing communications, deal flyers, text pitches, and purchase contracts deployed in Texas state explicitly: 'Assignor holds equitable interest only pursuant to a purchase agreement and does not hold legal title to the subject property.'",
      "Subscriber agrees to indemnify Revzenta LLC from any TREC complaints or regulatory actions resulting from Subscriber's failure to provide mandatory statutory disclosures.",
    ],
  },
  AR: {
    code: "AR",
    name: "Arkansas",
    category: "mandatory_disclosure",
    statuteTitle: "Arkansas Real Estate Commission Act 898",
    citation: "Ark. Code § 17-42-104 et seq.",
    effectiveDate: "July 2021",
    summary:
      "Arkansas requires clear written disclosure of equitable interest and explicitly prohibits wholesalers from advertising or representing real property as their own without disclosing their contractual equitable interest.",
    keyRequirements: [
      "Mandatory written disclosure that wholesaler holds equitable interest only.",
      "Cannot publicly advertise the property without explicit disclosure of equitable status.",
      "Standard contract assignment and double closing are permitted.",
    ],
    agreementAddendumTitle: "Schedule AR-1: Arkansas Act 898 Equitable Interest Disclosure Addendum",
    agreementAddendumClauses: [
      "Subscriber warrants compliance with Arkansas Real Estate License Law (Ark. Code § 17-42-104) and agrees to provide written disclosure of equitable interest on all Arkansas transactions.",
    ],
  },
  SC: {
    code: "SC",
    name: "South Carolina",
    category: "mandatory_disclosure",
    statuteTitle: "South Carolina Real Estate Commission Practice Act",
    citation: "S.C. Code Ann. § 40-57-30 et seq.",
    effectiveDate: "2023",
    summary:
      "South Carolina requires strict written disclosure that the wholesaler is selling contractual rights and equitable interest, not acting as an agent or owner of legal title.",
    keyRequirements: [
      "Written disclosure of equitable interest and non-agency representation.",
      "Cannot misrepresent ownership of legal title.",
      "Contracts must clearly state assignability.",
    ],
    agreementAddendumTitle: "Schedule SC-1: South Carolina Real Estate Disclosure Addendum",
    agreementAddendumClauses: [
      "Subscriber warrants that in South Carolina, Subscriber operates as an independent principal selling contractual rights and provides all required statutory disclosures.",
    ],
  },
  FL: {
    code: "FL",
    name: "Florida",
    category: "mandatory_disclosure",
    statuteTitle: "Florida Real Estate Licensing Law & Contract Assignment Doctrine",
    citation: "Florida Statutes Chapter 475 (Part I)",
    effectiveDate: "Established Florida Common & Statutory Law",
    summary:
      "Florida permits wholesaling via contract assignment under common law, provided the wholesaler markets solely their 'contractual rights / equitable interest' and never markets the physical real estate without an active Florida DBPR license.",
    keyRequirements: [
      "Marketing must explicitly state 'Assignment of Contract Rights' rather than advertising the physical home.",
      "No agency representation of the seller is permitted without an active Florida license.",
      "Earnest money deposits must be held in a licensed Florida title company or escrow agent.",
    ],
    agreementAddendumTitle: "Schedule FL-1: Florida Chapter 475 Contractual Assignment Addendum",
    agreementAddendumClauses: [
      "Subscriber warrants that all Florida wholesale marketing emphasizes the assignment of contractual rights and does not constitute unlicensed real estate brokerage under F.S. Chapter 475.",
    ],
  },
  OH: {
    code: "OH",
    name: "Ohio",
    category: "mandatory_disclosure",
    statuteTitle: "Ohio Real Estate Licensing Act & Equitable Rights Doctrine",
    citation: "Ohio Revised Code § 4735.01 et seq.",
    effectiveDate: "Established Ohio Law",
    summary:
      "Ohio permits contract assignments, but wholesalers must disclose their equitable interest in writing and cannot represent sellers or act as unlicensed intermediaries.",
    keyRequirements: [
      "Clear written disclosure of equitable interest to both seller and buyer.",
      "Cannot hold oneself out as a real estate licensee or broker.",
    ],
    agreementAddendumTitle: "Schedule OH-1: Ohio ORC § 4735 Equitable Rights Addendum",
    agreementAddendumClauses: [
      "Subscriber warrants that in Ohio, Subscriber acts solely as a principal acquiring and assigning contractual rights under ORC § 4735.",
    ],
  },
  GA: {
    code: "GA",
    name: "Georgia",
    category: "mandatory_disclosure",
    statuteTitle: "Georgia Real Estate Commission (GREC) License Law",
    citation: "O.C.G.A. § 43-40-1 et seq.",
    effectiveDate: "Established Georgia Law",
    summary:
      "Georgia permits wholesaling equitable interest. GREC guidelines require wholesalers to market only the contractual right of purchase and never advertise the physical property without a license.",
    keyRequirements: [
      "Must market the contract for purchase, not the real property itself.",
      "Written disclosure of non-agency status required.",
    ],
    agreementAddendumTitle: "Schedule GA-1: Georgia GREC Contract Marketing Addendum",
    agreementAddendumClauses: [
      "Subscriber warrants that in Georgia, all marketing materials identify the offering as an assignment of purchase contract pursuant to GREC rules.",
    ],
  },
  AZ: {
    code: "AZ",
    name: "Arizona",
    category: "mandatory_disclosure",
    statuteTitle: "Arizona Department of Real Estate (ADRE) Wholesale Disclosures",
    citation: "A.R.S. § 32-2181 et seq. & ADRE Substantive Policy",
    effectiveDate: "Established Arizona Law",
    summary:
      "Arizona allows contract assignments with transparent written disclosure that the wholesaler holds equitable interest only and disclosing any assignment fee paid by the buyer.",
    keyRequirements: [
      "Mandatory equitable interest disclosure to cash buyers.",
      "Clear accounting of assignment fees on settlement statements.",
    ],
    agreementAddendumTitle: "Schedule AZ-1: Arizona ADRE Wholesale Disclosure Addendum",
    agreementAddendumClauses: [
      "Subscriber warrants compliance with ADRE disclosure standards and confirms transparent equitable interest notices on all Arizona agreements.",
    ],
  },
  NC: {
    code: "NC",
    name: "North Carolina",
    category: "mandatory_disclosure",
    statuteTitle: "North Carolina Real Estate Commission (NCREC) License Law",
    citation: "N.C. Gen. Stat. § 93A-1 et seq.",
    effectiveDate: "Established North Carolina Law",
    summary:
      "North Carolina permits wholesaling equitable interest with mandatory written notice that the wholesaler holds contractual interest only.",
    keyRequirements: [
      "Written disclosure of equitable interest.",
      "Cannot represent third parties without an active NCREC license.",
    ],
    agreementAddendumTitle: "Schedule NC-1: North Carolina NCREC Equitable Disclosure Addendum",
    agreementAddendumClauses: [
      "Subscriber warrants compliance with NCREC standards regarding principal capacity and equitable contract marketing in North Carolina.",
    ],
  },
};

// All 50 US States + DC metadata table
export const ALL_US_STATES: Array<{ code: string; name: string }> = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

/**
 * Returns comprehensive wholesale compliance rules for a given state code.
 * Defaults to standard equitable interest doctrine if state has no specialized statute.
 */
export function getStateComplianceRule(stateCode: string): StateWholesaleRule {
  const code = (stateCode || "TX").toUpperCase();
  if (STATE_WHOLESALE_RULES[code]) {
    return STATE_WHOLESALE_RULES[code];
  }

  const found = ALL_US_STATES.find((s) => s.code === code);
  const name = found ? found.name : stateCode;

  return {
    code,
    name,
    category: "standard",
    statuteTitle: `${name} Equitable Conversion & Contract Assignment Doctrine`,
    citation: `${name} Common Law & Uniform Commercial / Property Code`,
    effectiveDate: "In Effect",
    summary: `In ${name}, real estate contract assignments are governed under standard contract law and the Doctrine of Equitable Conversion. Wholesalers must operate strictly as independent principals selling equitable contractual rights, and must never represent themselves as licensed agents or fiduciaries of the homeowner.`,
    keyRequirements: [
      "Wholesaler acts strictly as a principal acquiring equitable interest, not as an agent or broker.",
      "Contracts must expressly provide for assignability without seller objection.",
      "Assignor must disclose in writing that it is assigning its purchase contract rights, not selling the deed directly.",
      "Earnest money deposits must be held by a licensed local title company or closing attorney.",
    ],
    agreementAddendumTitle: `Schedule ${code}-1: ${name} Equitable Interest & Non-Agency Investor Warranty`,
    agreementAddendumClauses: [
      `Subscriber warrants that all real estate acquisitions and contract assignments in ${name} are conducted strictly in an independent principal capacity pursuant to the Doctrine of Equitable Conversion.`,
      `Subscriber covenants that it does not represent third-party homeowners as a licensed fiduciary or broker in ${name} unless Subscriber or its supervising broker holds an active real estate license in ${name}.`,
      `Subscriber acknowledges that Revzenta LLC is an enterprise software provider and that Subscriber maintains sole responsibility for adhering to local licensing, assignment, and escrow standards in ${name}.`,
    ],
  };
}

/**
 * Helper to check if state strictly mandates a license or has strict deal volume limits.
 */
export function isLicenseRequiredState(stateCode: string): boolean {
  const rule = getStateComplianceRule(stateCode);
  return rule.category === "license_required";
}

/**
 * Helper to check if state has mandatory equitable disclosure statutes.
 */
export function isMandatoryDisclosureState(stateCode: string): boolean {
  const rule = getStateComplianceRule(stateCode);
  return rule.category === "mandatory_disclosure";
}
