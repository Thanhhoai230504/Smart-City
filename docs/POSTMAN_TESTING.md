# 🧪 Smart City Dashboard — Hướng dẫn Test API bằng Postman

> **Base URL:** `http://localhost:5000`
> **Content-Type:** `application/json` (trừ upload ảnh dùng `multipart/form-data`)

---

## 1. AUTHENTICATION

### 1.1 Đăng ký tài khoản mới

```
POST http://localhost:5000/api/auth/register
```

**Body (JSON):**

```json
{
  "name": "Lê Văn Test",
  "email": "levantest@gmail.com",
  "password": "test123"
}
```

---

### 1.2 Đăng nhập Admin

```
POST http://localhost:5000/api/auth/login
```

**Body (JSON):**

```json
{
  "email": "admin@smartcity.vn",
  "password": "admin123"
}
```

> ✅ **Copy `accessToken` từ response** → dùng cho các request cần xác thực.
> Trong Postman: Tab **Authorization** → Type: **Bearer Token** → paste token.

---

### 1.3 Đăng nhập User

```
POST http://localhost:5000/api/auth/login
```

**Body (JSON):**

```json
{
  "email": "nguyenvana@gmail.com",
  "password": "user123"
}
```

---

### 1.4 Refresh Token

```
POST http://localhost:5000/api/auth/refresh
```

> Không cần body. Refresh Token tự động được đọc từ cookie.
> Trong Postman: vào **Settings** → bật **Automatically follow redirects** và **Send cookies**.

---

### 1.5 Xem Profile

```
GET http://localhost:5000/api/auth/profile
```

> 🔒 Cần Bearer Token

---

### 1.6 Đăng xuất

```
POST http://localhost:5000/api/auth/logout
```

> 🔒 Cần Bearer Token

---

### 1.7 Test Validation — Đăng ký sai

```
POST http://localhost:5000/api/auth/register
```

**Body (JSON):**

```json
{
  "name": "",
  "email": "email-khong-hop-le",
  "password": "123"
}
```

> ❌ Expected: `400` với danh sách lỗi validation

---

## 2. ISSUES (SỰ CỐ ĐÔ THỊ)

### 2.1 Lấy tất cả sự cố

```
GET http://localhost:5000/api/issues
```

---

### 2.2 Lấy sự cố — có filter và phân trang

```
GET http://localhost:5000/api/issues?status=reported&page=1&limit=5
```

```
GET http://localhost:5000/api/issues?category=pothole
```

```
GET http://localhost:5000/api/issues?status=processing&category=garbage
```

---

### 2.3 Tạo sự cố mới (không có ảnh)

```
POST http://localhost:5000/api/issues
```

> 🔒 Cần Bearer Token (đăng nhập user)

**Body (JSON):**

```json
{
  "title": "Đèn giao thông hỏng tại ngã tư Lê Duẩn",
  "description": "Đèn giao thông tại ngã tư Lê Duẩn - Trần Phú không hoạt động từ sáng nay, gây nguy hiểm cho người tham gia giao thông.",
  "category": "streetlight",
  "location": "Ngã tư Lê Duẩn - Trần Phú, Hải Châu, Đà Nẵng",
  "latitude": 16.0608,
  "longitude": 108.2198
}
```

---

### 2.4 Tạo sự cố mới (có ảnh)

```
POST http://localhost:5000/api/issues
```

> 🔒 Cần Bearer Token
> Trong Postman: chọn **Body** → **form-data**

| Key | Type | Value |
|-----|------|-------|
| `title` | Text | `Rác thải chất đống trên đường Nguyễn Chí Thanh` |
| `description` | Text | `Rác thải sinh hoạt chất đống trên vỉa hè, bốc mùi hôi thối` |
| `category` | Text | `garbage` |
| `location` | Text | `Đường Nguyễn Chí Thanh, Hải Châu, Đà Nẵng` |
| `latitude` | Text | `16.0635` |
| `longitude` | Text | `16.2120` |
| `image` | **File** | *(chọn file ảnh từ máy, tối đa 5MB)* |

---

### 2.5 Xem chi tiết sự cố

```
GET http://localhost:5000/api/issues/{issue_id}
```

> Thay `{issue_id}` bằng `_id` thật từ response trước đó.

---

### 2.6 Xem sự cố của tôi

```
GET http://localhost:5000/api/issues/my
```

> 🔒 Cần Bearer Token (user)

```
GET http://localhost:5000/api/issues/my?status=reported&page=1&limit=5
```

---

### 2.7 Admin cập nhật trạng thái → Processing

```
PATCH http://localhost:5000/api/issues/{issue_id}/status
```

> 🛡️ Cần Bearer Token **(admin)**

**Body (JSON):**

```json
{
  "status": "processing"
}
```

---

### 2.8 Admin cập nhật trạng thái → Resolved

```
PATCH http://localhost:5000/api/issues/{issue_id}/status
```

> 🛡️ Cần Bearer Token **(admin)**

**Body (JSON):**

```json
{
  "status": "resolved"
}
```

---

### 2.9 Admin cập nhật trạng thái → Rejected

```
PATCH http://localhost:5000/api/issues/{issue_id}/status
```

> 🛡️ Cần Bearer Token **(admin)**

**Body (JSON):**

```json
{
  "status": "rejected"
}
```

---

### 2.10 Admin xóa sự cố

```
DELETE http://localhost:5000/api/issues/{issue_id}
```

> 🛡️ Cần Bearer Token **(admin)**

---

### 2.11 Test phân quyền — User truy cập API admin

```
PATCH http://localhost:5000/api/issues/{issue_id}/status
```

> 🔒 Dùng Bearer Token của **user** (không phải admin)

**Body (JSON):**

```json
{
  "status": "resolved"
}
```

> ❌ Expected: `403 Forbidden` — "Access denied. Admin privileges required."

---

## 3. PLACES (ĐỊA ĐIỂM CÔNG CỘNG)

### 3.1 Lấy tất cả địa điểm

```
GET http://localhost:5000/api/places
```

---

### 3.2 Lấy theo loại

```
GET http://localhost:5000/api/places?type=hospital
```

```
GET http://localhost:5000/api/places?type=school
```

```
GET http://localhost:5000/api/places?type=bus_stop
```

```
GET http://localhost:5000/api/places?type=park
```

```
GET http://localhost:5000/api/places?type=police
```

---

### 3.3 Admin tạo địa điểm mới

```
POST http://localhost:5000/api/places
```

> 🛡️ Cần Bearer Token **(admin)**

**Body (JSON):**

```json
{
  "name": "Bệnh viện 199 - Bộ Công an",
  "type": "hospital",
  "address": "216 Ngô Quyền, An Hải Bắc, Sơn Trà, Đà Nẵng",
  "latitude": 16.0812,
  "longitude": 108.2301,
  "description": "Bệnh viện thuộc Bộ Công an, phục vụ cả dân sự",
  "phone": "0236 3833 119"
}
```

---

### 3.4 Admin cập nhật địa điểm

```
PUT http://localhost:5000/api/places/{place_id}
```

> 🛡️ Cần Bearer Token **(admin)**

**Body (JSON):**

```json
{
  "phone": "0236 3833 120",
  "isActive": false
}
```

---

### 3.5 Admin xóa địa điểm

```
DELETE http://localhost:5000/api/places/{place_id}
```

> 🛡️ Cần Bearer Token **(admin)**

---

## 4. ENVIRONMENT (MÔI TRƯỜNG)

### 4.1 Lấy dữ liệu thời tiết hiện tại

```
GET http://localhost:5000/api/environment
```

> Trả về nhiệt độ, độ ẩm cho 5 quận Đà Nẵng

---

### 4.2 Lấy lịch sử 24 giờ

```
GET http://localhost:5000/api/environment/history
```

---

### 4.3 Lấy lịch sử theo khu vực (48 giờ)

```
GET http://localhost:5000/api/environment/history?location=Quận Hải Châu, Đà Nẵng&hours=48
```

---

## 5. TRAFFIC (GIAO THÔNG)

### 5.1 Lấy dữ liệu giao thông mặc định (trung tâm Đà Nẵng)

```
GET http://localhost:5000/api/traffic
```

---

### 5.2 Lấy dữ liệu giao thông theo tọa độ

```
GET http://localhost:5000/api/traffic?lat=16.0720&lon=108.2140&zoom=14
```

---

## 6. DASHBOARD (THỐNG KÊ)

### 6.1 Lấy thống kê tổng hợp

```
GET http://localhost:5000/api/dashboard/stats
```

> 🛡️ Cần Bearer Token **(admin)**

---

## 7. HEALTH CHECK

### 7.1 Kiểm tra server

```
GET http://localhost:5000/
```

> ✅ Expected: `{ "success": true, "message": "Smart City Dashboard API is running" }`

---

### 7.2 Test 404

```
GET http://localhost:5000/api/khongcogirohet
```

> ❌ Expected: `404` — "Route /api/khongcogirohet not found"

---

## Postman Tips

### Cách set Bearer Token nhanh

1. Tạo một **Postman Environment** với variable `token`
2. Trong request Login, vào tab **Tests** thêm script:

```javascript
var jsonData = pm.response.json();
if (jsonData.data && jsonData.data.accessToken) {
    pm.environment.set("token", jsonData.data.accessToken);
}
```

3. Trong các request khác, tab **Authorization**:
   - Type: `Bearer Token`
   - Token: `{{token}}`

→ Mỗi lần login xong, token tự động cập nhật cho tất cả request!

---

## Tài khoản test (Seed Data)

| Vai trò | Email | Password |
|---------|-------|----------|
| 🛡️ Admin | `admin@smartcity.vn` | `admin123` |
| 👤 User 1 | `nguyenvana@gmail.com` | `user123` |
| 👤 User 2 | `tranthib@gmail.com` | `user123` |

---

## Trình tự test đề xuất

1. ✅ `GET /` → kiểm tra server chạy
2. ✅ `POST /api/auth/login` (admin) → lấy token admin
3. ✅ `GET /api/dashboard/stats` → xem thống kê
4. ✅ `GET /api/places` → xem danh sách địa điểm
5. ✅ `GET /api/issues` → xem danh sách sự cố
6. ✅ `POST /api/auth/login` (user) → lấy token user
7. ✅ `POST /api/issues` → user tạo sự cố mới
8. ✅ `GET /api/issues/my` → user xem sự cố của mình
9. ✅ `PATCH /api/issues/:id/status` (admin token) → admin xử lý sự cố
10. ✅ `GET /api/environment` → xem dữ liệu thời tiết
11. ✅ `GET /api/traffic` → xem dữ liệu giao thông
12. ❌ `PATCH /api/issues/:id/status` (user token) → test bị từ chối 403
