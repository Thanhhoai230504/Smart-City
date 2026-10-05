import type { UserRole } from '../types';

/**
 * Đăng nhập xong thì quay lại đâu.
 *
 * Trước đây trang đăng nhập luôn `navigate('/')`: ProtectedRoute có truyền
 * `state.from` nhưng không ai đọc. Người dân bấm "Báo cáo sự cố" → bị chuyển
 * sang đăng nhập → đăng nhập xong lại rơi về trang chủ, phải tự tìm lại nút báo
 * cáo; cán bộ và quản trị viên cũng không vào thẳng bàn làm việc của mình.
 *
 * `from` đến từ location.state, từ query `?from=` (sống sót qua tải lại trang)
 * hoặc từ sessionStorage (sống sót qua vòng chuyển hướng Google OAuth). Query và
 * storage là dữ liệu người khác có thể soạn sẵn trong một đường link, nên CHỈ
 * nhận đường dẫn nội bộ — không nhận URL tuyệt đối, `//host` hay `/\host`
 * (trình duyệt hiểu là sang domain khác).
 */

/** Khoá sessionStorage giữ đích đến trong lúc đi vòng qua Google. */
export const POST_LOGIN_REDIRECT_KEY = 'smartcity.postLoginRedirect';

/** Quay lại các trang này sau khi đăng nhập là vô nghĩa (hoặc tạo vòng lặp). */
const AUTH_FLOW_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/auth/callback'];

/** Khu vực chỉ một vai trò vào được — vai trò khác vào sẽ bị ProtectedRoute đẩy về trang chủ. */
const ROLE_ONLY_AREAS: ReadonlyArray<{ prefix: string; role: UserRole }> = [
  { prefix: '/admin', role: 'admin' },
  { prefix: '/staff', role: 'staff' },
];

const MAX_PATH_LENGTH = 2048;

/** Trang mặc định theo vai trò khi không có (hoặc không dùng được) `from`. */
export const getRoleHomePath = (role?: UserRole | null): string => {
  if (role === 'admin') return '/admin';
  if (role === 'staff') return '/staff';
  return '/';
};

const pathnameOf = (path: string) => path.split(/[?#]/)[0].toLowerCase();

const isWithin = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

const hasControlCharacters = (value: string) => Array.from(value).some((character) => {
  const code = character.charCodeAt(0);
  return code < 32 || code === 127;
});

/** Chuẩn hoá `from`: chuỗi, hoặc object Location mà ProtectedRoute truyền qua state. */
export const toRedirectPath = (from: unknown): string | null => {
  if (typeof from === 'string') return from;
  if (from && typeof from === 'object') {
    const { pathname, search, hash } = from as { pathname?: unknown; search?: unknown; hash?: unknown };
    if (typeof pathname !== 'string') return null;
    return `${pathname}${typeof search === 'string' ? search : ''}${typeof hash === 'string' ? hash : ''}`;
  }
  return null;
};

/** Đường dẫn nội bộ an toàn để chuyển tới sau đăng nhập. */
export const isSafeRedirectPath = (path: unknown): path is string => {
  if (typeof path !== 'string' || path.length === 0 || path.length > MAX_PATH_LENGTH) return false;
  // Phải bắt đầu bằng đúng một '/': '//evil.com' là URL protocol-relative.
  if (!path.startsWith('/') || path.startsWith('//')) return false;
  // Trình duyệt coi '\' như '/' nên '/\evil.com' cũng thành '//evil.com'.
  if (path.includes('\\') || hasControlCharacters(path)) return false;
  const pathname = pathnameOf(path);
  return !AUTH_FLOW_PATHS.some((page) => isWithin(pathname, page));
};

/**
 * Đích đến sau đăng nhập: `from` nếu an toàn và vai trò được vào, nếu không thì
 * trang mặc định theo vai trò (admin → /admin, cán bộ → /staff, người dân → /).
 */
export const resolvePostLoginPath = (from: unknown, role?: UserRole | null): string => {
  const candidate = toRedirectPath(from);
  if (!isSafeRedirectPath(candidate)) return getRoleHomePath(role);

  const pathname = pathnameOf(candidate);
  // Trang chủ không phải "nơi đang định tới": cán bộ/quản trị bấm Đăng nhập từ
  // trang chủ thì nên vào thẳng bàn làm việc.
  if (pathname === '/') return getRoleHomePath(role);

  const deniedByRole = ROLE_ONLY_AREAS.some(({ prefix, role: required }) => (
    isWithin(pathname, prefix) && role !== required
  ));
  return deniedByRole ? getRoleHomePath(role) : candidate;
};

// ─── Giữ đích đến qua vòng chuyển hướng Google OAuth ───
// Đi Google là rời hẳn ứng dụng nên state của router mất; sessionStorage thì còn
// (cùng tab) và tự xoá khi đóng tab. Truy cập storage có thể ném lỗi ở chế độ
// riêng tư hoặc khi trình duyệt chặn lưu trữ — khi đó chỉ mất tính năng quay lại.

const sessionStore = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
};

/** Ghi nhớ `from` trước khi rời trang sang Google. Đích không an toàn thì xoá bản cũ. */
export const rememberPostLoginPath = (from: unknown): void => {
  const store = sessionStore();
  if (!store) return;
  const path = toRedirectPath(from);
  try {
    if (isSafeRedirectPath(path)) store.setItem(POST_LOGIN_REDIRECT_KEY, path);
    else store.removeItem(POST_LOGIN_REDIRECT_KEY);
  } catch {
    // Bị chặn lưu trữ: đăng nhập xong về trang mặc định theo vai trò.
  }
};

/** Đọc đích đã ghi nhớ (không xoá — StrictMode chạy effect hai lần, lần sau vẫn cần đọc được). */
export const readRememberedPostLoginPath = (): string | null => {
  try {
    const value = sessionStore()?.getItem(POST_LOGIN_REDIRECT_KEY) ?? null;
    return isSafeRedirectPath(value) ? value : null;
  } catch {
    return null;
  }
};

export const forgetRememberedPostLoginPath = (): void => {
  try {
    sessionStore()?.removeItem(POST_LOGIN_REDIRECT_KEY);
  } catch {
    // Không xoá được thì lần đăng nhập sau vẫn kiểm tra lại qua isSafeRedirectPath.
  }
};
