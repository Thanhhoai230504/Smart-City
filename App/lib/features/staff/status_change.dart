import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/app_exception.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/widgets/async_states.dart';
import '../../data/models/issue.dart';
import '../../data/models/meta.dart';
import '../../data/repositories/meta_repository.dart';
import 'resolve_screen.dart';

/// Đổi trạng thái phiếu — dùng chung cho màn xử lý và thẻ trong danh sách việc,
/// để hai nơi cùng nhãn, cùng luật và cùng cách báo lỗi.

/// Trạng thái được chuyển tới từ trạng thái hiện tại — bảng luật của backend
/// lấy qua `/meta/enums`, không tự suy ở client.
List<IssueStatus> statusTargets(Issue issue, MetaEnums meta) => [
      for (final t in meta.targetsFrom(issue.status.name)) IssueStatus.parse(t),
    ].where((t) => t != IssueStatus.unknown).toList();

String statusTargetLabel(IssueStatus target, Issue issue, MetaEnums meta) => switch (target) {
      IssueStatus.processing when issue.status.isClosed => 'Mở lại để xử lý tiếp',
      IssueStatus.processing => 'Bắt đầu xử lý',
      IssueStatus.resolved => 'Hoàn tất (chụp ảnh minh chứng)',
      IssueStatus.rejected => 'Từ chối (cần nêu lý do)',
      _ => meta.statusLabel(target.name),
    };

IconData statusTargetIcon(IssueStatus target) => switch (target) {
      IssueStatus.processing => Icons.engineering,
      IssueStatus.resolved => Icons.task_alt,
      IssueStatus.rejected => Icons.block,
      _ => Icons.sync,
    };

/// Cặp nút "Cập nhật" + "Hoàn tất" đứng cạnh nhau: chữ phóng lớn hơn 1.3× thì
/// bỏ icon (nhãn đã đủ nghĩa) để nhãn không bị bẻ thành hai dòng.
bool pairButtonsWithoutIcons(BuildContext context) => MediaQuery.textScalerOf(context).scale(10) > 13;

String explainStaffError(AppException e) => switch (e.code) {
      'INVALID_STATUS_TRANSITION' => 'Phiếu đã được cập nhật ở nơi khác. Đã tải lại trạng thái mới nhất.',
      'NO_RESOLUTION_IMAGE' => 'Cần ảnh minh chứng trước khi báo đã xử lý.',
      'REJECT_REASON_REQUIRED' => 'Vui lòng nêu rõ lý do từ chối.',
      'MERGED_ISSUE' => 'Phiếu đã được gộp vào sự cố khác — hãy cập nhật sự cố gốc.',
      _ => e.message,
    };

/// Màn chụp ảnh minh chứng rồi báo "Đã xử lý" (backend bắt buộc có ảnh).
/// Mở trên navigator gốc để che cả thanh điều hướng. `true` khi đã báo xong.
Future<bool> openResolveFlow(BuildContext context, Issue issue) async {
  final done = await Navigator.of(context, rootNavigator: true).push<bool>(
    MaterialPageRoute(builder: (_) => ResolveScreen(issue: issue), fullscreenDialog: true),
  );
  if (done != true) return false;
  if (context.mounted) showAppSnack(context, 'Đã báo hoàn tất. Người dân sẽ được mời đánh giá.');
  return true;
}

/// Hỏi ghi chú (hoặc lý do từ chối) trước khi đổi trạng thái; `null` = huỷ.
Future<String?> askStatusNote(BuildContext context, IssueStatus target) => showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      builder: (_) => StatusNoteSheet(target: target),
    );

/// Sheet chọn trạng thái mới cho một phiếu; `null` = huỷ.
Future<IssueStatus?> pickStatusTarget(BuildContext context, Issue issue, MetaEnums meta) =>
    showModalBottomSheet<IssueStatus>(
      context: context,
      useRootNavigator: true,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(Gap.screen, 0, Gap.screen, Gap.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Cập nhật trạng thái', style: Theme.of(ctx).textTheme.titleLarge),
              Gap.h4,
              Text(
                issue.title,
                style: Theme.of(ctx).textTheme.bodySmall,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              Gap.h16,
              for (final t in statusTargets(issue, meta)) ...[
                StatusTargetButton(
                  target: t,
                  label: statusTargetLabel(t, issue, meta),
                  onPressed: () => Navigator.pop(ctx, t),
                ),
                Gap.h8,
              ],
            ],
          ),
        ),
      ),
    );

/// Nút cho một trạng thái đích — "Hoàn tất" là nút chính, còn lại viền.
class StatusTargetButton extends StatelessWidget {
  const StatusTargetButton({super.key, required this.target, required this.label, required this.onPressed});

  final IssueStatus target;
  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final icon = Icon(statusTargetIcon(target));
    return target == IssueStatus.resolved
        ? FilledButton.icon(onPressed: onPressed, icon: icon, label: Text(label))
        : OutlinedButton.icon(onPressed: onPressed, icon: icon, label: Text(label));
  }
}

/// Ghi chú khi đổi trạng thái. **Từ chối bắt buộc có lý do** — chặn ngay ở client
/// thay vì để người dùng bấm rồi mới nhận `REJECT_REASON_REQUIRED` (task 4.6).
class StatusNoteSheet extends ConsumerStatefulWidget {
  const StatusNoteSheet({super.key, required this.target});

  final IssueStatus target;

  @override
  ConsumerState<StatusNoteSheet> createState() => _StatusNoteSheetState();
}

class _StatusNoteSheetState extends ConsumerState<StatusNoteSheet> {
  final _note = TextEditingController();

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final meta = ref.watch(metaProvider);
    final rejecting = widget.target == IssueStatus.rejected;
    final canSubmit = !rejecting || _note.text.trim().isNotEmpty;
    return Padding(
      padding: EdgeInsets.fromLTRB(Gap.screen, 0, Gap.screen, MediaQuery.viewInsetsOf(context).bottom + Gap.lg),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Chuyển sang “${meta.statusLabel(widget.target.name)}”',
              style: Theme.of(context).textTheme.titleLarge),
          Gap.h12,
          TextField(
            controller: _note,
            autofocus: rejecting,
            minLines: 3,
            maxLines: 6,
            maxLength: meta.limits.maxNoteLength,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              labelText: rejecting ? 'Lý do từ chối *' : 'Ghi chú (không bắt buộc)',
              helperText: rejecting ? 'Người dân sẽ đọc lý do này — hãy nêu rõ vì sao.' : null,
              alignLabelWithHint: true,
            ),
          ),
          Gap.h8,
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: canSubmit ? () => Navigator.pop(context, _note.text.trim()) : null,
              child: const Text('Xác nhận'),
            ),
          ),
        ],
      ),
    );
  }
}
