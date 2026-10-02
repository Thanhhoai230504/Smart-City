import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';

/// Dải cố định ngay dưới app bar khi mất mạng (design system mục 6.6).
///
/// **Không dùng toast/snackbar cho trạng thái mạng**: toast mất sau 3 giây,
/// trạng thái mạng kéo dài hàng phút. Offline queue là tính năng chữ ký của app
/// nên cần một vị trí cố định.
///
/// Widget thuần — phần nối với provider nằm ở shell để `core/` không phụ thuộc
/// `features/`.
class OfflineBanner extends StatelessWidget {
  const OfflineBanner({
    super.key,
    required this.online,
    required this.pendingCount,
    this.onTap,
    this.singleLine = false,
  });

  final bool online;
  final int pendingCount;
  final VoidCallback? onTap;

  /// Trong `AppBar.bottom` chiều cao cố định nên chữ phải gọn một dòng.
  final bool singleLine;

  static bool isVisible({required bool online, required int pendingCount}) =>
      !online || pendingCount > 0;

  @override
  Widget build(BuildContext context) {
    // Có mạng mà vẫn còn phiếu chờ (đang gửi hoặc bị lỗi) thì vẫn hiện, để
    // người dân biết phiếu chưa lên server.
    if (!isVisible(online: online, pendingCount: pendingCount)) return const SizedBox.shrink();

    final colors = context.palette.offline;
    final text = Theme.of(context).textTheme.bodySmall?.copyWith(
          color: colors.text,
          fontWeight: FontWeight.w600,
        );
    final message = online
        ? '${PendingBadge.describe(pendingCount)} — chạm để xem'
        : pendingCount == 0
            ? 'Đang ngoại tuyến — báo cáo sẽ được lưu và tự gửi'
            : 'Đang ngoại tuyến · ${PendingBadge.describe(pendingCount)}';

    return Material(
      color: colors.container,
      child: InkWell(
        onTap: onTap,
        child: Semantics(
          liveRegion: true,
          button: onTap != null,
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: singleLine ? 0 : 40),
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: Gap.lg, vertical: singleLine ? 0 : Gap.sm),
              child: Row(
                children: [
                  Icon(
                    online ? Icons.cloud_upload_outlined : Icons.cloud_off_outlined,
                    size: 18,
                    color: colors.text,
                  ),
                  Gap.w8,
                  Expanded(
                    child: Text(
                      message,
                      style: text,
                      maxLines: singleLine ? 1 : null,
                      overflow: singleLine ? TextOverflow.ellipsis : null,
                    ),
                  ),
                  if (onTap != null) Icon(Icons.chevron_right, size: 18, color: colors.text),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// [OfflineBanner] đặt **ngay dưới app bar** (design system 6.6) qua `AppBar.bottom`.
class OfflineBannerBar extends StatelessWidget implements PreferredSizeWidget {
  const OfflineBannerBar({
    super.key,
    required this.online,
    required this.pendingCount,
    required this.height,
    this.onTap,
  });

  final bool online;
  final int pendingCount;
  final double height;
  final VoidCallback? onTap;

  /// Chiều cao theo cỡ chữ hệ thống — chữ phóng to 1.6× vẫn không bị cắt.
  static double heightFor(BuildContext context) =>
      16 + MediaQuery.textScalerOf(context).scale(13) * 18 / 13 + 4;

  @override
  Size get preferredSize => Size.fromHeight(height);

  @override
  Widget build(BuildContext context) => SizedBox(
        height: height,
        child: OfflineBanner(
          online: online,
          pendingCount: pendingCount,
          onTap: onTap,
          singleLine: true,
        ),
      );
}

/// Số phiếu đang chờ gửi — gắn trên tab và trong [OfflineBanner].
class PendingBadge extends StatelessWidget {
  const PendingBadge({super.key, required this.count, required this.child});

  final int count;
  final Widget child;

  static String describe(int count) => '$count báo cáo đang chờ gửi';

  @override
  Widget build(BuildContext context) {
    if (count <= 0) return child;
    return Badge(
      label: Text('$count'),
      backgroundColor: context.palette.offline.text,
      textColor: context.palette.offline.container,
      child: child,
    );
  }
}
