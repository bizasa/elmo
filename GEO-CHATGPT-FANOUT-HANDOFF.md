# ChatGPT Query Fan-Out — handoff (26/10/2026; ĐÃ CHUYỂN sang DataForSEO 27/10)

## Vấn đề
Trang **Query Fan-Out** trên geo.vidi.com.vn trống: ChatGPT không còn truy vấn tìm kiếm nào. Gemini và Google AI Mode thì xưa nay không nhà cung cấp nào lộ truy vấn (không phải lỗi).

## Nguyên nhân (đã xác nhận)
- **BrightData ngừng thu thập** `web_search_query` và `model` ở dataset ChatGPT `gd_m7aof0k82r803d5bjm` — email thông báo của BrightData: "no longer publicly available on the source website". Elmo đọc đúng trường này (`extractWebQueries` trong `packages/lib/src/providers/registry/brightdata.ts`) nên nhận null.
- Dữ liệu prod: tuần 17/08 có 1.951/2.562 run có truy vấn → từ ~26/08 gần 0 → tháng 10 = 0. Từ ~09/10 `web_search_triggered` cũng thành false dù citations vẫn có.
- Gốc rễ phía OpenAI: ChatGPT đổi cú pháp gọi tìm kiếm ~16–20/08/2026, giao diện mặc định không còn gửi truy vấn ra trang. Upstream Elmo ghi `chatgpt:brightdata` = discontinued 2026-09-27 (`packages/config/src/fanout-support.ts`, PR elmohq/elmo#973) và vá riêng Cloro bằng `legacy: true` (PR elmohq/elmo#972). Không có issue/discussion nào khác trên upstream.
- Không phải lỗi do nâng v0.7.5. Không có cách bật lại phía BrightData.

## Đã thử Cloro (26/10, gói free 500 credit, đã dùng 77)
11/11 lượt ChatGPT thành công (8 prompt Visana country VN + 3 US), payload giống hệt Elmo gửi (`include.searchQueries` + `legacy: true`):
- **Có truy vấn mọi lượt** (1–3/lượt), model `gpt-6`; citations 20–39/lượt (BrightData 0–6); brand mention khớp BrightData 7/8; 31–84 s/lượt (1 lượt 190 s).
- VN vs US gần như giống nhau → giữ mặc định US của Elmo, không cần patch.

## Chi phí (volume thật 30 ngày: ChatGPT 4.120 · Gemini 4.131 · AI Mode 3.095 run)
| Phương án | Credit/tháng | Gói | $/tháng |
|---|---|---|---|
| **Chỉ ChatGPT → Cloro (đề xuất)** | 28.840 (7/lượt) | Lite 37.500 cr | **$30** (dư ~30%) |
| Cả 3 engine → Cloro | 57.744 | Hobby 250k | $100 — không đáng (Gemini/AI Mode không có fan-out) |
| + 20–30 sản phẩm Visana (+200–300 prompt) | ~54–66k | Hobby | $100 |

Bỏ ChatGPT khỏi BrightData: ~11.350 → ~7.200 run/tháng, nằm trong 2 key free tier (9.000) → key trả phí Gigago ~$0 (bớt ~$3–4). **Ròng ≈ +$26–27/tháng.**

Lưu ý: biểu đồ **Citations** của ChatGPT sẽ gãy ở ngày chuyển (Cloro trả nhiều nguồn hơn ~5–10×); Visibility/Sentiment/Position không ảnh hưởng. Cloro dựa vào giao diện ChatGPT cũ — "best-effort", OpenAI tắt là mất. Gói Lite 10 job đồng thời: đợt tuần ~1.000 run ChatGPT xong ~1–1,5 h.

## Việc còn lại khi quay lại
1. Chuan quyết mua **Cloro Lite $30** (key hiện là gói free; key đã lộ trong chat → tạo key mới khi lên gói trả phí).
2. Trên contabo-sg (lệnh ghi `.env` từ xa bị classifier chặn → Chuan chạy tay hoặc cấp quyền):
   ```bash
   cd /root/.elmo && cp -p .env .env.bak-pre-cloro && echo 'CLORO_API_KEY=<key>' >> .env \
     && sed -i 's/^SCRAPE_TARGETS=chatgpt:brightdata:online/SCRAPE_TARGETS=chatgpt:cloro:online/' .env \
     && docker compose -p elmo -f elmo.yaml up -d --force-recreate worker web
   ```
3. Sau đợt chạy tuần đầu: kiểm Query Fan-Out có dữ liệu, `prompt_runs.provider='cloro'`, credit tiêu thụ khớp ~7/run; báo team MKT Citations ChatGPT nhảy là do đổi nguồn.
4. Sửa doc hướng dẫn MKT (Lark `YItCdrLx1ozFZKxgdjMl1NQ1gJK`, mục 4.6) bỏ cảnh báo "trang này trống".

Script thử: `cloro-trial.ts` (scratchpad session 26/10, không commit) — gọi `https://api.cloro.dev/v1/async/task` taskType `CHATGPT`, poll `/{id}`.

## Cập nhật 27/10: DataForSEO rẻ hơn Cloro → đề xuất DataForSEO Live
Giá LLM Scraper ChatGPT (dataforseo.com/pricing/ai-optimization/llm-scraper): **Live $0,004/lượt** (Elmo đang gọi `chat_gpt/llm_scraper/live/advanced`), Priority queue $0,0024, Standard queue $0,0012 (POST+GET, ≤45 phút — Elmo chưa hỗ trợ, cần vá fork). Trả theo lượng dùng.

Thử 27/10 (tài khoản trial $1, tốn $0,044): cùng 8 prompt Visana, location US (mặc định Elmo 2840/en) + 3 lượt VN (2704/vi):
- **11/11 có truy vấn tìm kiếm** (1–3/lượt), model `gpt-6`, 15–71 s/lượt (nhanh hơn Cloro), 9–40 URL/lượt.
- Visana khớp BrightData 7/8 ở US; location VN thì khớp cả prompt lệch ("Bảng giá dịch vụ visa Trung Quốc").

| ~4.400 run ChatGPT/tháng | $/tháng |
|---|---|
| Cloro Lite | $30 cố định |
| **DataForSEO Live (không sửa code)** | **≈ $17,5** |
| DataForSEO Standard queue (phải vá fork) | ≈ $5,3 |

**Chuyển:** thêm `DATAFORSEO_LOGIN` + `DATAFORSEO_PASSWORD` (Chuan có; key đưa dạng base64 `login:password`) vào `~/.elmo/.env`, đổi `chatgpt:brightdata:online` → `chatgpt:dataforseo:online` trong `SCRAPE_TARGETS`, recreate worker + web. Không cần Cloro nữa.

## ĐÃ CHUYỂN 27/10/2026 ~10:50 (giờ VN)
`SCRAPE_TARGETS=chatgpt:dataforseo:online,google-ai-mode:brightdata:online,gemini:brightdata:online`; `DATAFORSEO_LOGIN/PASSWORD` trong `~/.elmo/.env` (backup `.env.bak-pre-dataforseo-*`, `elmo.yaml.pre-dataforseo-*`). `scripts/test-provider.ts --target chatgpt:dataforseo:online` trong container worker: PASS (15 s, có web query + citations). Tài khoản DataForSEO còn ~$0,7 trial — **Chuan phải nạp (tối thiểu $50)** trước đợt chạy lớn, hết tiền là ChatGPT lỗi. Rollback: đổi lại `chatgpt:brightdata:online` + recreate worker web.
Còn: kiểm Query Fan-Out sau đợt chạy đầu; sửa doc MKT mục 4.6; báo team Citations ChatGPT gãy ở ngày chuyển; đổi mật khẩu API DataForSEO (đã lộ trong chat).

## 27/10 chiều: Standard queue — ĐANG CHẠY
- Fork thêm `DATAFORSEO_SCRAPER_MODE` (`live` mặc định | `standard` | `priority`) cho LLM Scraper ChatGPT/Gemini (commit `8a55020b`): `task_post` + poll `task_get/advanced` mỗi 60 s (standard, trần 75 phút) / 15 s (priority, trần 20 phút); lỗi task (vd 40200 hết tiền) báo ngay.
- Prod: worker **`0.7.5-geo2`** (source `/opt/elmo-src-v075-geo2`; web/db-migrate vẫn `0.7.5-geo1`), `.env` có `DATAFORSEO_SCRAPER_MODE=standard` + key DataForSEO MỚI (Chuan nạp $51; key cũ trial hết tiền đã bỏ). Nạp key bằng `/root/elmo-set-dataforseo.sh` (đọc stdin, kiểm key, backup, recreate).
- test-provider trong container ở chế độ standard: PASS (1m02s, có web query + citation). Chi phí ChatGPT ≈ 4.400 × $0,0012 ≈ **$5,3/tháng**.
- Sự cố 27/10 sáng: key trial $1 hết sau ~180 lượt → 660 lượt ChatGPT lỗi (không bị tính tiền), 219 prompt chạy lại sau khi có key mới.
- Lưu ý: mỗi prompt giữ 1 slot worker (10 slot) tới khi task ChatGPT xong → đợt lớn (Visana 72 prompt) có thể mất vài giờ.
