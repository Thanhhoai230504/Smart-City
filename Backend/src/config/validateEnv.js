/**
 * Kiểm tra biến môi trường NGAY LÚC KHỞI ĐỘNG.
 *
 * Trước đây sau `dotenv.config()` không có bước kiểm tra nào. Thiếu `JWT_SECRET`
 * thì `jwt.sign(payload, undefined)` chỉ nổ lúc có người đăng nhập — tức là sau
 * khi deploy đã "thành công" và health check đã xanh. `emailService` còn tệ hơn:
 * nó khởi tạo transporter với `process.env.SMTP_EMAIL` kể cả khi undefined, nên
 * lỗi chỉ lộ ra khi email đầu tiên thất bại trong im lặng.
 *
 * Nguyên tắc: hỏng thì hỏng NGAY và nói rõ thiếu gì, thay vì chạy nửa vời.
 */

/** Không có thì hệ thống không thể hoạt động đúng — dừng hẳn. */
const REQUIRED = [
  ['MONGODB_URI', 'chuỗi kết nối MongoDB'],
  ['JWT_SECRET', 'khoá ký access token'],
  ['JWT_REFRESH_SECRET', 'khoá ký refresh token'],
];

/**
 * Thiếu thì một tính năng ngừng hoạt động nhưng phần còn lại vẫn chạy — chỉ cảnh
 * báo. Dừng server vì chưa có khoá Gemini là phản ứng thái quá.
 */
const OPTIONAL = [
  ['CLIENT_URL', 'URL frontend — dùng cho CORS và link trong email'],
  ['CLOUDINARY_CLOUD_NAME', 'upload ảnh sự cố'],
  ['CLOUDINARY_API_KEY', 'upload ảnh sự cố'],
  ['CLOUDINARY_API_SECRET', 'upload ảnh sự cố'],
  ['SMTP_EMAIL', 'gửi email thông báo và xác thực'],
  ['SMTP_PASSWORD', 'gửi email thông báo và xác thực'],
  ['GEMINI_API_KEY', 'phân loại ảnh bằng AI, chatbot, phát hiện trùng'],
  ['GOONG_API_KEY', 'tra cứu địa chỉ và toạ độ'],
  ['TOMTOM_API_KEY', 'lớp giao thông và chỉ đường'],
  ['OPENWEATHER_API_KEY', 'dữ liệu môi trường'],
];

/**
 * Hai khoá JWT phải KHÁC nhau. Dùng chung một khoá nghĩa là access token và
 * refresh token ký bằng cùng chữ ký — một access token hết hạn có thể được đem
 * đi đổi như refresh token, phá toàn bộ mô hình thời hạn ngắn.
 */
const checkJwtSecrets = (env) => {
  const problems = [];
  if (env.JWT_SECRET && env.JWT_REFRESH_SECRET && env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    problems.push('JWT_SECRET và JWT_REFRESH_SECRET phải khác nhau');
  }
  for (const name of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    const value = env[name];
    if (value && value.length < 32) {
      problems.push(`${name} quá ngắn (${value.length} ký tự) — nên dùng ít nhất 32 ký tự ngẫu nhiên`);
    }
  }
  return problems;
};

/**
 * Ở production, một vài giá trị mặc định dành cho máy phát triển là dấu hiệu
 * deploy thiếu cấu hình chứ không phải lựa chọn có chủ đích.
 */
const checkProductionDefaults = (env) => {
  if (env.NODE_ENV !== 'production') return [];
  const problems = [];
  if (!env.CLIENT_URL || env.CLIENT_URL.includes('localhost')) {
    problems.push('CLIENT_URL vẫn trỏ về localhost — CORS sẽ chặn chính frontend của bạn');
  }
  return problems;
};

/**
 * @param {object} env - thường là process.env; truyền vào để test được
 * @returns {{ errors: string[], warnings: string[] }}
 */
const inspectEnv = (env = process.env) => {
  const errors = [];
  const warnings = [];

  for (const [name, purpose] of REQUIRED) {
    if (!env[name]) errors.push(`Thiếu ${name} (${purpose})`);
  }
  errors.push(...checkJwtSecrets(env));
  errors.push(...checkProductionDefaults(env));

  for (const [name, purpose] of OPTIONAL) {
    if (!env[name]) warnings.push(`Thiếu ${name} — tính năng "${purpose}" sẽ không hoạt động`);
  }

  return { errors, warnings };
};

/**
 * Gọi ngay sau dotenv.config(). Có lỗi thì in ra rồi thoát với mã 1 — tốt hơn là
 * chạy nửa vời rồi hỏng lúc có người dùng thật.
 */
const validateEnv = (env = process.env) => {
  const { errors, warnings } = inspectEnv(env);

  for (const w of warnings) console.warn(`⚠️  ${w}`);

  if (errors.length) {
    console.error('❌ Cấu hình môi trường không hợp lệ:');
    for (const e of errors) console.error(`   - ${e}`);
    console.error('   Xem Backend/.env.example để biết danh sách biến cần thiết.');
    process.exit(1);
  }

  return { errors, warnings };
};

module.exports = { validateEnv, inspectEnv, REQUIRED, OPTIONAL };
