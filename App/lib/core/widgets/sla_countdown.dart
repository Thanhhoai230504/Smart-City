import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/issue.dart';
import '../../data/repositories/meta_repository.dart';
import '../utils/formatters.dart';
import 'status_chips.dart';

/// Trạng thái hiển thị của đồng hồ SLA tại thời điểm [now].
class SlaDisplay {
  const SlaDisplay(this.status, this.label);

  final SlaStatus status;
  final String label;
}

/// Hàm thuần để test đủ 6 trạng thái (nghiệm thu 4.7).
///
/// **Không tự tính lại hạn ở client** (design system mục 8): mốc `dueAt` và
/// trạng thái gốc đều là của backend. Client chỉ làm đúng một việc — khi đồng
/// hồ chạy qua `dueAt` trong lúc màn hình đang mở thì đổi sang `overdue` ngay,
/// không chờ lần tải lại kế tiếp.
SlaDisplay computeSlaDisplay({
  required SlaStatus backendStatus,
  required IssueStatus issueStatus,
  required DateTime? dueAt,
  required DateTime now,
  required String Function(SlaStatus) labelOf,
}) {
  if (dueAt == null || backendStatus == SlaStatus.none) {
    return SlaDisplay(SlaStatus.none, labelOf(SlaStatus.none));
  }

  if (backendStatus == SlaStatus.met || backendStatus == SlaStatus.breached) {
    return SlaDisplay(backendStatus, labelOf(backendStatus));
  }

  final remaining = dueAt.difference(now);
  if (issueStatus.isOpen && remaining.isNegative) {
    return SlaDisplay(SlaStatus.overdue, 'Quá hạn ${Fmt.span(remaining)}');
  }
  if (backendStatus == SlaStatus.overdue) {
    return SlaDisplay(SlaStatus.overdue, 'Quá hạn ${Fmt.span(remaining)}');
  }
  return SlaDisplay(backendStatus, 'Còn ${Fmt.span(remaining)}');
}

/// Đếm ngược **sống** — tự cập nhật mỗi phút (design system mục 8).
class SlaCountdown extends ConsumerStatefulWidget {
  const SlaCountdown({super.key, required this.issue, this.dense = false, this.clock});

  final Issue issue;
  final bool dense;

  /// Test thay đồng hồ.
  final DateTime Function()? clock;

  @override
  ConsumerState<SlaCountdown> createState() => _SlaCountdownState();
}

class _SlaCountdownState extends ConsumerState<SlaCountdown> {
  Timer? _timer;

  DateTime _now() => (widget.clock ?? DateTime.now)();

  @override
  void initState() {
    super.initState();
    if (widget.issue.dueAt != null && widget.issue.status.isOpen) {
      _timer = Timer.periodic(const Duration(minutes: 1), (_) {
        if (mounted) setState(() {});
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final meta = ref.watch(metaProvider);
    final display = computeSlaDisplay(
      backendStatus: widget.issue.slaStatus,
      issueStatus: widget.issue.status,
      dueAt: widget.issue.dueAt,
      now: _now(),
      labelOf: (s) => meta.slaLabel(s.wire),
    );
    return SlaChip(display.status, dense: widget.dense, labelOverride: display.label);
  }
}
