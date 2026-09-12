import { GoogleGenAI } from "@google/genai";

export interface GeminiClientStatus {
  isConfigured: boolean;
  model: string;
  maskedApiKey: string;
  requestsTotal: number;
  errorsTotal: number;
  lastUsedAt?: string;
}

let requestsTotal = 0;
let errorsTotal = 0;
let lastUsedAt: string | undefined = undefined;

/**
 * Mask an API key to protect secrets from being leaked in logs or client responses.
 * Example: AIzaSyD987...1234
 */
export function maskApiKey(key?: string): string {
  if (!key) return "NOT_CONFIGURED";
  const trimmed = key.trim();
  if (trimmed.length <= 8) return "********";
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

/**
 * Resolves the Gemini API Key from environment variables.
 */
export function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
}

/**
 * Resolves the Gemini model name (default: gemini-2.5-flash).
 */
export function getGeminiModelName(): string {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

/**
 * Returns an instance of GoogleGenAI client if configured, otherwise null.
 */
export function getGeminiClient(): {
  client: GoogleGenAI | null;
  model: string;
  isConfigured: boolean;
} {
  const apiKey = getGeminiApiKey();
  const model = getGeminiModelName();

  if (!apiKey || !apiKey.trim()) {
    return { client: null, model, isConfigured: false };
  }

  try {
    const client = new GoogleGenAI({ apiKey: apiKey.trim() });
    return { client, model, isConfigured: true };
  } catch (err) {
    console.error("[Gemini Client] Failed to instantiate GoogleGenAI:", err);
    return { client: null, model, isConfigured: false };
  }
}

/**
 * Records a successful or attempted Gemini API request for Dev Command Center telemetry.
 */
export function recordGeminiRequest(success: boolean) {
  requestsTotal++;
  lastUsedAt = new Date().toISOString();
  if (!success) {
    errorsTotal++;
  }
}

/**
 * Telemetry and status for Dev Command Center / Healthcheck.
 */
export function getGeminiStatus(): GeminiClientStatus {
  const apiKey = getGeminiApiKey();
  return {
    isConfigured: Boolean(apiKey && apiKey.trim()),
    model: getGeminiModelName(),
    maskedApiKey: maskApiKey(apiKey),
    requestsTotal,
    errorsTotal,
    lastUsedAt,
  };
}

/**
 * Resets telemetry counters (useful for unit tests).
 */
export function resetGeminiTelemetry() {
  requestsTotal = 0;
  errorsTotal = 0;
  lastUsedAt = undefined;
}
