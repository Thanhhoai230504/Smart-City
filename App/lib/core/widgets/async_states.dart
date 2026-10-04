import 'package:flutter/material.dart';

import '../network/app_exception.dart';
import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';

/// Năm trạng thái bắt buộc của mọi màn dữ liệu (design system mục 6.5):
/// loading (skeleton, không spinner tròn cho danh sách) · empty (có hành động
/// dẫn dắt) · error (có nút Thử lại) · offline · success.

class SkeletonBox extends StatefulWidget {
  const SkeletonBox({super.key, this.height = 16, this.width, this.radius = 8});

  final double height;
  final double? width;
  final double radius;

  @override
  State<SkeletonBox> createState() => _SkeletonBoxState();
}

class _SkeletonBoxState extends State<SkeletonBox> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.maybeDisableAnimationsOf(context) == true) {
      _c.stop();
    } else if (!_c.isAnimating) {
      _c.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final base = context.palette.border;
    return FadeTransition(
      opacity: Tween(begin: 0.45, end: 1.0).animate(_c),
      child: Container(
        height: widget.height,
        width: widget.width,
        decoration: BoxDecoration(
          color: base.withValues(alpha: 0.6),
          borderRadius: BorderRadius.circular(widget.radius),
        ),
      ),
    );
  }
}

/// Skeleton cho danh sách card.
class SkeletonList extends StatelessWidget {
  const SkeletonList({super.key, this.count = 5, this.itemHeight = 96});

  final int count;
  final double itemHeight;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Đang tải',
      child: ListView.separated(
        padding: const EdgeInsets.all(Gap.screen),
        physics: const NeverScrollableScrollPhysics(),
        // Co theo nội dung để đặt được cả trong một danh sách khác.
        shrinkWrap: true,
        itemCount: count,
        separatorBuilder: (_, _) => Gap.h12,
        itemBuilder: (_, _) => Card(
          child: Padding(
            padding: const EdgeInsets.all(Gap.card),
            child: Row(
              children: [
                SkeletonBox(height: itemHeight - 32, width: itemHeight - 32, radius: Radii.image),
                Gap.w12,
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SkeletonBox(height: 16),
                      SizedBox(height: 8),
                      SkeletonBox(height: 12, width: 160),
                      SizedBox(height: 8),
                      SkeletonBox(height: 12, width: 100),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Khung chung cho empty/error/offline: icon + tiêu đề + mô tả + hành động.
class StateMessage extends StatelessWidget {
  const StateMessage({
    super.key,
    required this.icon,
    required this.title,
    this.message,
    this.actionLabel,
    this.onAction,
    this.actionIcon,
  });

  final IconData icon;
  final String title;
  final String? message;
  final String? actionLabel;
  final VoidCallback? onAction;
  final IconData? actionIcon;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(Gap.xxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 48, color: palette.textSecondary),
            Gap.h12,
            Text(title, style: textTheme.titleMedium, textAlign: TextAlign.center),
            if (message != null) ...[
              Gap.h8,
              Text(
                message!,
                style: textTheme.bodyMedium?.copyWith(color: palette.textSecondary),
                textAlign: TextAlign.center,
              ),
            ],
            if (actionLabel != null && onAction != null) ...[
              Gap.h16,
              FilledButton.icon(
                onPressed: onAction,
                icon: Icon(actionIcon ?? Icons.arrow_forward),
                label: Text(actionLabel!),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.title,
    this.message,
    this.actionLabel,
    this.onAction,
    this.icon = Icons.inbox_outlined,
  });

  final String title;
  final String? message;
  final String? actionLabel;
  final VoidCallback? onAction;
  final IconData icon;

  @override
  Widget build(BuildContext context) => StateMessage(
        icon: icon,
        title: title,
        message: message,
        actionLabel: actionLabel,
        onAction: onAction,
      );
}

/// Lỗi có nút Thử lại; lỗi mạng hiện như trạng thái offline.
class ErrorState extends StatelessWidget {
  const ErrorState({super.key, required this.error, required this.onRetry});

  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final e = AppException.from(error);
    final offline = e.kind == AppErrorKind.network;
    return StateMessage(
      icon: offline ? Icons.cloud_off_outlined : Icons.error_outline,
      title: offline ? 'Đang ngoại tuyến' : 'Không tải được dữ liệu',
      message: offline ? 'Kiểm tra kết nối mạng rồi thử lại.' : e.message,
      actionLabel: 'Thử lại',
      actionIcon: Icons.refresh,
      onAction: onRetry,
    );
  }
}

/// Thông báo ngắn sau một hành động (không dùng cho trạng thái mạng).
void showAppSnack(BuildContext context, String message, {bool error = false}) {
  final messenger = ScaffoldMessenger.maybeOf(context);
  if (messenger == null) return;
  final palette = context.palette;
  messenger
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: error ? palette.error : null,
        showCloseIcon: true,
      ),
    );
}
