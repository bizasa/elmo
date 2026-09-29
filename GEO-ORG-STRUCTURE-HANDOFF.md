# Elmo (geo.vidi.com.vn) — Handoff: cấu trúc Org / Brand / Workspace

Ngày cập nhật: **2026-09-21** (bản trước 2026-09-09 đã lỗi thời). Mục đích: chụp lại **trạng thái phân quyền hiện tại** + **cơ chế thật của Elmo local**.

---

## 0. Nhật ký thay đổi phân quyền (đọc đầu tiên khi mở session mới)

**2026-09-21 — team báo không vào được brand.** Nguyên nhân KHÔNG phải đổi tên brand (tên hiển thị không dính tới quyền), mà là brand bị **dồn sang org khác** (avia, visana → `default`; org `avia` cũ bị xoá) trong khi row `member` không chuyển theo → mynt@vidi.vn rơi khỏi mọi org.
- Đã thêm `mynt@vidi.vn` vào org `default` (role member).
- Đã đổi org id `visana` → `gigago` (org này vốn tên/slug Gigago, chứa gigago + chinaesim — id cũ gây nhầm với brand visana nằm ở `default`). Repoint member×4, brands×2; không có session nào trỏ org cũ.
- vantth@vietnamdiscovery.com giữ nguyên chỉ ở `gigago` (Chuan chốt).
- Kiểm lại 2026-09-29: DB live vẫn khớp bảng §1.

**2026-09-29:** đã sửa dòng Elmo trong `~/.claude/CLAUDE.md` (bỏ mô hình cũ "INSERT member org=brandId", thay bằng umbrella org + map hiện tại + cảnh báo không đổi id `default`).

---

## 1. Trạng thái hiện tại (DB prod contabo-sg, DB `elmo`)

### Org → Brands
| Org (id) | slug | Tên (org.name) | Brands trong org |
|---|---|---|---|
| `default` | `default` | ViDi | **avia**, **vidi-vn**, **vietnam-visa**, **visana**, **halongtrip** |
| `gigago` | `gigago` | Gigago | **gigago**, **chinaesim** |
| `cozyhome` | `cozyhome` | cozyhome | **cozyhome** |

> ⚠️ **Org id `default` bị HARDCODE** trong `packages/lib/src/db/provisioning.ts` (`LOCAL_ORG.id`). **KHÔNG đổi id này** — đổi sẽ vỡ provisioning (signup mới tạo lại org `default`). URL của nó dùng slug `default`, id không lộ ra ngoài.
> Org id `visana` cũ đã đổi thành `gigago` (2026-09-21) để khớp tên/slug, tránh bẫy "org id visana nhưng hiển thị Gigago".

### Org → Members (quyền xem/ghi brand — cấp ORG)
| Org | Member | member.role |
|---|---|---|
| default | chuannguyen@vietnambiz.com | admin |
| default | hangltm@vidi.vn | member |
| default | hanhpham@vietnamdiscovery.com | admin |
| default | linhtm@vietnamdiscovery.com | admin |
| default | mynt@vidi.vn | member |
| gigago | chuannguyen@vietnambiz.com | admin |
| gigago | hanhpham@vietnamdiscovery.com | admin |
| gigago | linhtm@vietnamdiscovery.com | admin |
| gigago | vantth@vietnamdiscovery.com | member |
| cozyhome | chuannguyen@vietnambiz.com | admin |

### Users (bảng `user`) — `user.role` KHÁC `member.role`
- `chuannguyen@vietnambiz.com` → `user.role='admin'` (vào `/admin` toàn hệ thống). email_verified=false nhưng vẫn login được.
- 5 user còn lại (hangltm, hanhpham, linhtm, mynt, vantth) → `user.role=NULL` (user thường), email_verified=true.

---

## 2. Cơ chế THẬT của Elmo local (đã đọc code, quan trọng khi restructure)

1. **Quyền là cấp ORG, không phải cấp brand.** Từ v0.3.0 dùng mô hình **umbrella org**: brand có cột `brands.organization_id`, 1 org chứa NHIỀU brand. `requireBrandAccess` resolve brand → `brands.organization_id` → tìm 1 row `member` của user trong org đó (`apps/web/src/lib/auth/helpers.ts` → `checkBrandAccess`). Ai là member của org thì thấy **MỌI brand** trong org đó.
   - Hệ quả: mọi member của `default` thấy cả 5 brand ViDi; member của `gigago` thấy gigago + chinaesim. Muốn tách 1 brand để cấp riêng → brand đó phải nằm **org riêng** (đổi `brands.organization_id`).

2. **`member.role` ('member' vs 'admin') gần như VÔ HIỆU ở local mode.** Các server function ghi (thêm/sửa/xoá prompt, competitor, đổi tên brand, tạo brand) **chỉ check membership**, KHÔNG check role. `member.role='admin'` chỉ tác dụng ở các hàm quản-lý-team mà `requireTeamInvites()` chặn cứng ở local → không dùng tới.
   - ➡️ **"member" = quyền GHI đầy đủ.** KHÔNG có read-only thật. Cấp membership = cho ghi.
   - Muốn read-only thật: dùng **Explorer report** (HTML tĩnh) hoặc **GEO MCP** (`geo_ro`, chỉ đọc); hoặc phải **patch code** thêm check role vào các hàm write.

3. **`user.role='admin'`** (bảng user) = vào `/admin` (đổi cadence per-brand, manual trigger, dashboard toàn hệ thống). ĐỪNG cấp cho user thường — để NULL.

4. **`default` là org catch-all + bị hardcode.** Brand tạo qua API/bootstrap không gán org rơi vào `default`. Member của `default` sẽ thấy MỌI brand rơi vào default sau này → **cẩn thận khi tạo brand mới** (gán `organization_id` đúng org).

5. **Không có UI quản user/member ở local** (`teamInvites=false` hardcode). Mọi thao tác user/member = insert/xoá DB. Chi tiết cách tạo user (hash scrypt, 3 bảng user/account/member): memory `elmo-user-provisioning`.

---

## 3. Gợi ý khi cấu trúc lại (chưa làm — để bạn quyết)

- **Nếu muốn mỗi brand cấp quyền độc lập** → tách brand ra org riêng (giống cozyhome): tạo org mới + đổi `brands.organization_id` + gán member tương ứng. Hiện 5 brand ViDi dùng chung org `default` → member nào ở default thấy hết cả 5.
- **Đặt tên org cho dễ đọc** (org.name / slug) — đã làm cho `gigago`; org `default` vẫn giữ id vì hardcode (chỉ đổi name/slug được).
- Nếu cần phân biệt người-xem vs người-sửa: code không hỗ trợ → cân nhắc patch check `member.role` trong các hàm write (updatePromptsFn, updateBrandFn, createBrandInOrgFn, updateCompetitors, ...). Đây là thay đổi CODE, nhánh custom.

---

## 4. Thao tác DB nhanh (tham chiếu)

```bash
# Xem map org/brand/member
ssh contabo-sg "docker exec -i elmo-postgres-1 psql -U postgres -d elmo" <<'SQL'
SELECT o.id org, o.slug, o.name, string_agg(b.id,', ') brands FROM organization o LEFT JOIN brands b ON b.organization_id=o.id GROUP BY o.id,o.slug,o.name ORDER BY o.id;
SELECT m.organization_id org, u.email, m.role FROM member m JOIN "user" u ON u.id=m.user_id ORDER BY 1,2;
SQL

# Thêm 1 user vào 1 org (cho xem mọi brand trong org đó)
# INSERT INTO member (id, organization_id, user_id, role, created_at)
#   VALUES (gen_random_uuid()::text, '<org_id>', '<user_id>', 'member', now())
#   ON CONFLICT (organization_id, user_id) DO NOTHING;

# Chuyển 1 brand sang org khác (tách quyền)
# UPDATE brands SET organization_id='<org_moi>' WHERE id='<brand_id>';  (tạo org + gán member trước)

# Đổi ORG ID (PK) — 5 bảng FK đều NO ACTION nên phải làm trong 1 transaction, KHÔNG đổi id 'default'
#   psql -1: tạo org mới (né slug unique) → repoint member/brands/invitation/organization_settings/apikey.reference_id → xoá org cũ
#   (check session.active_organization_id trước; xem git log commit rename visana→gigago 2026-09-21)

# Thu hồi 1 user (cascade xoá account + member)
# DELETE FROM "user" WHERE email='<email>';
```

⚠️ Insert/select bảng `account` (cột password) hay bị **classifier chặn** — cần Chuan tự duyệt/chạy.
