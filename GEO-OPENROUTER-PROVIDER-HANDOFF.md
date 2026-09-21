# Elmo (geo.vidi.com.vn) — Handoff: bổ sung provider OpenRouter / no-web vs web

Ngày: 2026-09-09. Mục đích: gom kết quả khảo sát để Chuan quyết có thêm target OpenRouter lên prod hay không. **Chưa đụng config prod** — mọi thứ dưới đây là phân tích + probe 1 lần.

---

## 1. Câu hỏi gốc & kết luận
- Muốn "lấy data từ model KHÔNG có web" (parametric) và cân nhắc dùng **Vilao** (rẻ) làm provider.
- **Kết luận:**
  - **Vilao = bỏ.** Chỉ làm được no-web (relay OpenAI-compatible thuần, không có web search/`:online`; CF AI Gateway cũng KHÔNG thêm web — nó chỉ proxy/cache/log). Dùng Vilao trong Elmo còn phải **sửa code fork** (thêm provider vào registry). Thừa: mọi model Vilao có (Claude/GPT) thì **OpenRouter đã có**, lại làm được CẢ no-web lẫn web.
  - **No-web (parametric) ≈ 0 cho brand VN** → ít giá trị. Đo "trí nhớ nền model" — brand niche chưa vào training.
  - **Web-grounded (Perplexity sonar) MỚI là tín hiệu đáng track** — và đã probe thấy tín hiệu thật (xem §3).

## 2. Cơ chế `:online` (đã xác minh trong code)
- Format target: `model:provider[:version][:online]`. **Bỏ `:online` = no-web; thêm = web search.**
- OpenRouter: `:online` = plugin `{id:"web"}`, dùng web search NATIVE của model (Exa fallback). ⚠️ **KHÔNG phải UI thật** ChatGPT/Gemini — muốn UI thật phải scraper (BrightData/Cloro).
- Direct-API là chỗ DUY NHẤT tách được no-web vs web trên cùng 1 model (chạy 2 target, 1 có `:online` 1 không).
- Elmo tự phân loại: `scraped` = cái visitor thật thấy (gold); `api` = model thuần. Doc: `packages/docs/content/docs/user-guide/providers.mdx` §"Direct model APIs" ("use alongside a scraper... extra coverage").

## 3. Kết quả PROBE thực tế (perplexity/sonar:online, web-grounded, 2026-09-09)
Gọi trực tiếp OpenRouter (key sẵn trong `~/.elmo/.env`), KHÔNG qua Elmo, KHÔNG lưu DB.

| Brand | Visibility | Ghi chú |
|---|---|---|
| **avia** | **2/6 (~33%)** | Mạnh ở "best fast-track in Vietnam" (xếp #1). Mất ở query Nội Bài cụ thể + booking + giá. |
| **cozyhome** | **6/16 (~38%)** | Mạnh ở "provider/company" queries. **Mất TOÀN BỘ furnishing/interior (3/3)** + how-to/informational + fees. |

**Insight sửa nhận định cũ:** dự đoán "niche VN ≈ 0" là SAI cho web — cả 2 brand có website production (`avia.vn`, `cozyhome.com.vn`) nên Perplexity search tìm ra. Cái ≈ 0 chỉ đúng với **no-web/parametric**. → Nên track **web**, không track no-web.

**Gap GEO actionable:** brand mạnh ở query "company/provider", yếu ở "informational/how-to" và dịch vụ phụ (furnishing của cozyhome) → hướng làm content.

**Chưa test:** visana/gigago/vietnam-visa (visa, tiếng Việt, niche hơn) — nên probe trước khi track để biết có tín hiệu không.

## 4. Chi phí (đã đo)
- Sonar online: input ~2.000-2.400 tok + output ~300-770 → **~$0.0077/run (~197đ)**, 20-25 citations/câu.
- Bảng so sánh /run: Vilao no-web ~16đ (no-web, ~0 tín hiệu) · OpenRouter no-web deepseek ~7đ · **sonar online ~197đ (web thật, rẻ nhất có web)** · BrightData scraper ~255đ (UI thật).
- `:online` đắt hơn no-web ~10-25× (do nhồi web content vào input).
- Track thường xuyên (rep3, cadence tuần): avia ~$1,3/th · cozyhome ~$1,6/th · **cả hai ~$3/tháng**.
- ⚠️ OpenRouter key = account `chuannq@vietnamdiscovery.com` (đang dùng cho onboarding/sentiment). Workspace "ELMO GEO-SEO Tracking". Probe đã tốn ~22 request (~$0.17) — sẽ thấy trong dashboard.

## 5. CÁCH THÊM (khi Chuan quyết làm) — env-only, KHÔNG rebuild
1. Sửa `~/.elmo/.env`, thêm vào `SCRAPE_TARGETS` (nối bằng dấu phẩy):
   ```
   perplexity:openrouter:perplexity/sonar:online
   ```
   (target này áp cho MỌI brand vì SCRAPE_TARGETS global + brand.enabled_models đều NULL. Không giới hạn theo brand được ở tầng env — muốn chỉ 1 brand thì phải set enabled_models cho các brand khác, phức tạp hơn.)
2. Recreate worker + web để nạp env:
   ```
   cd /root/.elmo && docker compose -p elmo -f elmo.yaml up -d
   ```
   (KHÔNG cần rebuild image — chỉ đọc lại env.)
3. Verify: `docker exec elmo-postgres-1 psql -U postgres -d elmo -c "SELECT DISTINCT model, provider FROM ...`; hoặc chờ 1 chu kỳ + xem dashboard surface Perplexity.
4. Gỡ: xóa dòng khỏi SCRAPE_TARGETS + up -d lại.

⚠️ **Lưu ý toàn cục:** thêm target = thêm surface cho **TẤT CẢ** brand → chi phí = Σ(prompt mọi brand) × rep3. Full danh mục (143 prompt) × sonar ~197đ × rep3 × 4,345 ≈ **~$13/tháng (~333k đ)**. Nếu chỉ muốn avia+cozyhome thì cần cơ chế per-brand (enabled_models) — hỏi lại trước khi làm.

## 6. Model khác qua OpenRouter (tham chiếu)
DeepSeek/Qwen/Kimi/Grok/Mistral/Claude đều gọi được qua OpenRouter (no-web bỏ `:online`, web thêm `:online`). Rẻ nhất có-web = `perplexity/sonar:online`. Model dùng Exa (deepseek/qwen...) đắt hơn (+~$0.02/req phí Exa).

## 7. Quyết định để mở
- [ ] Thêm `perplexity/sonar:online` — cho cả danh mục (~$13/th) hay chỉ avia+cozyhome (cần per-brand, ~$3/th)?
- [ ] Probe visana/gigago/vietnam-visa trước khi track?
- [ ] Có muốn theo dõi no-web dài hạn để đo "brand vào trí nhớ model" chưa (chỉ 1-2 model, ít prompt brand-name)? — hiện chưa đáng.
