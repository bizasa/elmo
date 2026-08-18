# AI Mentions Explorer Report — Design

Date: 2026-08-18
Repo: `E:\Projects\elmo` (fork `bizasa/elmo`), deploy target `contabo-sg` → https://geo.vidi.com.vn
Status: approved design, pending spec review → implementation plan

## Problem

Operators want a rich, per-brand HTML report that reproduces the content and format of the
previously hand-built `visana-explorer.html` — an interactive explorer over every AI answer
that mentions (or omits) a tracked brand — generated on demand inside the app and viewable in
the reports module of geo.vidi.com.vn. A short narrative (executive summary, findings,
recommendations) written by an LLM sits on top of the data explorer.

## Key insight

`visana-explorer.html` is a **deterministic data explorer**: every card is real data from the
DB, and filtering/search runs client-side in JS. No LLM authors the data. The LLM (Vilao)
contributes **only a narrative layer** grounded in pre-computed metrics — it never invents
numbers or writes the HTML shell.

This is distinct from Elmo's existing `reports` subsystem, which takes a *new* brand
name+website and **re-scrapes from scratch** (~84 prompts × 3 surfaces × 5 ≈ 1,260 BrightData
credits per report) before rendering a static printable PDF. The new feature reads
**already-collected** tracked-brand data and does **no scraping** (zero incremental credit).

## Goals

- Generate a per-brand explorer report from existing `prompt_runs` over a chosen day window.
- Reproduce the content + format of `visana-explorer.html` (cards, model chips, tag/model/
  mentioned filters, brand & competitor highlighting in excerpts, client-side search).
- Add a grounded narrative layer written by a Vilao model, in the brand's language.
- View the finished report inside the app at a dedicated route, gated by existing report access.
- Robust LLM path: model fallback chain within Vilao, with OpenRouter as a final safety net.

## Non-goals

- No new scraping / no BrightData usage for report generation.
- No changes to the existing `reports` (Share of Voice) subsystem — it stays untouched.
- No live-refreshing explorer: data is snapshotted at generation time (a report is a
  point-in-time artifact, matching how existing reports store `rawOutput`).
- Vilao does not author HTML or data; narrative only.

## Decisions (resolved during brainstorming)

| Question | Decision |
|---|---|
| LLM role | Narrative only (exec summary / findings / competitor gaps / recommendations) |
| Data source & scope | Tracked brand + day window; read existing `prompt_runs`, no scrape |
| Render/storage | Hybrid: reuse the file's HTML/CSS/JS template, inject data + narrative, store an HTML snapshot |
| Table | New `explorer_reports` table (additive create-table migration; existing `reports` untouched) |
| Vilao key | `content-hub` (`sk-85b1…`) — dedicated for clean cost attribution |
| Model default | `occ/claude-sonnet-5`, configurable via env + per-report override |
| Opus | `occ/claude-opus-4-8` IS available on Vilao — usable as default or top fallback if max prose quality wanted; not required since narrative is grounded |
| Fallback | Vilao chain `sonnet-5 → gpt-5.5 → sonnet-5 (alt route)`, then OpenRouter as final fallback |
| Language | Auto by brand (Visana→vi, avia/cozyhome→en), override at generation time |

### Vilao models available (as of 2026-08-18)

Confirmed model ids on the Vilao gateway (supersedes the older list in global CLAUDE.md; note
`claude-sonnet-4-6` is **gone**). The `occ/` `krr/` `gx/` `cd/` prefixes are different upstream
routes — a same-model / different-route pair (e.g. `occ/claude-sonnet-5` ↔ `krr/claude-sonnet-5`)
is a good fallback because it routes around a single dead provider without changing the model.

- `occ/claude-sonnet-5`, `krr/claude-sonnet-5` — Sonnet 5 (two routes)
- `occ/claude-opus-4-8` — Opus 4.8
- `occ/claude-fable-5` — Fable 5
- `gx/gpt-5.5`, `cd/gpt-5.5` — GPT-5.5 (two routes)
- `cd/gpt-5.6-sol`, `cd/gpt-5.6-terra` — GPT-5.6 variants
- Combos: `gpt5`, `priority`

## Data model — new table `explorer_reports`

Defined in `packages/lib/src/db/schema.ts`, `.enableRLS()` like sibling tables.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk, defaultRandom | |
| `brand_id` | text, FK → `brands.id`, not null | tracked brand |
| `brand_name` | text, not null | snapshot of name at generation |
| `window_days` | integer, not null | e.g. 30 / 90 |
| `language` | text, not null | `vi` / `en` — narrative language |
| `model` | text, not null | Vilao model actually used (records fallback outcome) |
| `status` | enum (`pending`/`processing`/`completed`/`failed`), default `pending` | reuse/mirror `reportStatusEnum` |
| `progress` | integer, not null, default 0 | |
| `html` | text | final self-contained HTML snapshot (the deliverable) |
| `narrative` | json | `{ executiveSummary, keyFindings[], competitorGaps, recommendations[] }` for re-render/debug |
| `created_at` | timestamptz, defaultNow, not null | |
| `completed_at` | timestamptz | |
| `updated_at` | timestamptz, defaultNow, $onUpdate, not null | |

Index on `created_at`. Migration is **create-table only** (safe/additive); it does not alter
any in-use table.

## Generation flow — worker job `generate-explorer-report`

New job registered in the worker alongside `generate-report`. Steps:

1. Load `brand`, its `prompts` (with tags), `competitors`, and `prompt_runs` within
   `window_days`. SELECT-only joins; no scraping.
2. Compute deterministic metrics by reusing `packages/lib/src/report-metrics.ts` helpers
   (overall SoV, per-model, per-prompt, per-tag) plus competitor gap analysis and average
   position. Build per-answer excerpts + brand/competitor highlight offsets by reusing the
   excerpt logic from `packages/lib/src/text-extraction.ts` (same logic already vendored in
   the geo-mcp data-api).
3. Assemble the `DATA` object the explorer template consumes: one entry per answer (model,
   prompt, tags, position, mentioned flag, excerpt, competitors named), plus aggregate blocks.
4. Call Vilao **once** (see integration) passing the **computed metrics** (not raw answers) to
   get a narrative JSON in `language`. The prompt instructs the model to use only the provided
   numbers and never invent figures.
5. Render final HTML by reusing the `visana-explorer.html` template (CSS + client-side filter
   JS unchanged), injecting the `DATA` script and the narrative block at the top. Store in
   `html`; store the narrative JSON in `narrative`.
6. Update `status`/`progress` throughout; mark `completed` + `completed_at` at the end, or
   `failed` on error.

Progress persistence mirrors `generate-report.ts` (`updateProgress` writing to the row).

## Vilao integration + fallback

New client `vilao.ts` (in worker, or `packages/lib` if shared) calling the Cloudflare AI
Gateway, OpenAI-compatible endpoint `custom-vilao/v1/chat/completions`:

- Headers: `cf-aig-authorization: <CF_AIG_TOKEN>`, `Authorization: Bearer <VILAO_API_KEY>`.
- Trim all secrets (`\r\n` hazard seen with PowerShell-written secrets — see geo-mcp notes).
- Request narrative as strict JSON (response parsed + validated with zod).

Fallback wrapper: iterate `VILAO_MODEL_CHAIN`; on timeout / 5xx / empty-or-invalid response /
refusal, advance to the next model. If the whole Vilao chain fails, fall back to OpenRouter
(already configured in Elmo's provider layer) with an equivalent prompt. The `model` column
records which model actually produced the narrative.

New env (added to `~/.elmo/.env`, mode 600):

```
VILAO_API_KEY=<content-hub key sk-85b1…>
VILAO_GATEWAY_URL=<CF AI Gateway base, .../custom-vilao/v1/chat/completions>
CF_AIG_TOKEN=<cf-aig-authorization token>
VILAO_MODEL=occ/claude-sonnet-5
VILAO_MODEL_CHAIN=occ/claude-sonnet-5,gx/gpt-5.5,krr/claude-sonnet-5
```

(For max prose quality, set `VILAO_MODEL=occ/claude-opus-4-8` — it is available; one env change.)

Config validation for these lives in `packages/config` env schema (optional, so UI-only dev
still boots). Vilao is used **only** for narrative — it does not touch the scraping provider
registry (BrightData/OpenRouter-for-scrape stay as-is).

## UI (apps/web)

- **List**: an "AI Mentions Explorer" section/tab in the reports area listing `explorer_reports`
  (brand, window, language, model, date, status). Reuses `hasReportAccess` gating.
- **Create form**: brand dropdown (from tracked `brands`), window select (30 / 90 / custom),
  language (auto-filled from brand, overridable), model (default `sonnet-5`). Submit creates a
  row and enqueues the job. Server fns mirror `apps/web/src/server/reports.ts`
  (`createExplorerReportFn`, `getExplorerReportsFn`, `getExplorerReportByIdFn`).
- **View**: route `/reports/explorer/$reportId` serves the stored `html` (self-contained, so it
  renders identically to the reference file, filters and all). While `status !== completed`, show
  a progress state.

## HTML template reuse

The `visana-explorer.html` markup/CSS/JS becomes a server-side template (a string with two
injection points: `__DATA__` JSON and `__NARRATIVE__` block). Kept as a single source file so
future format tweaks are one edit. Theme tokens (light/dark) and client-side filter JS are
carried over unchanged.

## Deployment & migration constraints

- This is a **self-built fork** (memory `elmo-fork-deploy-contabo`): rebuild `elmo-web`,
  `elmo-worker`, `elmo-db-migrate` images and redeploy on `contabo-sg`. **Do not `elmo upgrade`.**
- The create-table **migration must be run with explicit user approval** (AGENTS.md forbids
  running migrations otherwise). Back up the DB **and** `ELMO_ENCRYPTION_KEY` before migrating.
- Set the new env vars in `~/.elmo/.env` before the worker starts using Vilao.

## Testing

- Unit: metric assembly (SoV/gap/position/excerpt building) with fixture `prompt_runs`;
  narrative JSON parsing/validation; Vilao fallback wrapper (model A fails → B used → chain
  exhausted → OpenRouter). Tests target observable behavior, not internal shape.
- Manual: generate for Visana (vi) and avia/cozyhome (en); verify the served HTML matches the
  reference explorer's structure and that filters/search work; verify narrative reflects the
  computed numbers.

## Rollout

1. Land schema + migration file (not run in dev unless instructed).
2. Worker job + Vilao client + fallback.
3. Server fns + UI (list, create, view route).
4. Template extraction from `visana-explorer.html`.
5. Build fork images; on `contabo-sg`: backup DB+key → run migration → set env → deploy → smoke
   test one report per brand.

## Open items

None blocking. Opus 5 support is deferred (config already allows swapping the model when/if it
is added to Vilao).
