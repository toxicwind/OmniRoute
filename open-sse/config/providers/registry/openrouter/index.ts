import type { RegistryEntry } from "../../shared.ts";

export const openrouterProvider: RegistryEntry = {
  id: "openrouter",
  alias: "openrouter",
  format: "openai",
  executor: "default",
  baseUrl: "https://openrouter.ai/api/v1/chat/completions",
  authType: "apikey",
  authHeader: "bearer",
  defaultContextLength: 128000,
  // #11226: OpenRouter's /api/v1/models is PUBLIC (200 with any or no key), so the
  // generic /models probe validated every key — even garbage ones — and bad keys
  // only surfaced later as upstream 401 "User not found." on real chat traffic.
  // /api/v1/auth/key is the authenticated key-info endpoint: 200 = valid, 401 = invalid.
  testKeyModelsUrl: "https://openrouter.ai/api/v1/auth/key",
  headers: {
    "HTTP-Referer": "https://endpoint-proxy.local",
    "X-Title": "Endpoint Proxy",
  },
  // OpenRouter multiplexes hundreds of independent upstream models behind one
  // connection/API key — without this flag, hasPerModelQuota() (accountFallback.ts)
  // falls through to connection-wide cooldown on any model-specific failure (e.g. a
  // 404 "No endpoints found" for one dead/renamed model), poisoning every OTHER
  // OpenRouter model on the same connection for the cooldown window and surfacing
  // that first model's stale error message on their unrelated requests.
  passthroughModels: true,
  models: [{ id: "auto", name: "Auto (Best Available)" }],
};

// Lane-health recon (probed live 2026-10-26, kappa session):
// full dossier at estate/docs/recon/openrouter-privacy-routing-2026-10-26.md
// - Guardrail/privacy blocks surface as HTTP 404 with the body
//   "0 endpoints out of N requested are available matching your guardrail
//   restrictions and data policy." plus structured
//   metadata.failed_routing_step="Filter by Guardrails" and
//   metadata.ineligibility_reasons[].reason in {model-ignored-by-guardrail,
//   zdr-violation-by-account, zdr-violation-by-guardrail} — PERMANENT, never
//   retryable (the old message text no longer matches; match these fields).
// - 402 "Insufficient credits" is a TERMINAL account state (credits_exhausted),
//   not a cooldown — verified on every paid model.
// - ":free" ids are per-model, not per-account: some 404 ("unavailable for
//   free"), some 429 (provider error), some 200 — never assume a :free id works.
// - /api/v1/auth/key (above) is the ONLY key-validation endpoint; /api/v1/key
//   returns 401 "Missing Authentication header" for ANY Bearer key — do not
//   probe it as a liveness check (it false-negatived keypool keys).
