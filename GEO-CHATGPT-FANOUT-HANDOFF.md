# ChatGPT Query Fan-Out trống — handoff (26/10/2026, CHƯA xử lý xong)

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
