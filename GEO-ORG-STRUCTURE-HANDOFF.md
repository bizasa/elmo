# Elmo (geo.vidi.com.vn) — Handoff: cấu trúc Org / Brand / Workspace

Ngày: 2026-09-09. Mục đích: chụp lại **trạng thái phân quyền hiện tại** + **cơ chế thật của Elmo local** để cấu trúc lại org/brand/workspace sau.

---

## 1. Trạng thái hiện tại (DB prod contabo-sg, DB `elmo`)

### Org → Brands
| Org (id) | Tên | Brands trong org |
|---|---|---|
| `avia` | avia | **avia**, **vietnam-visa** |
| `visana` | Visana | **visana**, **gigago** |
| `cozyhome` | cozyhome | **cozyhome** |
| `default` | Default | **vidi-vn** (tên hiển thị "vidi.vn") |

### Org → Members (quyền xem/ghi brand)
| Org | Member | member.role |
|---|---|---|
| avia | chuannguyen@vietnambiz.com | admin |
| avia | hanhpham@vietnamdiscovery.com | member |
| avia | linhtm@vietnamdiscovery.com | member |
| avia | mynt@vidi.vn | member |
| avia | vantth@vietnamdiscovery.com | member |
| visana | chuannguyen@vietnambiz.com | admin |
| visana | hanhpham@vietnamdiscovery.com | member |
| visana | linhtm@vietnamdiscovery.com | member |
| visana | vantth@vietnamdiscovery.com | member |
| cozyhome | chuannguyen@vietnambiz.com | admin |
| default | chuannguyen@vietnambiz.com | admin |
| default | hangltm@vidi.vn | member |

### Users (bảng `user`) — `user.role` KHÁC `member.role`
- `chuannguyen@vietnambiz.com` → `user.role='admin'` (quyền vào `/admin` toàn hệ thống). email_verified=false nhưng vẫn login được.
- 5 user còn lại (hangltm, hanhpham, linhtm, mynt, vantth) → `user.role=NULL` (user thường), email_verified=true.

---

## 2. Cơ chế THẬT của Elmo local (đã đọc code, quan trọng khi restructure)

1. **Quyền là cấp ORG, không phải cấp brand.** `requireBrandAccess` resolve brand → `brands.organization_id` → tìm 1 row `member` của user trong org đó. Ai là member của org thì thấy **MỌI brand** trong org đó.
   - Hệ quả: **avia** thấy cả `avia` + `vietnam-visa`; **visana** thấy cả `visana` + `gigago`. Muốn tách 1 brand để cấp riêng → brand đó phải nằm **org riêng**.

2. **`member.role` ('member' vs 'admin') gần như VÔ HIỆU ở local mode.** Các server function ghi (thêm/sửa/xoá prompt, sửa competitor, đổi tên brand, tạo brand) **chỉ check membership**, KHÔNG check role. `member.role='admin'` chỉ có tác dụng ở các hàm quản-lý-team (rename workspace, invite/remove) mà `requireTeamInvites()` chặn cứng ở local → không dùng tới.
   - ➡️ **"member" = quyền GHI đầy đủ.** KHÔNG có read-only thật. Cấp membership = cho ghi.
   - Muốn read-only thật: dùng **Explorer report** (HTML tĩnh) hoặc **GEO MCP** (`geo_ro`, chỉ đọc); hoặc phải **patch code** thêm check role vào các hàm write.

3. **`user.role='admin'`** (bảng user) = vào `/admin` (đổi cadence per-brand, manual trigger, dashboard toàn hệ thống). ĐỪNG cấp cho user thường — để NULL.

4. **`default` là org catch-all.** Brand tạo qua UI "create brand" mà user thuộc nhiều org sẽ bị hỏi chọn org; brand tạo qua API/bootstrap không gán org rơi vào `default`. Member của `default` (giờ có hangltm) sẽ thấy MỌI brand rơi vào default sau này → **cẩn thận khi tạo brand mới.**

5. **Không có UI quản user/member ở local** (`teamInvites=false` hardcode). Mọi thao tác user/member = insert/xoá DB. Chi tiết cách tạo user (hash scrypt, 3 bảng user/account/member): xem memory `elmo-user-provisioning`.

---

## 3. Gợi ý khi cấu trúc lại (chưa làm — để bạn quyết)

- **Nếu muốn mỗi brand cấp quyền độc lập** → tách mỗi brand 1 org riêng (giống cozyhome). Hiện `vietnam-visa` bị dính chung org `avia`, `gigago` dính chung org `visana`. Muốn tách: tạo org mới + đổi `brands.organization_id` + di chuyển member tương ứng.
- **Đưa `vidi-vn` ra khỏi `default`** → tạo org `vidi` riêng, chuyển brand + member hangltm sang, để `default` sạch (tránh brand lạ lọt vào tầm nhìn hangltm).
- **Đặt tên org cho dễ đọc** (org.name) — hiện trùng id.
- Nếu cần phân biệt người-xem vs người-sửa: hiện code không hỗ trợ → cân nhắc patch `requireBrandOrganization` + check `member.role` trong các hàm write (updatePromptsFn, updateBrandFn, createBrandInOrgFn, updateCompetitors, ...). Đây là thay đổi CODE, nằm trong nhánh custom.

---

## 4. Thao tác DB nhanh (tham chiếu)

```bash
# Xem map org/brand/member
ssh contabo-sg "docker exec -i elmo-postgres-1 psql -U postgres -d elmo" <<'SQL'
SELECT o.id org, string_agg(b.id,', ') brands FROM organization o LEFT JOIN brands b ON b.organization_id=o.id GROUP BY o.id ORDER BY o.id;
SELECT m.organization_id org, u.email, m.role FROM member m JOIN "user" u ON u.id=m.user_id ORDER BY 1,2;
SQL

# Chuyển 1 brand sang org khác (tách quyền)
# UPDATE brands SET organization_id='<org_moi>' WHERE id='<brand_id>';
# (nhớ tạo org trước + gán member cho org mới)

# Thu hồi 1 user (cascade xoá account + member)
# DELETE FROM "user" WHERE email='<email>';
```

⚠️ Insert/select bảng `account` (cột password) hay bị **classifier chặn** — cần Chuan tự duyệt/chạy.
