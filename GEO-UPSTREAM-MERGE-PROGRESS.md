# Elmo — Tích hợp upstream v0.3.0 giữ custom (progress / resumable)

Ngày bắt đầu: 2026-09-09. Nhánh tích hợp: **`geo-v030-clean`** (từ `fork/main` = elmohq v0.3.0). Nhánh custom gốc giữ nguyên: `explorer-report` (và `geo-prod-v030` là thử rebase, bỏ được).

## Bối cảnh cốt lõi
- Fork = **import snapshot v0.2.19** (`fb8b0653`), lịch sử ĐỘC LẬP với upstream → không FF/rebase sạch được. Cách đúng = **re-apply theo feature** lên `fork/main`.
- 35 custom commit = 3 feature: **mention-position** (1) · **AI Mentions Explorer report** (~31, gần như thuần thêm mới) · **CF Access SSO** (3).
- Deploy = **rebuild image tự build** (KHÔNG `elmo upgrade`); rollback = backup R2 (dump DB + `ELMO_ENCRYPTION_KEY`).

## Migration — ĐÃ GIẢI (an toàn, không đụng bảng tracking prod)
- Prod đã apply 0000–0016 (gồm custom 0015_add_brand_position, 0016 explorer). **Threshold prod = max(created_at) = 1787046426553.**
- 6 migration mới upstream (0015–0020) đều có `when ≥ 1787854702417` > threshold → prod tự apply.
- 2 migration custom **renumber giữ nguyên `when` gốc**:
  - `0021_explorer_reports.sql` (when 1787046426553)
  - `0022_add_brand_position.sql` (when 1787018442476) = `ALTER TABLE prompt_runs ADD COLUMN brand_position smallint`
- Drizzle dùng threshold cố định (max lúc đầu) → prod: apply đúng 6 upstream, skip 2 custom (when ≤ threshold). Fresh DB: apply đủ theo idx.
- ⚠️ **Snapshot meta chưa dựng lại** cho 0021/0022 (chỉ có .sql + _journal.json). `drizzle-kit migrate` chạy được; nhưng `drizzle-kit generate` sau này sẽ lệch → cần reconcile snapshot sau (follow-up, không chặn deploy).

## Đã làm (commits trên geo-v030-clean: bf5e07e1, 1bbf9e35, 37b2a77b)
- ✅ 23 file mới của explorer (Vilao client, narrative, explorer/*, worker job, template, .changeset, docs).
- ✅ Renumber + journal: 0021_explorer_reports, 0022_add_brand_position.
- ✅ `schema.ts`: `brandPosition` (promptRuns) + bảng `explorerReports` + types.
- ✅ Explorer BACKEND wiring: handlers.ts, index.ts (queue), boss-client.ts (queue), job-scheduler.ts (sendExplorerReportJob), env-registry.ts + env.d.ts + turbo.json (VILAO_*), package.json exports (explorer/*, narrative, mention-analysis), opportunities.ts (prose tiếng Việt).
- ✅ Mention-position CORE mới: mention-analysis.ts (+test), backfill-brand-position.ts.

## ⚠️ DRIFT LỚN: upstream đại tu routing → `/app/org/$org/brand/$brand/...`
Route cũ `_authed/app/$brand/*` KHÔNG còn; nav dùng `link:{to,params}` thay `url`. Mọi file UI custom phải re-home vào cây mới. Đây là phần rework front-end chính còn lại.

## CÒN LẠI
### A. Explorer front-end — re-home
- Di `apps/web/src/routes/_authed/app/$brand/ai-explorer.tsx` → `.../app/org/$org/brand/$brand/ai-explorer.tsx`; sửa `createFileRoute` path + `useParams` (đọc cả `org` lẫn `brand`) + link nội bộ.
- Di/sửa API route `apps/web/src/routes/api/explorer/$reportId.ts` (kiểm path còn hợp lệ).
- Nav: thêm item "AI Explorer" vào app-sidebar theo format `link:{ to:"/app/org/$org/brand/$brand/ai-explorer", params }`.
- Kiểm server fn `server/explorer-reports.ts` gọi access đúng (requireBrandAccess).

### B. Mention-position — 5 file SỬA (merge tay, upstream đã đổi)
- CORE: `apps/worker/src/jobs/process-prompt.ts` (tính brand_position khi lưu run), `apps/web/src/lib/postgres-read.ts`, `apps/web/src/server/dashboard.ts`, `apps/web/src/lib/chart-utils.ts`.
- UI: `apps/web/src/components/trend-chart.tsx` (edit, có thể additive) + hiển thị ở `.../brand/$brand/index.tsx` (re-home từ `$brand/index.tsx` cũ).
- Stories fixture: `apps/web/src/stories/analytics-fixtures.ts`.
- Tham chiếu net: `git diff fb8b0653 explorer-report -- <file>`.

### C. CF Access SSO — 8 file (RỦI RO CAO, cần QUYẾT HƯỚNG)
- **Upstream v0.3.0 ĐÃ có `@better-auth/sso` native** (`sso?: SSOOptions` trong `createAuth`). Custom cũ viết tay account-linking + CF Access OIDC trên better-auth cũ.
- **Quyết định:** (1) thiết kế lại CF Access OIDC trên plugin `sso` native + `trustedSSOProviders` (sạch, đúng chuẩn mới) — KHUYẾN NGHỊ; hay (2) port custom as-is (nhanh hơn nhưng chỏi với native, dễ vỡ khi upgrade sau).
- Net custom: `trustedSSOProviders` (account.accountLinking.trustedProviders) + provider CF Access + login route + env config. Tham chiếu: `git diff fb8b0653 explorer-report -- packages/lib/src/auth/server.ts apps/web/src/lib/auth/server.ts apps/web/src/routes/auth/login.tsx apps/web/src/server/config.ts packages/config/src/env-registry.ts packages/config/src/types.ts apps/web/src/env.d.ts turbo.json`.

## Test trước khi prod
1. `pnpm install` (deps mới: @better-auth/*, có thể cần Vilao/jose).
2. Build: `pnpm build` (hoặc typecheck từng package).
3. `db-migrate` trên **scratch DB** (postgres tạm) — xác minh 0015–0022 apply sạch trên fresh.
4. Mô phỏng prod: dump schema prod → apply journal mới → xác minh CHỈ 6 upstream chạy, brand_position/explorer không re-run.
5. Rebuild image, deploy, verify login + explorer + mention-position, giữ rollback.

## Lệnh hữu ích
```
git checkout geo-v030-clean
git diff fb8b0653 explorer-report -- <file>   # xem custom net cho 1 file
```
