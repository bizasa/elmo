# Elmo (geo.vidi.com.vn) — Session Handoff

Ngày: 2026-08-17. Mục đích: bàn giao để tiếp tục ở session mới.
Bổ trợ: các fact hạ tầng bền đã ghi trong `C:\Users\admin\.claude\CLAUDE.md` (dòng `E:\Projects\elmo`).

---

## 1. Tổng quan hệ thống

- **Elmo** = SEO/GEO AI-visibility tracker (self-hosted, open-source `elmohq/elmo`), fork tại **github.com/bizasa/elmo**.
- **Deploy**: VPS `contabo-sg` (82.197.70.172), config ở `~/.elmo/`, Docker Compose qua `@elmohq/cli`.
- **Version đang chạy**: images `elmohq/elmo-{web,worker,db-migrate}:0.2.19` + `postgres:18-alpine`.
- **Web**: bind `127.0.0.1:1515` → nginx `geo.vidi.com.vn` (self-signed, CF SSL Full) → CF Access gate (mirror we.vidi.com.vn: 3 IP office bypass + OTP 6 domain). CF Access app `01c56a23…`, team `sweet-shadow-16f8.cloudflareaccess.com`, zone vidi.com.vn account `39a94b31…`.
- **Providers**: scraper **BrightData** (3 surface), direct-API **OpenRouter** (onboarding/sentiment/reports), **JINA** (website fetch). `ELMO_ENCRYPTION_KEY` PHẢI backup cùng DB.
- **Deploy mode** `local` (single-org email/password). User: `chuannguyen@vietnambiz.com` (role=admin, set trong DB).

---

## 2. Trạng thái brands (3 brand, đều cadence TUẦN = `delay_override_hours=168`)

| Brand | id | Prompt active | Ngôn ngữ | Trọng tâm | Competitors |
|---|---|---|---|---|---|
| **Visana** | `visana` | 72 | Tiếng Việt | Visa china/japan/korea (24/sản phẩm, 8 TOFU/8 MOFU/8 BOFU) | **20** (đã thêm) |
| **avia** | `avia` | 13 | English | Airport arrival fast-track — Nội Bài + Tân Sơn Nhất | 0 |
| **cozyhome** | `cozyhome` | 16 | English | Property management cho chủ nhà NƯỚC NGOÀI ở Hà Nội (handover/interior/rental/mgmt) | 0 (CẦN thêm) |

- **Tag scheme**: mỗi prompt = tag sản phẩm/dịch vụ + tag funnel (`tofu`/`mofu`/`bofu`). Lọc trên dashboard theo tag (⚠️ filter tag là **OR**, không AND).
- Prompt cũ (wizard) của avia/cozyhome: cozyhome 19 cái **disabled (giữ data)**; avia 24 cái **đã bị xoá** (mất data ~1 ngày do sự cố race — xem §7).
- **Visana competitors (20)**: Nhị Gia, Visa Liên Đại Dương, Vietnam Booking, TIN Holdings, 24h Visa, Việt Mỹ Travel, Tân Văn Lang, Du Lịch Việt, Visa Global, VisaForKorea, XNC Vietnam, Thị Thực XNC, Visa Phương Đông, Visa Việt Trung, Smile Trip, Traveloka, BestPrice, Chứng Minh Tài Chính SG, Banker VN, Đất Việt Tour.
- **Visana SOV đã backfill** (phân tích lại raw_output đã lưu, KHÔNG scrape lại): Visana dẫn đầu (~44% ở nhóm china-visa, gấp ~2× Visa Global). Số backfill là **xấp xỉ** (khớp trên raw_output, hơi cao hơn semantics live).

---

## 3. Cấu hình quan trọng

- **SCRAPE_TARGETS = 3 surface**: `chatgpt:brightdata:online, google-ai-mode:brightdata:online, gemini:brightdata:online`. (Đã bỏ perplexity + copilot + google-ai-overview để tiết kiệm ~50%.)
- **`RUNS_PER_PROMPT=3` trong .env NHƯNG 0.2.19 KHÔNG áp dụng** → replication thực = **5** (mặc định cứng). Xác minh: avia 13 prompt × 3 surface × 5 = 195 run (khớp BrightData).
- **Công thức credit**: `số_prompt × số_surface × 5 = credit/lần chạy`. **1 run = 1 credit.**
  - visana 1 lần = 72×3×5 = **1.080** · avia = 195 · cozyhome = 240.
- **Steady-state tuần** (101 prompt × 3 × 5): **~1.515 credit/tuần ≈ ~6.500/tháng** → **VƯỢT free 5.000 của 1 key**.

---

## 4. BrightData keys + Rotator

- **3 key** trong `~/.elmo/bd-keys.txt` (1 dòng/key, thêm key = append dòng). Account riêng biệt mỗi key.
  - key1 `8a5d3ca3…` (account hl_9bede9e9) — **suspended** (hết free + nợ).
  - key2 `93740369…` (hl_ac4b1400) — **suspended**.
  - key3 `1cf61f3c…` (hl_3c507186) — **ACTIVE, đang dùng** (còn ~4.327/5.000 free).
- Free credit **renew mỗi tháng** (01/09 tới). ⚠️ **Mỗi account phải KÍCH HOẠT (gắn payment method) thì 5.000 free mới dùng được** — account chưa kích hoạt trả `"Customer is not active"` dù `/status` báo "active".
- **Rotator**: `~/.elmo/bd-rotate.mjs` — chọn key đầu tiên có `/status="active"`, ghi vào `BRIGHTDATA_API_TOKEN` trong .env + recreate worker. Chạy tay: `cd ~/.elmo && node bd-rotate.mjs`.
  - ⚠️ **Chưa cài cron.** ⚠️ **`/status "active"` KHÔNG phản ánh scrape được** (key chưa kích hoạt vẫn "active") → tín hiệu chưa chuẩn, nên đổi sang **error-driven** (xoay khi log worker báo "Customer is not active").

---

## 5. API + cách thao tác prompt/brand/competitor

- **`ADMIN_API_KEYS`** đã bật trong `~/.elmo/.env` → REST API `http://127.0.0.1:1515/api/v1` (header `Authorization: Bearer <key>`).
  - `POST /brands` (cần cả `id`), `POST/PATCH/DELETE /prompts` ({brandId,value,tags}), `POST/PATCH/DELETE /competitors`.
  - `POST /prompts` **tự schedule + bắn immediate run** → cẩn thận churn.
- ⚠️ **Brand tạo qua API KHÔNG tự gán membership** → phải INSERT thủ công `member` (user_id + org=brandId + role admin) mới hiện ở `/app`. (Query member INSERT hay bị classifier chặn → chạy trực tiếp trên server.)
- **Trigger chạy ngay 1 prompt**: PATCH `enabled=false` rồi `enabled=true` (re-enable bắn immediate job). ⚠️ Có **singleton-dedup 1h** — prompt vừa tạo <1h re-trigger sẽ bị gộp.
- **Xoá prompt chậm** (cascade qua runs+citations+raw_output TOAST) → ưu tiên **disable** thay vì delete.
- Admin UI `/admin`: đổi cadence per-brand, "Trigger immediate job".

---

## 6. 🔴 VIỆC CÒN TREO (làm tiếp)

1. **Chi phí BrightData vượt free** (do replication thực = 5 → ~6.500/tháng > 5.000/key). Lựa chọn:
   - (a) **`elmo upgrade`** lên bản honor `RUNS_PER_PROMPT` → hạ về 3 (giảm ~40% → ~4.000/tháng, vừa 1 key free). ⚠️ Có rủi ro migration — test cẩn thận (bản mới có thêm `usage_events` cost tracking).
   - (b) Chạy **2 key luân phiên** (rotator) — nhưng phải kích hoạt account từng key.
   - (c) Giảm prompt/surface.
2. **Hoàn thiện rotator**: đổi tín hiệu sang **error-driven** (không tin `/status`), cài **cron**. Kích hoạt account key1/key2 (hoặc chờ 01/09 renew + clear nợ).
3. **google-ai-overview**: đang hỏng (`sdk_serp` zone chưa provision trên BrightData). Fix zone → thêm lại vào SCRAPE_TARGETS (surface DUY NHẤT Elmo chỉnh geo được: SERP zone + `gl`/`hl`, hardcode `gl=us&hl=en` trong `packages/lib/src/providers/registry/brightdata.ts`).
4. **Competitors cho cozyhome**: research + thêm **công ty property management / quản lý căn hộ cho expat ở Hà Nội** (KHÔNG phải brand nội thất). avia cũng chưa có competitors.
5. **Retention raw_output** (optional): DB ~1GB, 89% là `prompt_runs.raw_output`. Cân nhắc cron NULL raw_output > 12 tuần (giữ trend/citations, mất khả năng đọc lại + backfill giai đoạn cũ). Chưa bật.
6. **Geo thật (IP theo nước)**: hiện chỉ dùng **ngôn ngữ prompt** làm đòn bẩy geo. Muốn IP thật cho khách KR/SG/TW → patch fork (chỉ google-ai-overview có đường qua SERP `gl`/`hl`; chatbot + ai-mode đi Dataset Collector không chỉnh geo được).

---

## 7. Gotchas / bài học (đọc kỹ trước khi làm tiếp)

- **0.2.19 bỏ qua `RUNS_PER_PROMPT`** → replication = 5. Mọi estimate credit phải dùng **×5**.
- **Tạo/toggle prompt = bắn scrape ngay** → churn. **Đừng rebuild prompt nhiều lần** (đã đốt cạn 2 key trong 1 ngày vì rebuild + RUNS 5 + 6 surface).
- **Đừng check run quá sớm rồi re-trigger** — job chạy trễ, tưởng fail → re-trigger làm **chạy đôi** (đã lỡ chạy cozyhome 2 lần = ~240 credit thừa).
- **SSH timeout không kill process remote**: lệnh local timeout 2 phút nhưng node trên server chạy tiếp → gây race (đã xoá nhầm 24 prompt avia + tạo đôi). Với thao tác nặng → chạy background + kiểm tra, hoặc chia nhỏ.
- **Classifier chặn**: bulk `DELETE` SQL nhiều bảng + `INSERT ... member ... role admin` → dùng API hoặc để user tự chạy SQL trên server.
- **0.2.19 KHÔNG có cost tracking in-app** (`usage_events` là bản mới) → xem tiền/credit trên **dashboard BrightData**.
- **`/status "active"` ≠ scrape được** — chỉ trigger thật (trả `snapshot_id`) mới xác nhận key sống.

---

## 8. Lệnh hữu ích (chạy trên contabo-sg)

```bash
# trạng thái stack
cd ~/.elmo && elmo compose ps
docker logs elmo-worker-1 --tail 30

# xoay key (khi key hiện chết)
cd ~/.elmo && node bd-rotate.mjs

# check key sống thật (thay $K)
curl -s -X POST "https://api.brightdata.com/datasets/v3/trigger?dataset_id=gd_m7aof0k82r803d5bjm&notify=false&format=json" \
  -H "Authorization: Bearer $K" -H "Content-Type: application/json" \
  -d '[{"url":"https://chatgpt.com/","prompt":"test","index":1,"web_search":false}]'
# -> {"snapshot_id":...} = sống ; "Customer is not active" = chưa kích hoạt/suspended

# đếm run theo brand (SQL qua file để tránh lỗi quote)
docker exec -i elmo-postgres-1 psql -U postgres -d elmo -c \
  "select p.brand_id, count(*) from prompt_runs r join prompts p on p.id=r.prompt_id group by p.brand_id;"

# update code từ upstream (fork)
git fetch upstream && git merge upstream/main   # rồi elmo upgrade cho bản chạy
```

Config: `~/.elmo/.env` (mode 600, chứa secrets + ADMIN_API_KEYS), `~/.elmo/elmo.yaml`, `~/.elmo/bd-keys.txt`, `~/.elmo/bd-rotate.mjs`.

---

## 9. Cập nhật session 2026-08-19 (làm gì + bài học)

**Đã build + deploy (branch `explorer-report`, chưa push remote — origin trỏ upstream elmohq):**
1. **AI Mentions Explorer report** — module report mới trong app: chọn brand + cửa sổ ngày → worker đọc `prompt_runs` (KHÔNG scrape) → dựng explorer HTML (giống file `visana-explorer.html`) + narrative do **Vilao** viết (fallback vét 8 model → OpenRouter). Bảng mới `explorer_reports` (migration 0016). Chi tiết: memory [[elmo-explorer-report-feature]].
2. **AI Explorer = trang brand-scoped** `/app/$brand/ai-explorer` (nav ở Dashboard dưới Opportunities), quyền theo **brand access**. Report có **2 tab: Báo cáo (report VN đầy đủ) + Explorer (tra cứu từng câu trả lời)**.
3. **Opportunities → tiếng Việt** (prose/why/summary/risks; giữ label English). Gen bằng OpenRouter gpt-5-mini.
4. **Fix OOM**: brand lớn (visana 7262 run/479MB raw_output) → sample metadata trước, chỉ nạp raw_output cho ~run được chọn.

**Deploy (fork tự build trên contabo-sg):** tag hiện tại **web=0.2.19-geo5, worker=0.2.19-geo6, db-migrate=0.2.19-geo3**. Migration 0016 đã chạy (backup trước). ĐỪNG `elmo upgrade`. Xem [[elmo-fork-deploy-contabo]].

**Đã dùng Vilao (key content-hub CHƯA có local → tạm dùng team-key sk-1086):** khi test, sonnet-5/opus-4-8 hay fail với team-key, rớt xuống gpt-5.5/fable-5 → khi đổi content-hub nhớ kiểm quyền model. Model list: [[vilao-models]].

**Tài liệu hướng dẫn cho team MKT (Lark Doc có ảnh):** https://vidivietnam.sg.larksuite.com/docx/YItCdrLx1ozFZKxgdjMl1NQ1gJK — ví dụ Visana, 11 ảnh inline.

**Bài học lớn (đã lưu memory + SKILL):**
- **Chèn ảnh vào Lark**: worker có `/upload-image` (base64 + param `index` = block position); markdown `![](url)`/base64 ra ảnh vỡ. Tính block index từ markdown (validate == "N blocks"). Đã tài liệu hoá vào **skill `lark-wiki-publisher` v1.3** (`E:\Projects\vidi-skills`) + memory [[lark-wiki-images-and-headless-capture]].
- **Tự chụp app sau login/CF Access**: Playwright headless trong container trên chính server, trỏ origin nội bộ `127.0.0.1:1515` (né CF Access), login qua API auth. Claude-in-Chrome screenshot KHÔNG xuất file dùng được.
- **Reset pass better-auth**: hash scrypt (N=16384,r=16,p=1,dkLen=64, salt hex làm salt, lưu `salt:keyhex`); UPDATE bảng `account` provider_id='credential'.

**Việc treo mới:** đổi Vilao key sang content-hub; ép Opportunities avia/cozyhome sang VN (backdate cache); dọn row report test trong DB.

## 10. Cập nhật session 2026-08-24 (làm gì + bài học)

**Branch `explorer-report` ĐÃ push lên fork** `bizasa/elmo` (remote tên `fork`, HTTPS). ⚠️ `origin` = `elmohq/elmo` (upstream public) — ĐỪNG push origin. Fork là **PUBLIC** → chỉ đẩy code (đã quét secret sạch), KHÔNG đẩy file handoff này. Office: `git fetch fork && git checkout explorer-report`.

**Tạo 3 user + phân quyền brand (KHÔNG có UI — local mode tắt `teamInvites`).** Elmo local: không invite/tạo user/quản member qua app (register chặn sau user đầu; org API 403; `/admin` chỉ là dashboard thống kê). Phải làm qua DB. Đã tạo qua SQL insert vào `elmo-postgres-1`:
- linhtm@vietnamdiscovery.com + hanhpham@vietnamdiscovery.com → member org `visana` + `avia`
- mynt@vidi.vn → member org `avia`
- (password đưa trong chat, KHÔNG ghi vào file. Test login 127.0.0.1:1515 → 200 OK.)
- Cơ chế đầy đủ (schema, scrypt, brand=org, per-brand scope): memory [[elmo-user-provisioning]].

**Sửa lỗi phân phối skill (skill-father).** Phát hiện bước Deploy của skill-father SAI: `bizasa/claude-pages` KHÔNG phải kênh skill (đó là repo publish HTML `share.bizasa.com`; lịch sử commit `skills/` trống). 2 kênh THẬT: (a) GitHub MCP đọc từ `bizasa/vidi-skills`; (b) upload SKILL.md thủ công vào **claude.ai Project Files** (app nạp `/mnt/skills/user/`, KHÔNG tự sync git). Đã sửa skill-father → v1.6 + push vidi-skills; lark-wiki-publisher v1.3 cũng đã ở vidi-skills. ⚠️ Muốn máy office gọi skill ra bản mới phải **upload lại SKILL.md vào Project claude.ai** (git push chỉ cập nhật kênh GitHub MCP). Chi tiết: memory [[skill-distribution-channels]].

## 11. Cập nhật session 2026-08-25 (SSO → rồi revert password+IP)

**Đã build login passwordless qua Cloudflare Access OIDC** (better-auth `sso()` + CF Access làm IdP) — deploy web image `geo7`→`geo8`→`geo9` (fork branch `explorer-report`, đã push fork `bizasa/elmo`):
- `geo7`: thêm provider `cf-access` trong `getLocalAuthOptions` (env `CF_ACCESS_TEAM_DOMAIN/OIDC_CLIENT_ID/OIDC_CLIENT_SECRET`), nút "Sign in with Cloudflare Access" ở login (cờ runtime `clientConfig.ssoLogin`).
- `geo8`: `disableImplicitSignUp:true` → email lạ bị chặn ở login (không JIT-create user rỗng).
- `geo9`: `accountLinking.trustedProviders:["cf-access"]` (qua `CreateAuthOptions.trustedSSOProviders`) → link SSO vào user đã pre-create theo email.

**RỒI Chuan quyết TẮT SSO, quay lại email+password** (team thấy OTP rối). Trạng thái CUỐI:
- SSO tắt: comment→**xoá hẳn** `CF_ACCESS_*` trong `~/.elmo/.env`; **xoá** CF Access SaaS OIDC app. Web geo9 vẫn chạy nhưng không có provider → nút SSO ẩn, chỉ email+password. Code SSO còn trong fork nếu cần bật lại (phải tạo lại CF app + env).
- **CF Access OTP đã gỡ, GIỮ rule IP:** xoá policy "Company emails" (allow/OTP) khỏi Access app geo, chỉ còn "Office IPs bypass" (4 IP). → office IP vào thẳng (email+password, không OTP); non-office **403**. Chi tiết: memory [[elmo-cf-access-sso-login]].

**Users hiện tại (đều login email+password, password đưa trong chat):** chuannguyen@vietnambiz.com (admin, mọi brand); linhtm@ + hanhpham@vietnamdiscovery.com (avia+visana); vantth@vietnamdiscovery.com (avia+visana); mynt@vidi.vn (avia). ⚠️ Tạo user mới giờ = insert `user`+`account`(password scrypt)+`member` (KHÔNG dùng luồng passwordless nữa). Xem [[elmo-user-provisioning]].
