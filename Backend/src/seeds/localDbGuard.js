/**
 * Rào chắn chung cho các script seed XOÁ dữ liệu: chỉ chạy trên MongoDB của chính
 * máy này. Script phải đọc một biến môi trường RIÊNG, không bao giờ đọc
 * MONGODB_URI — biến đó trỏ database thật (Atlas) của hệ thống đang chạy.
 *
 * Từ chối mọi URI không phải mongodb://<localhost>/<tênDb> (kể cả mongodb+srv).
 */
const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '::1', '[::1]'];

const assertLocalMongoUri = (uri, { envName, example }) => {
  if (typeof uri !== 'string' || !uri) {
    throw new Error(`Thiếu ${envName} (ví dụ ${example})`);
  }
  // Host IPv6 dạng [::1] chứa dấu ':' nên bắt riêng trước, rồi mới tới host thường.
  const match = /^mongodb:\/\/(?:[^@/]+@)?(\[[^\]]+\]|[^/:?,]+)(?::\d+)?\/([^/?]+)/.exec(uri);
  if (!match) throw new Error(`${envName} phải có dạng mongodb://host:port/tenDb (không nhận mongodb+srv)`);
  const [, host, db] = match;
  if (!LOCAL_HOSTS.includes(host)) {
    throw new Error(`Từ chối seed vào host "${host}" — script này xoá sạch database, chỉ chạy trên máy cục bộ`);
  }
  return { host, db };
};

module.exports = { assertLocalMongoUri, LOCAL_HOSTS };
