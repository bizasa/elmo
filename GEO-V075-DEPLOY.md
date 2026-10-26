# Elmo geo — nâng lên upstream v0.7.5 (nhánh `geo-v075`)

Nhánh `geo-v075` = `geo-v043` + merge upstream v0.7.5 (commit `583c55f2`). Image tag: **`0.7.5-geo1`** cho cả web / worker / db-migrate. Source build trên server: `/opt/elmo-src-v075`.

## Thay đổi lớn phải biết

- **Mention giờ nằm ở bảng `run_mentions`** (Jev chấm, cột `assessments` có sentiment/position). Migration `0024_replayable_runs` chép `brand_mentioned`/`competitors_mentioned` sang đó rồi **DROP hai cột này khỏi `prompt_runs`** và gắn trigger cấm UPDATE `prompt_runs`.
  → Image cũ (0.4.3-geoN) **không chạy được** trên DB đã migrate. **Rollback = restore dump**, không phải đổi tag.
- **Worker không khởi động nếu thiếu `TYPESAFE_API_KEY`** (hoặc `OPENROUTER_API_KEY`). Đã nạp `TYPESAFE_API_KEY` vào `~/.elmo/.env` (backup `.env.bak-pre-typesafe-*`).
- Fork bỏ `brand_position` (cột còn trong DB, không ai ghi nữa) và tiền tố alias `=` — upstream khớp nguyên từ mặc định. **Alias `=AVIA`, `=VIDI` phải bỏ dấu `=`** (bước 5), không thì AVIA/VIDI mất hết mention.
- Migration custom `0031_explorer_reports` giữ `when` cũ (1787046426553) < threshold prod (1790299942543) → prod bỏ qua; chỉ 8 migration upstream 0023–0030 chạy.
- **`geo-data-api` (connector GEO MCP, repo `E:\Projects\geo-mcp`) đọc các cột bị drop** → các tool `geo_*` hỏng cho tới khi sửa nó đọc `run_mentions`.

## Các bước deploy

```bash
# 0. Build web + worker (db-migrate đã build) — trên contabo-sg
cd /opt/elmo-src-v075
docker build -f docker/Dockerfile --target web    -t elmohq/elmo-web:0.7.5-geo1    --build-arg DEPLOYMENT_MODE=local .
docker build -f docker/Dockerfile --target worker -t elmohq/elmo-worker:0.7.5-geo1 --build-arg DEPLOYMENT_MODE=local .

# 1. Backup
cd /root/.elmo
TS=$(date +%Y%m%d-%H%M%S)
docker compose -p elmo -f elmo.yaml exec -T postgres pg_dump -U postgres -d elmo | gzip > /root/elmo-pre-v075-$TS.sql.gz
cp -p elmo.yaml elmo.yaml.pre-v075-$TS; cp -p .env .env.bak-pre-v075-$TS

# 2. Dừng worker + web (không ghi gì trong lúc migrate)
docker compose -p elmo -f elmo.yaml stop worker web

# 3. Đổi tag 3 image sang 0.7.5-geo1
sed -i -E 's#(elmohq/elmo-(web|worker|db-migrate)):0\.4\.3-geo[0-9]+#\1:0.7.5-geo1#' elmo.yaml

# 4. Migrate
docker compose -p elmo -f elmo.yaml up db-migrate

# 5. Bỏ dấu "=" trong alias
docker compose -p elmo -f elmo.yaml exec -T postgres psql -U postgres -d elmo -c "
UPDATE brands SET aliases = ARRAY(SELECT regexp_replace(a, '^=\s*', '') FROM unnest(aliases) a)
 WHERE EXISTS (SELECT 1 FROM unnest(aliases) a WHERE a LIKE '=%');
UPDATE competitors SET aliases = ARRAY(SELECT regexp_replace(a, '^=\s*', '') FROM unnest(aliases) a)
 WHERE EXISTS (SELECT 1 FROM unnest(aliases) a WHERE a LIKE '=%');"

# 6. Chạy
docker compose -p elmo -f elmo.yaml up -d
docker compose -p elmo -f elmo.yaml logs -f --tail=100 worker
```

## Sau deploy

- Worker tự chạy nền: backfill rollups (`background_migrations`) + chấm lại 90 ngày bằng Jev (`REPROCESS_DAYS`, chỉ prompt/brand đang bật). Dashboard trễ số tới khi xong.
  Theo dõi: `select name, rows_done, finished_at, last_error from background_migrations;`
- Kiểm: đăng nhập, overview (thẻ Sentiment/Position), trang Sentiment, AI Explorer tạo report mới.
- Báo team MKT: visibility của tên dễ trùng (Cozyhome, VIDI, AVIA) sẽ **giảm** — số được sửa đúng, không phải tụt thật.
- Sửa `geo-data-api` sang `run_mentions` (position: `assessments->'brand'->>'position'`).

## Rollback

```bash
cd /root/.elmo
docker compose -p elmo -f elmo.yaml stop web worker
cp elmo.yaml.pre-v075-<TS> elmo.yaml
docker compose -p elmo -f elmo.yaml exec -T postgres psql -U postgres -c "DROP DATABASE elmo WITH (FORCE);" -c "CREATE DATABASE elmo;"
gunzip -c /root/elmo-pre-v075-<TS>.sql.gz | docker compose -p elmo -f elmo.yaml exec -T postgres psql -U postgres -d elmo -q
docker compose -p elmo -f elmo.yaml up -d
```
