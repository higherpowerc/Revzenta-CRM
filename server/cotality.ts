import { mapCotalityPayload, normalizeAddress, type NormalizedAddress, type UnifiedPropertyFinancialProfile } from "../src/underwritingEngine";

export interface CotalityClientOptions {
  endpoint?: string;
  apiKey?: string;
  fetcher?: typeof fetch;
}

/** Server-only Cotality adapter. Keep the API key out of the browser bundle. */
export async function fetchCotalityVoluntaryLienStatus(
  address: Partial<NormalizedAddress> | string,
  options: CotalityClientOptions = {},
): Promise<UnifiedPropertyFinancialProfile> {
  const normalized = normalizeAddress(address);
  const endpoint = options.endpoint ?? process.env.COTALITY_VOLUNTARY_LIEN_STATUS_URL;
  const apiKey = options.apiKey ?? process.env.COTALITY_API_KEY;
  if (!endpoint) throw new Error("Cotality voluntary lien status endpoint is not configured.");
  if (!apiKey) throw new Error("Cotality API credentials are not configured.");
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ address: normalized }),
  });
  if (!response.ok) throw new Error(`Cotality request failed (${response.status}).`);
  return mapCotalityPayload(await response.json(), normalized);
}