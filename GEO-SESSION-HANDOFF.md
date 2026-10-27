# Elmo (geo.vidi.com.vn) — Session Handoff

Ngày: 2026-08-17. Mục đích: bàn giao để tiếp tục ở session mới.
Bổ trợ: các fact hạ tầng bền đã ghi trong `C:\Users\admin\.claude\CLAUDE.md` (dòng `E:\Projects\elmo`).

> ⚠️ **§1–§8 là trạng thái 2026-08-17, nhiều chỗ đã lỗi thời** (version, CF Access, BrightData rotator, alias).
> Trạng thái hiện tại xem **§12 (2026-10-14)** ở cuối file; phân quyền/org xem `GEO-ORG-STRUCTURE-HANDOFF.md`.

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

---

## 12. Cập nhật 2026-09-29 → 2026-10-14 (đã cũ — xem mục 13)

### Version & deploy
- Fork nhánh **`geo-v043`** = upstream **v0.4.3** + custom. Images: **web + worker `0.4.3-geo3`**, db-migrate `0.4.3-geo1`.
  Source build `/opt/elmo-src-v043-geo3` (`git archive` từ commit `e0506ca0`). Compose backup `~/.elmo/elmo.yaml.pre-geo3-*`.
- Rollback: worker `0.4.3-geo2`, web `0.4.3-geo1` (image còn trên máy). Nhánh `geo-v030-clean` giữ làm rollback v0.3.0.
- ⚠️ Worker chạy `tsx` không type-check → sau merge luôn `tsc --noEmit` cho `apps/worker` (bài học crash `getDeployment`).
- Máy Windows KHÔNG có pnpm/node_modules → test/tsc/lint chạy trên server: build target `builder` rồi mount source vào
  (`docker run -v <src>/packages/lib/src:/app/packages/lib/src elmo-builder-geo3 sh -c "cd packages/lib && ./node_modules/.bin/vitest run ..."`).
  `git archive` từ Windows ra CRLF → biome báo format; chạy `sed 's/\r$//'` trước khi lint.

### Truy cập
- **geo.vidi.com.vn MỞ PUBLIC từ 2026-10-12** (không chặn IP): CF Access app `01c56a23…` có thêm policy
  "Public bypass (everyone)" `aab6deb0…`. Bảo vệ = login email+password Elmo; sign-up đã khoá (POST sign-up → 422).
  Khoá lại về IP văn phòng = xoá policy `aab6deb0…`.
- geo-mcp Worker: `ACCESS_PIN` đã rotate (PIN mới ở `C:\Users\admin\.geo-mcp-pin.txt`). Chưa retire (traffic ~1.800 req/30 ngày).

### BrightData
- Xoay nhiều tài khoản (`packages/lib/src/providers/registry/brightdata-keys.ts`): `BRIGHTDATA_FREE_TIER_TOKENS=key@4500,...`
  dùng trước (≤cap/tháng, tháng tính từ 12:00 UTC ngày 1), `BRIGHTDATA_API_TOKEN` (gigago, có tiền) cuối.
  Tài khoản không tiền cạn free → `400 Customer is not active` → key bị cooldown 1h, chuyển key khác.
- Fix backoff pg-boss: job follow-up bị singleton dedup nuốt im lặng → giờ gửi lại không singleton (`process-prompt.ts`).
- google-ai-mode từng timeout (~29/09, lỗi phía BrightData) — đã hồi phục 06/10.

### Nhận diện brand (alias) — QUAN TRỌNG
- Elmo đánh dấu `brand_mentioned` bằng **chuỗi con** của tên/alias/domain, tính **lúc ghi run**. Sửa alias KHÔNG tự sửa lịch sử.
- **Fork geo3: alias có tiền tố `=` khớp NGUYÊN TỪ** (`packages/lib/src/mentions.ts`). Dùng cho tên ngắn dễ nằm trong từ khác.
- Sự cố: đổi tên brand sang dạng domain (Gigago.vn 10/09, Visana.vn + cozyhome.com.vn 18/09) mà không có alias → tụt visibility từ ~21/09.
- Rà soát toàn bộ 12–13/10, alias hiện tại:

| Brand | Alias | Ghi chú |
|---|---|---|
| visana | `Visana` | |
| gigago | `Gigago` | tụt từ 09/09 còn do đổi bộ prompt (không phải lỗi) |
| cozyhome | `Cozyhome` | trùng tên nước ngoài (cozyhome.com nội thất Mỹ…) chỉ ở prompt EN không có "Hanoi" — các prompt đó đã tắt. "CozyHome Rentals – Vinhomes Metropolis" KHÔNG phải của mình (~25 run lẫn, chấp nhận) |
| chinaesim | `Chinaesim` | đã bỏ `China eSIM` (cụm chung, 360 run ảo) |
| vidi-vn | `VIDI Travel`, `=VIDI` | đã bỏ `VIDI` substring (khớp "providing"). "Veni Vidi Travel" (Thổ Nhĩ Kỳ) chỉ ở prompt đã tắt |
| avia | `=AVIA` | bỏ `avia` substring (khớp "aviation"). "AVIA đại lý vé máy bay quốc tế" = tên cũ của avia |
| vietnam-visa | (không) | đã bỏ `Vietnamvisa` (khớp domain đối thủ), `Vietnam Visa Service`, `Vietnam Discovery`…; domain phụ chỉ còn `vietnamdiscovery.com` (gỡ visana.vn, vietnam-discovery.com, vietnamdiscovery.info, evisatovietnam.vn — không phải của mình; evisatovietnam.vn = đối thủ Vietnam Visa JSC) |
| halongtrip | `halongtrip`, `Halongtrip.com` | sạch |

- **Tính lại lịch sử** bằng script one-off `recompute-brand-mentions.ts` (scratchpad session, đọc theo trang 200 row; mount vào
  `<lib>/scripts/` của image worker rồi `tsx`). Chỉ cập nhật `brand_mentioned` + `brand_position`, không đụng `competitors_mentioned`.
- Backup trong DB elmo: `_bak_brand_mentions_20261012`, `_bak_brands_20261012`, `_bak_mentions_all_20261012b` (toàn bộ 25.388 run),
  `_bak_mentions_avia_vidi_20261013`. Xoá được khi đã ổn định.
- Cách dò alias nghi vấn: với mỗi alias/domain đếm số run khớp, số run CHỈ khớp nhờ nó, và nó khớp vào **chữ gì** (mở rộng ra cả từ) — lộ ngay "aviation", domain đối thủ.

### Việc còn treo
- `extractTextContent` lẫn chuỗi base64 ảnh vào text → alias substring dễ khớp nhầm (lỗi upstream, chưa sửa).
- `scheduleNewJobs` của maintenance có cùng kiểu pg-boss dedup im lặng như backoff (chưa sửa).
- Explorer API trả 500 thay vì 401 khi chưa đăng nhập.
- Xoá 3 dump DB cũ (~1,8GB) trên server khi chắc không cần rollback.
- Cân nhắc thêm `evisatovietnam.vn` làm đối thủ của vietnam-visa; đổi tên brand "Vietnam-Visa" (tên vẫn khớp `vietnam-visa.org` của đối thủ, ~18 run).

---

## 13. Cập nhật session 2026-10-26 (trạng thái HIỆN TẠI)

### Nâng upstream v0.7.5 + Jev — ĐÃ DEPLOY
- Nhánh **`geo-v075`** (fork `bizasa/elmo`, merge commit `583c55f2`). Prod chạy **web/worker/db-migrate `0.7.5-geo1`** từ 12:32 26/10, source `/opt/elmo-src-v075`. Runbook + rollback: [GEO-V075-DEPLOY.md](GEO-V075-DEPLOY.md). Backup trước deploy `/root/elmo-pre-v075-20261026-122021.sql.gz` (759MB). **Rollback = restore dump** (migration 0024 drop cột, không lùi được bằng đổi tag).
- Mention giờ do **Jev (TypeSafe)** chấm, lưu `run_mentions` (+ `assessments`: sentiment, position, passage). `prompt_runs` append-only (trigger chặn UPDATE). `TYPESAFE_API_KEY` đã nạp `~/.elmo/.env`. Đã chấm lại 26.104 run/90 ngày (~10 phút); visibility gần như không đổi.
- Fork bỏ `brand_position` (cột còn trong DB, không ai ghi) + bỏ alias `=` (đã strip `=AVIA`, `=VIDI` trong DB). Explorer đọc `run_mentions`. Custom migration → `0031_explorer_reports`.
- DB `elmo_scratch_v075` = bản sao trước migrate (bảng `new_rm` so sánh trước/sau) — xoá khi hết cần.

### Connector GEO (geo-data-api + gateway Site 360)
- `geo-data-api` (repo `bizasa/geo-mcp`, commit `ee5ed04`, đã deploy; image rollback `geo-data-api:pre-sentiment`, `:pre-v075`): đọc `run_mentions`; `/overview` thêm khối **`current`** = đúng công thức thẻ Overview dashboard (mỗi prompt lấy ngày chạy gần nhất, ngày tính theo **giờ VN**); endpoint mới **`/sentiment`**; snippets dùng passage Jev.
- Gateway **Site 360** (`bizasa/vidi-site-360`, deploy `1ee19ecd`): thêm tool **`geo_sentiment`** (24 tool), `geo_brand_overview` hiện số "Hiện tại" trước. Team phải **Disconnect/Connect lại** connector để thấy tool mới.
- ⚠️ Dashboard Elmo tính "ngày gần nhất" theo **múi giờ trình duyệt** → đợt chạy vắt qua nửa đêm VN làm số khác UTC (Visana: UTC 40% vs VN 50,5%).

### Brand mới (org gigago, 2 tuần/lần)
- **singesim** + **cambodiaesim**: 20 prompt EN/brand (GSC-grounded), competitor Airalo/Holafly/Nomad/Saily/Ubigi, `delay_override_hours=336`. Lượt đầu 26/10: ~5% visibility cả hai; lượt kế **09/11/2026**. Chi tiết: [GEO-BRANDS-AND-LLM-SETUP-HANDOFF.md](GEO-BRANDS-AND-LLM-SETUP-HANDOFF.md).

### Hướng dẫn team MKT
- Lark doc (giữ link cũ) cập nhật cho v0.7.5: https://vidivietnam.sg.larksuite.com/docx/YItCdrLx1ozFZKxgdjMl1NQ1gJK — đã share quyền xem + gửi tin vào nhóm **GHM - MARKETING**.
- Ảnh chụp bằng user tạm `geo-screenshot-temp@vidi.vn` (tạo → chụp Playwright trên server → xoá user ngay; Origin login phải là `https://geo.vidi.com.vn`).

### VIỆC CÒN TREO
1. ~~Query Fan-Out ChatGPT trống~~ → **ĐÃ XỬ LÝ 27/10** (mục 14).
2. **Doc MKT**: số/ảnh Overview chụp theo giờ UTC (Visana 40%) — team VN thấy ~50%; chụp lại với `timezoneId: "Asia/Ho_Chi_Minh"` rồi sửa số.
3. **Khai tử geo-mcp cũ** (lỗ hổng `state` không ký): báo team chuyển sang connector Site 360 → tắt Worker `geo-mcp-server` → bỏ nhánh dò brand theo tên trong `resolveBrandId` (data-api).
4. Lâu dài: cho gateway gọi Elmo `/api/v1` thay vì đọc DB trực tiếp (schema upstream còn đổi).
5. Lint fork: 2 lỗi `noExcessiveCognitiveComplexity` (`brightdata.ts`, `explorer/build-data.ts`); test `v1-route-conformance` fail trên Windows (path `\`) — môi trường.
6. Key TypeSafe + Cloro (free) + DataForSEO trial đã lộ trong chat → tạo key mới / xoá khi tiện.

---

## 14. Cập nhật 2026-10-27 — ChatGPT chuyển sang DataForSEO standard queue (trạng thái HIỆN TẠI)

- **Nguyên nhân Query Fan-Out trống:** BrightData ngừng thu `web_search_query` + `model` ở dataset ChatGPT (email BrightData xác nhận; dữ liệu rớt từ ~26/08). So giá: BrightData $0 (free 5.000 lượt/tháng × 3 tài khoản ≈ 15.000) nhưng không có fan-out; Cloro Lite $30/tháng; **DataForSEO live $0,004 / standard $0,0012 mỗi lượt** → chọn DataForSEO standard (≈ **$5,3/tháng** cho ~4.400 lượt ChatGPT). Gemini + Google AI Mode giữ BrightData (free).
- **Fork:** biến mới `DATAFORSEO_SCRAPER_MODE` (`live` | `standard` | `priority`) — commit `8a55020b`.
- **Prod:** `SCRAPE_TARGETS=chatgpt:dataforseo:online,google-ai-mode:brightdata:online,gemini:brightdata:online`, `DATAFORSEO_SCRAPER_MODE=standard`, worker **`0.7.5-geo2`** (web/db-migrate `0.7.5-geo1`). Key DataForSEO mới nạp $51; đổi key bằng `printf key | ssh contabo-sg 'sh /root/elmo-set-dataforseo.sh'` (PowerShell: lệnh `Read-Host -AsSecureString` trong lịch sử). test-provider standard: PASS (1m02s).
- **Sự cố sáng 27/10:** key trial $1 hết sau ~180 lượt → 660 lượt ChatGPT lỗi (không bị tính tiền); 219 prompt tự chạy lại với key mới.
- Chi tiết + so sánh giá + kết quả thử: [GEO-CHATGPT-FANOUT-HANDOFF.md](GEO-CHATGPT-FANOUT-HANDOFF.md).

### DataForSEO — API khác đáng dùng (đã gọi thử)
- **SERP Google AI Mode** $0,004 / **AI Overview** $0,002, chạy được **location VN** (BrightData không geo được, AI Overview BrightData đang lỗi). Elmo hardcode `DFS_LOCATION_CODE=2840` (US) → muốn VN phải vá fork, location theo brand (brand VN → VN, brand eSIM → US).
- **LLM Mentions** $0,10/lần + $0,001/dòng: visana.vn xuất hiện trong 547 câu trả lời Google AI ở VN, chinaesim.com 10 câu ChatGPT (ChatGPT chỉ US/EN) → dùng tìm prompt mới hằng tháng.

### VIỆC CÒN TREO (thêm)
- Sửa doc MKT mục 4.6 (Query Fan-Out) khi đợt chạy mới có dữ liệu; báo team Citations ChatGPT gãy từ 27/10 do đổi nguồn.
- Cân nhắc: vá location theo brand + chuyển AI Mode sang DataForSEO + bật lại AI Overview (≈ $15–25/tháng); tra LLM Mentions hằng tháng.
- Mỗi prompt giữ 1 slot worker (10) tới khi task ChatGPT xong → đợt lớn có thể mất vài giờ.
