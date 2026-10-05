# Smart City Đà Nẵng — App di động (Flutter)

App cho **người dân** (báo cáo sự cố, theo dõi, đánh giá, mở lại) và **cán bộ hiện trường**
(nhận việc, gọi người báo cáo, hoàn tất kèm ảnh minh chứng). Quản trị viên dùng website —
xem `KE-HOACH-FLUTTER-APP.md` mục 1.3.

Flutter **3.41.4** / Dart **3.11.1** (ghim trong `pubspec.yaml` và CI).

## Chạy

```bash
flutter pub get
flutter run --dart-define-from-file=config/dev.json
```

`API_URL` mặc định theo nền tảng (cạm bẫy Phase 0.0 của kế hoạch):

| Chạy trên | API_URL mặc định |
|---|---|
| Android emulator | `http://10.0.2.2:5000/api` — `localhost` trỏ vào chính emulator |
| iOS simulator, web | `http://localhost:5000/api` |
| Thiết bị thật | phải truyền: `--dart-define=API_URL=http://<IP-LAN>:5000/api` |
| Production | tạo `config/prod.json` từ `config/prod.example.json` (file này bị gitignore) |

HTTP thường chỉ được bật cho bản **debug** (`android/app/src/debug/AndroidManifest.xml`).

Biến tuỳ chọn: `MAP_TILE_URL`, `MAP_ATTRIBUTION` (mặc định dùng cùng nguồn tile với web —
không phải API chính thức của Google, xem `lib/core/config/app_config.dart`).

### Dữ liệu demo cục bộ (không đụng Atlas)

```bash
cd ../Backend
APP_DEMO_MONGODB_URI=mongodb://127.0.0.1:27017/smartcity_app_demo npm run seed:app-demo
```

Script **xoá sạch DB đích** nên từ chối mọi URI không phải localhost. Danh sách tài khoản demo
và mật khẩu nằm ở đầu `Backend/src/seeds/seedAppDemo.js`. Chạy backend với
`MONGODB_URI` trỏ vào DB đó.

## Kiểm thử

```bash
flutter analyze        # 0 issue
flutter test           # unit + widget
```

| Nhóm | Bảo đảm gì (tiêu chí nghiệm thu của kế hoạch) |
|---|---|
| `test/core/network/refresh_interceptor_test.dart` | 3 request 401 đồng thời → **đúng 1** lần refresh (0.4); refresh lúc mở app chạy song song interceptor vẫn 1 lần; mất mạng lúc refresh **không** đăng xuất |
| `test/data/models_test.dart` | parse bằng **JSON thật từ API** (`test/fixtures/api/`, chụp bằng `tool/capture_fixtures.js`) — union type id/object, khách không có `phone` (0.6) |
| `test/data/meta_test.dart` | bản dự phòng đóng gói khớp API thật; cold start không mạng vẫn có nhãn (0.7) |
| `test/core/theme/contrast_test.dart` | **0 cặp chữ dưới 4.5:1** ở cả hai theme, đọc thẳng `app_colors.dart` (0.5) |
| `test/widgets/layout_test.dart` | 11 màn chính × sáng/tối × **chữ 1.6×** trên màn 360dp — không tràn layout (0.5) |
| `test/features/offline_queue_test.dart` | gửi tuần tự; 429 dừng và hẹn lại; 400 không chặn cả hàng (3.6) |
| `test/features/staff_and_rules_test.dart` | ảnh minh chứng **trước**, trạng thái **sau**; lỗi bước 2 không upload lại (4.5); 4 mã chặn mở lại + biên ngày 30 (3.8); SLA đủ 6 trạng thái (4.7) |
| `test/core/debounce_test.dart` | gõ nhanh 10 ký tự → 1 request (3.5); kéo bản đồ 10 lần → ≤ 2 request (2.5) |
| `test/core/router/route_guard_test.dart` | người dân vào cổng cán bộ → về home (1.7) |

`test/flutter_test_config.dart` nạp font Roboto thật từ Flutter SDK — font mặc định của
`flutter_test` rộng gấp ~2 lần nên test bố cục sẽ báo tràn sai.

## Cấu trúc

```
lib/
├── core/        config · network (Dio + 3 interceptor) · theme · router · widgets · utils
├── data/        models (fromJson phòng thủ) · repositories · local (Hive) · socket
└── features/    auth · home · issues · report (wizard + hàng đợi offline) · map
                 · staff · notifications · profile · public_info · settings · update
```

## Khác với kế hoạch — có lý do

| Kế hoạch | Thực tế | Vì sao |
|---|---|---|
| Model `freezed` + `build_runner` | `fromJson` viết tay qua `core/utils/json.dart` | Field union (id/object) vẫn phải viết converter riêng; bỏ bước sinh mã giúp CI và người đọc đơn giản hơn. Độ an toàn kiểu do test parse bằng fixture thật bảo đảm |
| `drift` cho hàng đợi | `hive_ce` | Hàng đợi là khoá–giá trị; Hive chạy cả Android, iOS và web (bản xem thử) không cần SQLite native |
| Golden test | Layout test (không tràn ở 1.6×, hai theme) | Ảnh golden render khác nhau giữa Windows và CI Linux; thứ cần bảo đảm là "không vỡ layout" |
| `workmanager` chạy nền | Chưa dùng | Kế hoạch 1.4.5: không được phụ thuộc chạy nền. App thử gửi lại khi mở lại và khi mạng đổi — chạy đúng trên cả hai nền tảng |
| `permission_handler` | Dùng API quyền của `geolocator` + `image_picker` | Đủ ba nhánh quyền vị trí mà bớt một plugin |

## Phát hành Android

**Icon + màn chờ** (task 7.1) đã sinh sẵn trong `android/` và `ios/` từ logo web — nguồn ở
`assets/branding/`, cách tạo lại ghi trong `flutter_launcher_icons.yaml`,
`flutter_native_splash.yaml` và `tool/make_branding.dart`.

**Khoá ký phát hành** (task 7.2) — tự tạo MỘT lần, cất ngoài repo, sao lưu cả file lẫn mật
khẩu (mất khoá là không phát hành bản cập nhật cho app đã cài được nữa):

```bash
keytool -genkey -v -keystore D:/keystore/smartcity-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

Rồi tạo `android/key.properties` (đã `.gitignore`):

```properties
storeFile=D:/keystore/smartcity-upload.jks
storePassword=<mật khẩu kho>
keyAlias=upload
keyPassword=<mật khẩu khoá>
```

Chưa có `key.properties` thì bản release tạm ký bằng debug key (chỉ để thử). Có khoá rồi:
lấy SHA-1 bằng `keytool -list -v -keystore D:/keystore/smartcity-upload.jks -alias upload`
và **thêm SHA-1 đó vào OAuth client Android** trên Google Cloud (project chứa
`GOOGLE_CLIENT_ID`) — thiếu bước này đăng nhập Google trên bản release sẽ lỗi. Đổi khoá ký là
đổi chữ ký app: cài lên máy đang có bản debug phải gỡ bản cũ trước (mất phiên đăng nhập).

**Build bản release** (task 7.3) — biên dịch AOT, nhỏ và mượt hơn hẳn bản debug:

```bash
flutter build apk --release --split-per-abi --dart-define=API_URL=https://smart-city-tgsf.onrender.com/api --dart-define=APP_ENV=prod
```

Ra một APK cho mỗi kiến trúc trong `build/app/outputs/flutter-apk/`: điện thoại thật dùng
`app-arm64-v8a-release.apk`, máy ảo x86_64 dùng `app-x86_64-release.apk`. Lên Play thì dùng
`flutter build appbundle` thay cho `apk --split-per-abi`.

## Chưa làm — chặn bởi việc ngoài code

- **B2 / Phase 5.1–5.3, 5.5, 4.8 — push FCM**: cần Firebase project + service account. Hiện
  thông báo đến qua Socket.IO khi app đang mở (5.4) và trung tâm thông báo (5.6).
- **Phase 7 còn lại** — tạo khoá ký thật (lệnh ở trên), hồ sơ store, tài khoản Apple Developer, build iOS.
- **Deep link xác thực email** — theo phương án (a) của kế hoạch: link mở trên web, app có
  màn "chưa xác thực" + gửi lại.

## Hạn chế nên nêu khi bảo vệ

- Hàng đợi offline: nếu server đã tạo phiếu nhưng phản hồi bị mất (timeout), lần gửi lại sẽ
  tạo phiếu trùng — backend chưa có khoá idempotency. Cơ chế dò trùng + gộp của admin xử lý
  được về sau.
- Khu vực vẫn là 8 quận/huyện cũ (kế hoạch mục 5.1) — app đọc từ `/api/meta/enums` nên đổi
  mô hình ở backend không cần phát hành lại app.
- Bản web chỉ để xem thử giao diện trên máy phát triển, không phải sản phẩm.
