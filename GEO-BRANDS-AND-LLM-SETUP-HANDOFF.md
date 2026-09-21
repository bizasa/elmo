# Elmo (geo.vidi.com.vn) — Handoff: brand setup mới + cách thêm LLM chọn được

Ngày: 2026-09-21. Bổ trợ cho: `GEO-ORG-STRUCTURE-HANDOFF.md`, `GEO-UPSTREAM-MERGE-PROGRESS.md`, `GEO-OPENROUTER-PROVIDER-HANDOFF.md`. Mọi thứ dưới đây là config DB/env trên prod (contabo-sg), KHÔNG phải code.

---

## 1. Cơ cấu org/brand hiện tại (sau restructure)
| Org (slug) | Brands | Members |
|---|---|---|
| **ViDi** (`default`) | vidi-vn, avia, vietnam-visa, visana, **chinaesim**(*xem lưu ý*), **halongtrip** | chuannguyen(admin), hangltm, hanhpham(admin), linhtm(admin) |
| **Gigago** (id `visana`, slug đổi `gigago`) | chinaesim, gigago | chuannguyen(admin), hanhpham(admin), linhtm(admin), vantth |
| **cozyhome** | cozyhome | chuannguyen(admin) |

- Org `avia` cũ đã **xoá**; brand avia/vietnam-visa/visana dồn vào ViDi. `mynt@vidi.vn` mất hết membership (chỉ ở avia cũ) — chưa xử.
- **Quyền là cấp ORG** (member của org thấy MỌI brand trong org). `member.role` gần như vô hiệu ở local — cấp membership = quyền ghi đầy đủ.
- Slug org: ViDi=`default`, Gigago=`gigago` (PK id vẫn `visana`, app route bằng slug).

## 2. Brand mới đã setup xong (đang chạy)
Cả hai: English, tag dual **topic + funnel**, dồn BOFU/MOFU, nạp qua REST API (`POST /api/v1/prompts` auto-run), competitor qua API.

- **chinaesim** (chinaesim.com, eSIM Trung Quốc) — org Gigago. 24 prompt (4 TOFU/8 MOFU/12 BOFU), 7 competitor (Airalo/Holafly/Nomad/Ubigi/GigSky/SimCorner/SIMOptions), cadence **tuần (168h)**. Prompt grounded theo **GSC thật** (Ahrefs project 4977477): cụm unblock (Google/WhatsApp/TikTok), phone-number, roaming, airport, compatible; bỏ cụm operator (China Mobile/Unicom/Telecom) theo yêu cầu.
- **halongtrip** (halongtrip.com, booking du thuyền Vịnh Hạ Long) — org ViDi. 27 prompt (3 TOFU/10 MOFU/14 BOFU), 7 competitor (Klook/GetYourGuide/Viator/Kkday/BestPrice Travel/Threeland/Halongbaytours), cadence **tháng (720h)**. Grounded theo **GA4-equivalent = Ahrefs Web Analytics top-pages (lọc bot/direct) + GSC** (project 10234733): mạnh best-cruise/booking/bay-comparison/itinerary; đã thêm 3 prompt cruise cụ thể (Peony, Heritage Binh Chuan, Bai Tu Long) vì channel **llm** đã đẩy traffic vào chính các page đó.

**Phương pháp chuẩn khi thêm brand travel/eSIM mới:** dùng Ahrefs MCP (đã kết nối, không cần auth trong session) → `management-projects` tìm project → `gsc-keywords` + `web-analytics-top-pages`(where JSON `{"field":"source_channel","is":["eq","llm"]}` để soi AI-referral) → cluster intent → prompt hội thoại dồn BOFU/MOFU.

## 3. ⚠️ Gotchas khi tạo brand qua API/DB (BẮT BUỘC nhớ)
1. **`onboarded=false` mặc định** → Overview hiện màn "Analyze brand", nav ẩn. Phải `UPDATE brands SET onboarded=true`.
2. **Membership**: brand phải nằm trong org mà user là member; nếu tạo org mới thì insert `member` thủ công.
3. **Cadence**: set `delay_override_hours` (168=tuần, 720=tháng); NULL = theo default deployment.
4. Nạp prompt qua `POST /api/v1/prompts {brandId,value,tags}` = tự schedule + **bắn run ngay** (tốn credit tức thì). Muốn không burst thì insert DB (chờ chu kỳ).

## 4. Cách THÊM LLM mới vào danh sách chọn ở trang LLMs (chưa làm — chờ Chuan chốt model)
Đã đọc code xác nhận cơ chế:
- **Checkbox list trên trang LLMs = các entry trong `SCRAPE_TARGETS`** (`available` trong `apps/web/src/server/platform-picks.ts`). "Track more platforms" = platform CHƯA trong SCRAPE_TARGETS.
- Per-brand pick = `brand.enabled_models`. Self-hosted: **NULL → UI coi TẤT CẢ bật**; list → chỉ những cái đó bật.
- Local mode `platformPicksEditable=true` → user **tick được trên UI**, lưu vào enabled_models (`setPlatformPicksFn`, platform-picks.ts:307).

**Quy trình thêm model OpenRouter (default OFF, brand tự opt-in):**
1. **PIN enabled_models cho mọi brand TRƯỚC** (nếu không NULL = tự bật model mới cho tất cả):
   `UPDATE brands SET enabled_models = ARRAY['chatgpt','google-ai-mode','gemini'] WHERE enabled_models IS NULL;` (tên = segment đầu của target).
2. Thêm target vào `SCRAPE_TARGETS` (`~/.elmo/.env`), OPENROUTER_API_KEY đã có. Bỏ `:online`=no-web, thêm=web. VD `claude:openrouter:anthropic/claude-sonnet-5`, `deepseek:openrouter:deepseek/deepseek-chat`, `grok:openrouter:x-ai/grok-4.5`.
3. Recreate: `cd /root/.elmo && docker compose -p elmo -f elmo.yaml up -d`.
4. Trên trang LLMs, mỗi brand tick model mới → track (mới tốn cost lúc đó).
- ⚠️ Mỗi `model` (segment đầu) phải DUY NHẤT (không 2 target cùng "claude"). Chỉ config, không sửa code.

## 5. Nhắc hạ tầng liên quan
- GEO MCP (geo-mcp-server) **đang được thay bằng `vidi-site-360`** (site-mcp.vidi.com.vn) — xem CLAUDE.md. geo-mcp production còn lỗ hổng `state` chưa ký; sẽ khai tử sau khi team chuyển.
- Prod đang chạy image fork **0.3.0-geo1** (web/worker/db-migrate), KHÔNG `elmo upgrade`. Nâng cấp = re-apply custom + rebuild (xem `GEO-UPSTREAM-MERGE-PROGRESS.md`).
