# PR/FAQ: Model Routing Strategy (Global-First)

## Press Release

**Title**
One AI Interface, Multiple Providers

**Summary**
Doujin adds a single AI routing layer in `apps/api` so features pick a provider/model via configuration, not ad-hoc logic. Gemini 3 (Google AI Studio API key flow) is the default today. Amazon Nova is supported as a future provider behind the same interface.

**How It Works**

- Stable feature ids (credits-aligned): `editor_interpret` (existing), `asset_analyze`, `editor_plan`.
- Global-first routing:
  - `AI_PROVIDER_STRATEGY=auto|gemini|none`
  - Optional future per-feature overrides: `AI_PROVIDER_<FEATURE>`, `AI_MODEL_<FEATURE>`.
- Back-compat: `AI_INTERPRET_MODEL` remains the default model selector for `editor_interpret`.
- Provider selection never comes from client input; only env.

**Why It Matters**
You can ship analysis and planning features once and swap providers later without rewriting endpoints.

## FAQ

**What exists today that this builds on?**
`apps/api/src/routes/editor.ts` already calls Gemini using `GEMINI_API_KEY` and `AI_INTERPRET_MODEL`, and meters usage under `feature=editor_interpret`.

**What is the routing precedence?**

1. Per-feature override (if enabled later)
2. `AI_PROVIDER_STRATEGY`
3. Feature default model (e.g. `AI_INTERPRET_MODEL`)
4. Deterministic fallback (feature-specific)

**How does credits/metering relate?**
Credits are enforced per stable feature id before any provider call. Routing does not bypass policy.

**What is the fallback behavior?**

- `editor_interpret`: fallback allowed (existing `fallbackInterpret()` keeps playback usable).
- `asset_analyze`, `editor_plan`: no silent fallback; return `AI_UNAVAILABLE` when not configured.

**How do we keep this safe?**
Validate model ids (strict regex), never accept provider/model from the request body, store secrets only in `apps/api`.

**Acceptance Criteria**

- With `AI_PROVIDER_STRATEGY=gemini` and `GEMINI_API_KEY` set, `/api/editor/interpret` behaves exactly as today.
- With `AI_PROVIDER_STRATEGY=none` or missing `GEMINI_API_KEY`, interpret falls back deterministically.
- Logs include `feature`, `provider`, `model`, `requestId` for every AI attempt.
