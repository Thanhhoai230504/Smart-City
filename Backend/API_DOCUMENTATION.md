# 📡 Smart City Dashboard — API Documentation

> **Base URL:** `http://localhost:5000/api`
> **Version:** 1.0.0
> **Authentication:** JWT Bearer Token

---

## Mục lục

1. [Authentication](#1-authentication-api)
2. [Issues (Sự cố đô thị)](#2-issues-api)
3. [Places (Địa điểm công cộng)](#3-places-api)
4. [Environment (Môi trường)](#4-environment-api)
5. [Traffic (Giao thông)](#5-traffic-api)
6. [Dashboard (Thống kê)](#6-dashboard-api)
7. [Socket.io Events](#7-socketio-events)
8. [Error Response Format](#8-error-response-format)

---

## Quy ước chung

### Authentication Header

```
Authorization: Bearer <access_token>
```

### Phân quyền

| Ký hiệu | Mô tả |
|----------|--------|
| 🔓 Public | Không cần đăng nhập |
| 🔒 Private | Cần Access Token (user hoặc admin) |
| 🛡️ Admin | Chỉ admin mới truy cập được |

### Response Format

Mọi response đều theo cấu trúc:

```json
{
  "success": true,
  "message": "Mô tả kết quả (tuỳ chọn)",
  "data": { ... }
}
```

---

## 1. Authentication API

### 1.1 Đăng ký tài khoản

```
POST /api/auth/register
```

🔓 **Public**

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | String | ✅ | Tối đa 100 ký tự |
| `email` | String | ✅ | Email hợp lệ, unique |
| `password` | String | ✅ | Tối thiểu 6 ký tự |

**Request Example:**

```json
{
  "name": "Nguyễn Văn A",
  "email": "nguyenvana@gmail.com",
  "password": "123456"
}
```

**Response (201):**

```json
{
  "success": true,
  "message": "Registration successful.",
  "data": {
    "user": {
      "id": "65f1a2b3c4d5e6f7a8b9c0d1",
      "name": "Nguyễn Văn A",
      "email": "nguyenvana@gmail.com",
      "role": "user"
    }
  }
}
```

**Error Cases:**

| Status | Message |
|--------|---------|
| 400 | `Email already registered.` |
| 400 | `Validation failed` (thiếu trường / email không hợp lệ / password ngắn) |

---

### 1.2 Đăng nhập

```
POST /api/auth/login
```

🔓 **Public**

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `email` | String | ✅ |
| `password` | String | ✅ |

**Request Example:**

```json
{
  "email": "nguyenvana@gmail.com",
  "password": "123456"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "65f1a2b3c4d5e6f7a8b9c0d1",
      "name": "Nguyễn Văn A",
      "email": "nguyenvana@gmail.com",
      "role": "user"
    }
  }
}
```

> **Lưu ý:** Refresh Token được tự động set vào **HttpOnly Cookie** (`refreshToken`), không nằm trong response body.

**Error Cases:**

| Status | Message |
|--------|---------|
| 401 | `Invalid email or password.` |
| 403 | `Account has been deactivated.` |

---

### 1.3 Refresh Access Token

```
POST /api/auth/refresh
```

🔓 **Public** (cần Refresh Token trong cookie)

> Khi Access Token hết hạn (15 phút), client gọi endpoint này để lấy Access Token mới mà không cần đăng nhập lại.

**Request:** Không cần body. Refresh Token được đọc từ cookie `refreshToken`.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Error Cases:**

| Status | Message |
|--------|---------|
| 401 | `No refresh token provided.` |
| 401 | `Invalid refresh token.` |
| 401 | `Refresh token expired. Please login again.` |

---

### 1.4 Đăng xuất

```
POST /api/auth/logout
```

🔒 **Private**

> Xóa Refresh Token khỏi database và cookie.

**Response (200):**

```json
{
  "success": true,
  "message": "Logout successful."
}
```

---

### 1.5 Xem thông tin cá nhân

```
GET /api/auth/profile
```

🔒 **Private**

**Response (200):**

```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "65f1a2b3c4d5e6f7a8b9c0d1",
      "name": "Nguyễn Văn A",
      "email": "nguyenvana@gmail.com",
      "role": "user",
      "isActive": true,
      "createdAt": "2025-03-01T10:00:00.000Z",
      "updatedAt": "2025-03-01T10:00:00.000Z"
    }
  }
}
```

---

## 2. Issues API

### 2.1 Lấy danh sách sự cố

```
GET /api/issues
```

🔓 **Public**

**Query Parameters:**

| Param | Type | Default | Mô tả |
|-------|------|---------|--------|
| `status` | String | — | Filter: `reported`, `processing`, `resolved`, `rejected` |
| `category` | String | — | Filter: `pothole`, `garbage`, `streetlight`, `flooding`, `tree`, `other` |
| `page` | Number | `1` | Trang hiện tại |
| `limit` | Number | `10` | Số item mỗi trang |
| `sort` | String | `-createdAt` | Sắp xếp (VD: `createdAt`, `-title`) |

**Request Example:**

```
GET /api/issues?status=reported&category=pothole&page=1&limit=5
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "issues": [
      {
        "_id": "65f2...",
        "title": "Ổ gà lớn trên đường Nguyễn Văn Linh",
        "description": "Có một ổ gà rất lớn...",
        "category": "pothole",
        "location": "Đường Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
        "latitude": 16.0544,
        "longitude": 108.2022,
        "imageUrl": null,
        "status": "reported",
        "userId": { "_id": "65f1...", "name": "Nguyễn Văn A", "email": "nguyenvana@gmail.com" },
        "adminId": null,
        "resolvedAt": null,
        "createdAt": "2025-03-10T08:30:00.000Z",
        "updatedAt": "2025-03-10T08:30:00.000Z"
      }
    ],
    "pagination": {
      "current": 1,
      "pages": 3,
      "total": 15,
      "limit": 5
    }
  }
}
```

---

### 2.2 Tạo sự cố mới

```
POST /api/issues
```

🔒 **Private**

**Content-Type:** `multipart/form-data` (vì có upload ảnh)

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | String | ✅ | Tối đa 200 ký tự |
| `description` | String | ✅ | Mô tả chi tiết sự cố |
| `category` | String | ✅ | Enum: `pothole`, `garbage`, `streetlight`, `flooding`, `tree`, `other` |
| `location` | String | ✅ | Địa chỉ cụ thể |
| `latitude` | Number | ✅ | -90 đến 90 |
| `longitude` | Number | ✅ | -180 đến 180 |
| `image` | File | ❌ | Ảnh minh họa (JPG/PNG/GIF/WEBP, tối đa 5MB) |

**Response (201):**

```json
{
  "success": true,
  "message": "Issue reported successfully.",
  "data": {
    "issue": {
      "_id": "65f3...",
      "title": "Ổ gà trên đường Lê Lợi",
      "status": "reported",
      "userId": { "_id": "65f1...", "name": "Nguyễn Văn A", "email": "..." },
      "imageUrl": "https://res.cloudinary.com/xxx/image/upload/v123/smart-city-issues/abc.jpg",
      "createdAt": "2025-03-12T14:30:00.000Z"
    }
  }
}
```

> **Lưu ý:** Khi tạo sự cố thành công, server emit Socket.io event `issue:created` tới tất cả admin online.
> Nếu upload ảnh thành công nhưng lưu DB thất bại, ảnh trên Cloudinary sẽ tự động bị xóa (rollback).

---

### 2.3 Xem chi tiết sự cố

```
GET /api/issues/:id
```

🔓 **Public**

**Response (200):**

```json
{
  "success": true,
  "data": {
    "issue": {
      "_id": "65f2...",
      "title": "Ổ gà lớn trên đường Nguyễn Văn Linh",
      "description": "Mô tả chi tiết...",
      "category": "pothole",
      "location": "...",
      "latitude": 16.0544,
      "longitude": 108.2022,
      "imageUrl": "https://res.cloudinary.com/...",
      "status": "processing",
      "userId": { "_id": "...", "name": "...", "email": "..." },
      "adminId": { "_id": "...", "name": "Admin", "email": "..." },
      "resolvedAt": null,
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
}
```

---

### 2.4 Lấy sự cố của tôi

```
GET /api/issues/my
```

🔒 **Private**

**Query Parameters:**

| Param | Type | Default | Mô tả |
|-------|------|---------|--------|
| `status` | String | — | Filter theo trạng thái |
| `page` | Number | `1` | Trang |
| `limit` | Number | `10` | Số item mỗi trang |

**Response:** Cấu trúc giống [2.1](#21-lấy-danh-sách-sự-cố) nhưng chỉ trả về sự cố của user hiện tại.

---

### 2.5 Cập nhật trạng thái sự cố

```
PATCH /api/issues/:id/status
```

🛡️ **Admin**

**Request Body:**

| Field | Type | Required | Values |
|-------|------|----------|--------|
| `status` | String | ✅ | `reported`, `processing`, `resolved`, `rejected` |

**Request Example:**

```json
{
  "status": "processing"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Issue status updated to processing.",
  "data": {
    "issue": {
      "_id": "65f2...",
      "status": "processing",
      "adminId": { "_id": "...", "name": "Admin", "email": "..." }
    }
  }
}
```

> **Socket.io:** Emit `issue:updated` tới user báo cáo. Nếu `resolved` thì emit thêm `issue:resolved`.

---

### 2.6 Xóa sự cố

```
DELETE /api/issues/:id
```

🛡️ **Admin**

**Response (200):**

```json
{
  "success": true,
  "message": "Issue deleted successfully."
}
```

---

## 3. Places API

### 3.1 Lấy danh sách địa điểm

```
GET /api/places
```

🔓 **Public**

**Query Parameters:**

| Param | Type | Mô tả |
|-------|------|--------|
| `type` | String | Filter: `hospital`, `school`, `bus_stop`, `park`, `police` |
| `isActive` | String | Filter: `true` hoặc `false` |

**Request Example:**

```
GET /api/places?type=hospital
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "places": [
      {
        "_id": "65f4...",
        "name": "Bệnh viện Đà Nẵng",
        "type": "hospital",
        "address": "124 Hải Phòng, Thạch Thang, Hải Châu, Đà Nẵng",
        "latitude": 16.0720,
        "longitude": 108.2140,
        "description": "Bệnh viện đa khoa lớn nhất miền Trung",
        "phone": "0236 3822 358",
        "isActive": true
      }
    ],
    "total": 1
  }
}
```

---

### 3.2 Xem chi tiết địa điểm

```
GET /api/places/:id
```

🔓 **Public**

---

### 3.3 Thêm địa điểm mới

```
POST /api/places
```

🛡️ **Admin**

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | String | ✅ | Tên địa điểm |
| `type` | String | ✅ | Enum: `hospital`, `school`, `bus_stop`, `park`, `police` |
| `address` | String | ❌ | Địa chỉ |
| `latitude` | Number | ✅ | -90 đến 90 |
| `longitude` | Number | ✅ | -180 đến 180 |
| `description` | String | ❌ | Mô tả thêm |
| `phone` | String | ❌ | Số điện thoại |

**Response (201):**

```json
{
  "success": true,
  "message": "Place created successfully.",
  "data": { "place": { ... } }
}
```

---

### 3.4 Cập nhật địa điểm

```
PUT /api/places/:id
```

🛡️ **Admin**

**Request Body:** Các field cần cập nhật (partial update).

---

### 3.5 Xóa địa điểm

```
DELETE /api/places/:id
```

🛡️ **Admin**

---

## 4. Environment API

### 4.1 Lấy dữ liệu môi trường hiện tại

```
GET /api/environment
```

🔓 **Public**

> Proxy gọi OpenWeatherMap API. Dữ liệu được cache 30 phút. Cron job tự động thu thập mỗi 30 phút.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "environment": [
      {
        "location": "Quận Hải Châu, Đà Nẵng",
        "source": "OpenWeatherMap",
        "temperature": 28.5,
        "humidity": 75,
        "weatherCondition": "Clouds",
        "weatherDescription": "mây rải rác",
        "latitude": 16.0544,
        "longitude": 108.2022,
        "icon": "03d"
      },
      {
        "location": "Quận Thanh Khê, Đà Nẵng",
        "source": "OpenWeatherMap",
        "temperature": 29.2,
        "humidity": 80,
        "weatherCondition": "Clear",
        "weatherDescription": "trời quang",
        "latitude": 16.0678,
        "longitude": 108.1837,
        "icon": "01d"
      }
    ],
    "source": "api",
    "lastUpdated": "2025-03-12T14:30:00.000Z"
  }
}
```

> **Lưu ý:** Nếu chưa cấu hình `OPENWEATHER_API_KEY`, API trả về mock data với `source: "mock"`.

---

### 4.2 Lấy lịch sử dữ liệu môi trường

```
GET /api/environment/history
```

🔓 **Public**

**Query Parameters:**

| Param | Type | Default | Mô tả |
|-------|------|---------|--------|
| `location` | String | — | Filter theo tên khu vực |
| `hours` | Number | `24` | Số giờ lịch sử cần lấy |

**Request Example:**

```
GET /api/environment/history?location=Quận Hải Châu, Đà Nẵng&hours=48
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "history": [
      {
        "_id": "65f5...",
        "location": "Quận Hải Châu, Đà Nẵng",
        "temperature": 28.5,
        "humidity": 75,
        "weatherCondition": "Clouds",
        "createdAt": "2025-03-12T14:00:00.000Z"
      }
    ],
    "total": 48
  }
}
```

---

## 5. Traffic API

### 5.1 Lấy dữ liệu giao thông

```
GET /api/traffic
```

🔓 **Public**

> Proxy gọi TomTom Traffic API. Dữ liệu được **cache 5 phút** để tiết kiệm quota (2.500 req/ngày).

**Query Parameters:**

| Param | Type | Default | Mô tả |
|-------|------|---------|--------|
| `lat` | Number | `16.0544` | Latitude trung tâm |
| `lon` | Number | `108.2022` | Longitude trung tâm |
| `zoom` | Number | `12` | Mức zoom bản đồ |

**Response (200) — API mode:**

```json
{
  "success": true,
  "data": {
    "traffic": {
      "currentSpeed": 35,
      "freeFlowSpeed": 60,
      "currentTravelTime": 120,
      "freeFlowTravelTime": 80,
      "confidence": 0.95,
      "coordinates": [
        { "latitude": 16.054, "longitude": 108.202 },
        { "latitude": 16.059, "longitude": 108.207 }
      ],
      "color": "yellow",
      "level": "slow"
    },
    "source": "api",
    "lastUpdated": "2025-03-12T14:30:00.000Z"
  }
}
```

**Response (200) — Mock mode** (khi chưa có API key):

```json
{
  "success": true,
  "data": {
    "traffic": [
      {
        "name": "Đường Nguyễn Văn Linh",
        "currentSpeed": 55,
        "freeFlowSpeed": 60,
        "color": "green",
        "level": "normal",
        "coordinates": [...]
      },
      {
        "name": "Đường Lê Duẩn",
        "currentSpeed": 8,
        "freeFlowSpeed": 60,
        "color": "red",
        "level": "heavy",
        "coordinates": [...]
      }
    ],
    "source": "mock"
  }
}
```

**Phân loại màu sắc giao thông:**

| Màu | Tốc độ | Mức độ |
|------|--------|--------|
| 🟢 `green` | > 50 km/h | `normal` — Thông thoáng |
| 🟡 `yellow` | 20–50 km/h | `slow` — Đông, chậm lại |
| 🟠 `orange` | 10–20 km/h | `congested` — Kẹt xe nhẹ |
| 🔴 `red` | < 10 km/h | `heavy` — Kẹt xe nặng |

---

## 6. Dashboard API

### 6.1 Lấy thống kê tổng hợp

```
GET /api/dashboard/stats
```

🛡️ **Admin**

**Response (200):**

```json
{
  "success": true,
  "data": {
    "overview": {
      "totalIssues": 25,
      "issuesToday": 3,
      "issuesThisWeek": 12,
      "issuesThisMonth": 20,
      "totalUsers": 15,
      "totalPlaces": 11
    },
    "issuesByStatus": {
      "reported": 8,
      "processing": 5,
      "resolved": 10,
      "rejected": 2
    },
    "issuesByCategory": [
      { "category": "pothole", "label": "Ổ gà", "count": 7 },
      { "category": "garbage", "label": "Rác thải", "count": 5 },
      { "category": "streetlight", "label": "Đèn đường hỏng", "count": 4 },
      { "category": "flooding", "label": "Ngập nước", "count": 4 },
      { "category": "tree", "label": "Cây đổ", "count": 3 },
      { "category": "other", "label": "Khác", "count": 2 }
    ],
    "issuesTrend": [
      { "date": "2025-03-01", "count": 2 },
      { "date": "2025-03-02", "count": 5 },
      { "date": "2025-03-03", "count": 1 }
    ],
    "recentIssues": [
      {
        "_id": "...",
        "title": "Ổ gà trên đường...",
        "category": "pothole",
        "status": "reported",
        "location": "...",
        "createdAt": "..."
      }
    ]
  }
}
```

---

## 7. Socket.io Events

### Kết nối

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
  withCredentials: true
});

// Join room sau khi đăng nhập
socket.emit('join', { role: 'admin', userId: 'user_id_here' });
```

### Danh sách Events

| Event | Gửi tới | Khi nào | Payload |
|-------|---------|---------|---------|
| `issue:created` | Room `admins` | User tạo sự cố mới | `{ message, issue }` |
| `issue:updated` | Room `user_{userId}` | Admin cập nhật trạng thái | `{ message, issue }` |
| `issue:resolved` | Room `user_{userId}` | Admin đánh dấu đã xử lý | `{ message, issue }` |

### Lắng nghe Events (Client)

```javascript
// Admin nhận thông báo sự cố mới
socket.on('issue:created', (data) => {
  console.log(data.message);    // "New issue reported: Ổ gà trên đường..."
  console.log(data.issue);      // Issue object đầy đủ
});

// User nhận cập nhật trạng thái
socket.on('issue:updated', (data) => {
  console.log(data.message);    // "Your issue "..." has been updated to: processing"
});

// User nhận thông báo đã xử lý xong
socket.on('issue:resolved', (data) => {
  console.log(data.message);    // "Your issue "..." has been resolved!"
});
```

---

## 8. Error Response Format

Mọi lỗi đều trả về cấu trúc thống nhất:

```json
{
  "success": false,
  "message": "Mô tả lỗi"
}
```

### HTTP Status Codes

| Code | Ý nghĩa |
|------|---------|
| `200` | Thành công |
| `201` | Tạo mới thành công |
| `400` | Bad Request — dữ liệu không hợp lệ |
| `401` | Unauthorized — chưa đăng nhập / token hết hạn |
| `403` | Forbidden — không có quyền truy cập |
| `404` | Not Found — resource không tồn tại |
| `429` | Too Many Requests — vượt quá rate limit (100 req / 15 phút) |
| `500` | Internal Server Error |

### Validation Error (400)

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Please enter a valid email" },
    { "field": "password", "message": "Password must be at least 6 characters" }
  ]
}
```

### Token Expired (401)

```json
{
  "success": false,
  "message": "Token expired. Please refresh your token.",
  "code": "TOKEN_EXPIRED"
}
```

> Client nên dùng **Axios Interceptor** để bắt `code: "TOKEN_EXPIRED"`, tự động gọi `POST /api/auth/refresh`, rồi retry request ban đầu.

---

## Phụ lục: Test Accounts (Seed Data)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@smartcity.vn` | `admin123` |
| User | `nguyenvana@gmail.com` | `user123` |
| User | `tranthib@gmail.com` | `user123` |
