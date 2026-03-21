# 📁 Smart City Dashboard — Backend Project Structure

> **Framework:** Node.js + Express.js
> **Database:** MongoDB + Mongoose
> **Real-time:** Socket.io
> **Authentication:** JWT + bcrypt

---

## Cấu trúc thư mục

```
Backend/
├── server.js
├── package.json
├── .env
├── .env.example
├── .gitignore
├── API_DOCUMENTATION.md
├── PROJECT_STRUCTURE.md
│
└── src/
    ├── config/
    │   ├── db.js
    │   ├── cloudinary.js
    │   └── socket.js
    │
    ├── models/
    │   ├── User.js
    │   ├── Issue.js
    │   ├── Place.js
    │   └── EnvironmentData.js
    │
    ├── middleware/
    │   ├── auth.js
    │   ├── errorHandler.js
    │   ├── upload.js
    │   └── validate.js
    │
    ├── validators/
    │   ├── authValidator.js
    │   ├── issueValidator.js
    │   └── placeValidator.js
    │
    ├── controllers/
    │   ├── authController.js
    │   ├── issueController.js
    │   ├── placeController.js
    │   ├── environmentController.js
    │   ├── trafficController.js
    │   └── dashboardController.js
    │
    ├── routes/
    │   ├── auth.js
    │   ├── issues.js
    │   ├── places.js
    │   ├── environment.js
    │   ├── traffic.js
    │   └── dashboard.js
    │
    ├── jobs/
    │   └── environmentCron.js
    │
    ├── utils/
    │   ├── apiError.js
    │   └── cache.js
    │
    └── seeds/
        └── seed.js
```

---

## Chi tiết chức năng từng file

### Root Files

| File | Chức năng |
|------|-----------|
| `server.js` | Entry point của ứng dụng. Khởi tạo Express, HTTP server, Socket.io. Cấu hình middleware (helmet, CORS, rate-limit, cookie-parser, body-parser). Đăng ký tất cả routes. Kết nối MongoDB rồi khởi động server + cron job. |
| `package.json` | Quản lý dependencies và scripts (`dev`, `start`, `seed`). |
| `.env` | Biến môi trường: MongoDB URI, JWT secrets, API keys, Cloudinary config. **Không push lên Git.** |
| `.env.example` | Mẫu file `.env` để hướng dẫn cấu hình. |
| `.gitignore` | Danh sách file/thư mục bị Git bỏ qua (`node_modules/`, `.env`). |

---

### `src/config/` — Cấu hình hệ thống

| File | Chức năng |
|------|-----------|
| `db.js` | Kết nối MongoDB Atlas bằng Mongoose. Export hàm `connectDB()` được gọi trong `server.js`. |
| `cloudinary.js` | Cấu hình Cloudinary SDK (cloud_name, api_key, api_secret) để upload và quản lý ảnh sự cố. |
| `socket.js` | Khởi tạo Socket.io server, quản lý rooms (`admins`, `user_{id}`). Export `initSocket()` và `getIO()` để các controller có thể emit events. |

---

### `src/models/` — Mongoose Schema (Database)

| File | Collection | Chức năng |
|------|------------|-----------|
| `User.js` | `users` | Schema người dùng: `name`, `email` (unique), `password` (bcrypt hash), `role` (user/admin), `refreshToken`, `isActive`. Pre-save hook tự động hash password. Method `comparePassword()` để xác thực. |
| `Issue.js` | `issues` | Schema sự cố đô thị: `title`, `description`, `category` (6 loại), `location`, tọa độ GPS, `imageUrl`, `status` (reported → processing → resolved/rejected), liên kết `userId` và `adminId`. Indexes trên `status`, `category`, `userId`, `createdAt`. |
| `Place.js` | `places` | Schema địa điểm công cộng: `name`, `type` (hospital/school/bus_stop/park/police), `address`, tọa độ GPS, `phone`, `isActive`. |
| `EnvironmentData.js` | `environmentdatas` | Schema dữ liệu môi trường: `location`, `source`, `temperature`, `humidity`, `weatherCondition`, tọa độ GPS. Chỉ có `createdAt` (không có `updatedAt`). Dùng để lưu lịch sử vẽ biểu đồ. |

---

### `src/middleware/` — Middleware xử lý request

| File | Chức năng |
|------|-----------|
| `auth.js` | **3 middleware bảo vệ API:** |
| | • `authMiddleware` — Verify JWT Access Token từ header `Authorization: Bearer <token>`, attach `req.user`. Trả `401` nếu token hết hạn hoặc không hợp lệ. |
| | • `adminMiddleware` — Kiểm tra `req.user.role === 'admin'`, trả `403` nếu không phải admin. |
| | • `ownerMiddleware(model)` — Kiểm tra user chỉ truy cập resource của chính mình. Admin được bypass. |
| `errorHandler.js` | Global error handler. Bắt tất cả lỗi chưa xử lý (Mongoose ValidationError, DuplicateKey, CastError, JWT errors) và trả JSON response chuẩn với status code phù hợp. Trong mode `development` sẽ kèm stack trace. |
| `upload.js` | Cấu hình Multer với Cloudinary storage. Chỉ chấp nhận file ảnh (JPG, PNG, GIF, WEBP), giới hạn 5MB. Tự động resize (max 1200x1200) và nén chất lượng. |
| `validate.js` | Middleware chạy sau các validation chain của `express-validator`. Nếu có lỗi validation → trả `400` với danh sách `{ field, message }`. |

---

### `src/validators/` — Validation Rules

| File | Exports | Chức năng |
|------|---------|-----------|
| `authValidator.js` | `registerValidator`, `loginValidator` | Kiểm tra input đăng ký (name, email hợp lệ, password ≥ 6 ký tự) và đăng nhập (email, password không rỗng). |
| `issueValidator.js` | `createIssueValidator`, `updateIssueStatusValidator` | Kiểm tra input tạo sự cố (title, description, category enum, location, tọa độ GPS hợp lệ) và cập nhật trạng thái (status enum). |
| `placeValidator.js` | `createPlaceValidator` | Kiểm tra input tạo địa điểm (name, type enum, tọa độ GPS hợp lệ). |

---

### `src/controllers/` — Business Logic

| File | Hàm | Chức năng |
|------|-----|-----------|
| `authController.js` | `register` | Kiểm tra email unique → hash password → tạo user mới. |
| | `login` | Xác thực email/password → sinh Access Token (15 phút) + Refresh Token (7 ngày) → set HttpOnly cookie. |
| | `refresh` | Đọc Refresh Token từ cookie → verify → sinh Access Token mới. |
| | `logout` | Xóa Refresh Token khỏi DB + xóa cookie. |
| | `getProfile` | Trả thông tin user hiện tại từ `req.user`. |
| `issueController.js` | `getIssues` | Lấy danh sách sự cố, hỗ trợ filter (`status`, `category`), phân trang (`page`, `limit`), populate thông tin user/admin. |
| | `getIssueById` | Xem chi tiết 1 sự cố theo ID. |
| | `createIssue` | Tạo sự cố mới, attach `userId` từ JWT. Upload ảnh lên Cloudinary. Emit `issue:created` via Socket.io tới admin. **Có rollback Cloudinary** nếu lưu DB thất bại. |
| | `updateIssueStatus` | Admin cập nhật trạng thái. Ghi `adminId`, `resolvedAt` (nếu resolved). Emit `issue:updated` / `issue:resolved` via Socket.io tới user báo cáo. |
| | `deleteIssue` | Admin xóa sự cố. |
| | `getMyIssues` | User xem danh sách sự cố của bản thân, có phân trang. |
| `placeController.js` | `getPlaces` | Lấy danh sách địa điểm, filter theo `type` và `isActive`. |
| | `getPlaceById` | Xem chi tiết 1 địa điểm. |
| | `createPlace` | Admin tạo địa điểm mới. |
| | `updatePlace` | Admin cập nhật địa điểm. |
| | `deletePlace` | Admin xóa địa điểm. |
| `environmentController.js` | `getEnvironmentData` | Proxy OpenWeatherMap API cho 5 quận Đà Nẵng. Cache 30 phút. Lưu kết quả vào DB. Fallback mock data nếu chưa có API key. |
| | `getEnvironmentHistory` | Truy vấn lịch sử nhiệt độ/độ ẩm từ DB, filter theo `location` và `hours`. |
| `trafficController.js` | `getTrafficData` | Proxy TomTom Traffic API. **Cache 5 phút** (tiết kiệm quota 2.500 req/ngày). Phân loại tốc độ → màu sắc (xanh/vàng/cam/đỏ). Fallback mock data 8 tuyến đường Đà Nẵng. |
| `dashboardController.js` | `getStats` | Aggregate thống kê: tổng sự cố (hôm nay/tuần/tháng), phân bố theo trạng thái (pie chart), theo loại (bar chart), xu hướng 30 ngày (line chart), 5 sự cố mới nhất, tổng users/places. |

---

### `src/routes/` — Định tuyến API

| File | Prefix | Endpoints | Chức năng |
|------|--------|-----------|-----------|
| `auth.js` | `/api/auth` | `POST /register`, `POST /login`, `POST /refresh`, `POST /logout`, `GET /profile` | Định tuyến xác thực, áp dụng validator + authMiddleware. |
| `issues.js` | `/api/issues` | `GET /`, `POST /`, `GET /my`, `GET /:id`, `PATCH /:id/status`, `DELETE /:id` | Định tuyến sự cố, áp dụng auth/admin middleware, upload, validator. Lưu ý: `/my` đặt trước `/:id` để tránh conflict. |
| `places.js` | `/api/places` | `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id` | Định tuyến địa điểm, GET public, POST/PUT/DELETE chỉ admin. |
| `environment.js` | `/api/environment` | `GET /`, `GET /history` | Định tuyến dữ liệu môi trường (public). |
| `traffic.js` | `/api/traffic` | `GET /` | Định tuyến dữ liệu giao thông (public). |
| `dashboard.js` | `/api/dashboard` | `GET /stats` | Định tuyến thống kê (chỉ admin). |

---

### `src/jobs/` — Scheduled Jobs

| File | Chức năng |
|------|-----------|
| `environmentCron.js` | Cron job chạy mỗi **30 phút** (dùng `node-cron`). Tự động gọi OpenWeatherMap API cho 5 quận Đà Nẵng và lưu dữ liệu vào collection `environmentdatas`. Đảm bảo biểu đồ lịch sử có dữ liệu liên tục ngay cả khi không có request từ client. Chạy fetch ngay lần đầu khi server khởi động. Bỏ qua nếu chưa cấu hình API key. |

---

### `src/utils/` — Tiện ích dùng chung

| File | Chức năng |
|------|-----------|
| `apiError.js` | Custom error class `ApiError` extends `Error`. Có factory methods: `badRequest(400)`, `unauthorized(401)`, `forbidden(403)`, `notFound(404)`, `internal(500)`. Dùng với `throw ApiError.notFound('...')` trong controller. |
| `cache.js` | In-memory cache (singleton `Map`) với TTL. Method `get(key)` tự xóa nếu hết hạn, `set(key, value, ttlMs)` mặc định 5 phút. Dùng cho cache traffic (5 phút) và environment (30 phút). |

---

### `src/seeds/` — Dữ liệu mẫu

| File | Chức năng |
|------|-----------|
| `seed.js` | Script khởi tạo dữ liệu mẫu thực tế ở **Đà Nẵng**. Xóa dữ liệu cũ → tạo mới: **3 users** (1 admin + 2 user), **11 places** (bệnh viện, trường ĐH, trạm xe buýt, công viên, đồn CA), **7 issues** (đủ 4 trạng thái + 6 loại), **3 environment records**. Chạy bằng `npm run seed`. |

---

## Scripts

```bash
npm run dev     # Chạy development server (nodemon auto-reload)
npm start       # Chạy production server
npm run seed    # Tạo dữ liệu mẫu (xóa dữ liệu cũ trước)
```
