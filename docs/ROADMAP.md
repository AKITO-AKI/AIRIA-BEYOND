# Product Roadmap (next adjustments & implementations)

This roadmap assumes the **refine → music → image** generation flow is now stable, resilient (fallback-first), and validated via HTTP smoke (`npm run smoke:e2e:http`). The next work focuses on **product value**, **quality loops**, and **production hardening**.

## 0) Current baseline (what’s already solid)

- End-to-end generation completes even without external provider keys (rule-based music + placeholder image).
- “Artistic depth” controls exist (music form/period/leitmotifs/humanize; image density + art-history / synesthetic mapping).
- A strict-provider validation mode exists in smoke testing (use when real providers are configured).
- UI/typing hygiene improved around refine→generate (less `any`, more explicit request types).

## Guiding product principles

- **Always ship an experience**: never hard-fail; degrade gracefully with clear status + recovery.
- **White-world tone consistency**: UI should feel like paper/porcelain/frosted-glass; “liner notes” instead of debug panels.
- **Privacy-first**: minimize what’s sent to providers; make optional inputs explicit.
- **Cost-aware**: defaults should be cheap; “quality” upgrades should be deliberate.
- **Reproducible creativity**: when a user likes a result, they should be able to regenerate/variant it reliably.

---

## 1) Next 1–2 weeks (high leverage, low risk)

### A. UX: make generation feel intentional (not just async jobs)

- **Progress narrative** (not just spinner): show steps like “refine → composition plan → performance shaping → cover art”.
- **Resume + recovery**: one-click “resume generation” when network drops (already conceptually present; tighten edge cases).
- **Controls surfaced gently**: expose `image.density` and `music.humanize` as “Artistic” sliders/toggles with safe presets.

Acceptance criteria:
- User can start generation, reload, and still see job status + resume.
- Generation screen communicates *what’s happening* in 1–2 lines, aligned to white-world tone.

### B. Quality loop: define what “good” means, then measure it

- Add a lightweight **“golden prompts”** list (10–30 scenarios) and expected structural properties.
- Expand smoke coverage from “does it complete?” to “does it satisfy invariants?” (e.g., cadence presence, section count bounds, density within range).

Acceptance criteria:
- `npm run smoke:e2e:http` remains green.
- A new repeatable check can be run locally to validate invariants on the golden set.

### C. Developer hygiene: reduce drift and regressions

- Introduce real `lint`/`format` scripts (currently placeholders in root `package.json`).
- Add CI steps beyond build: at minimum, run the fallback E2E smoke.

Acceptance criteria:
- CI runs build + smoke (fallback mode) on PR.
- Formatting/linting is one command and consistent across packages.

### D. Security: close the obvious gaps

- Protect admin endpoints (token + rate-limit + audit log).
- Tighten CORS to explicit allowed origins in production.

Acceptance criteria:
- Admin endpoints require auth and fail closed.
- Production CORS is explicit and tested.

---

## 2) Next 1 month (production durability + better “repeatability”)

### A. Persistence: jobs should survive restarts

Today job stores are effectively ephemeral (in-memory). Move toward persistence:
- Store job metadata and results in Postgres (Neon is already recommended in deployment docs).
- Add retention/cleanup policies (e.g., 7–30 days).

Acceptance criteria:
- Restarting the API does not lose active job status.
- Users can revisit recent creations reliably.

### B. Reproducibility + variations

- Add explicit **“seed + recipe”** capture for both music and image.
- Support “generate variation” that nudges only selected axes (e.g., same motifs, new harmony; same density, new palette).

Acceptance criteria:
- A saved work can be regenerated closely with the same recipe.
- Variations are meaningfully different while preserving identity.

### C. Provider integration maturity

- Establish a provider matrix and consistent behavior:
  - Music: OpenAI vs Ollama vs rule-based (feature parity on schema fields).
  - Image: Replicate vs ComfyUI vs placeholder (consistent prompt/preset overlay).
- Add a staging-only strict-provider check (nightly) to catch breaking provider changes.

Acceptance criteria:
- A “strict” run is available in staging and fails fast when providers are misconfigured.
- Provider-specific regressions are detected within 24h.

### D. Observability: see what users experience

- Add correlation IDs across refine/music/image requests.
- Dashboard-worthy metrics: job latency percentiles, fallback rate, provider error codes, cost estimates.

Acceptance criteria:
- You can answer: “what % of generations used fallback?” and “where do failures cluster?”

---

## 3) Next 3 months (product differentiation)

### A. Creative companionship features

- “Liner Notes / 解説” becomes a first-class artifact:
  - Explain musical form, motifs, tension→resolution.
  - Explain visual mapping: period → style, instrumentation → texture.
- Add “listen while reading” synchronized notes (section markers).

### B. Library experience (the bookshelf)

- Strengthen the shelf metaphor: spines, collections, timestamps, “new album lands once” animation.
- Search and filters (mood arc, period, density, instrumentation).

### C. Personalization and memory (opt-in)

- Let users opt into a personal style profile (“likes high density”, “prefers romantic piano”).
- Use retrieval of a user’s favorite prior recipes as few-shot examples (safer than fine-tuning).

### D. Advanced quality research

- Retrieval-based prompting with curated public-domain-inspired structures.
- Optional fine-tuning only for schema compliance (see `docs/FINE_TUNING_NOTES.md`).

---

## Recommended sequencing (if you want one ‘north star’ path)

1) UX progress narrative + resume stability
2) Golden prompts + invariant checks (quality loop)
3) CI smoke (fallback) + nightly strict in staging
4) Persist jobs to Postgres + retention
5) Reproducible recipes + variations
6) Liner Notes as a product surface

## Open questions (worth deciding early)

- Primary production target: Render vs VPS vs hybrid? (Docs currently mention multiple.)
- What is the “default experience” for users without provider keys (always fallback, or guided setup)?
- Do we optimize for “instant preview” (fast placeholders) or “wait for quality” (longer but better)?
