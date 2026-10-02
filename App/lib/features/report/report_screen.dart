import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/platform/connectivity.dart';
import '../../core/router/route_guard.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/widgets/wizard_stepper.dart';
import '../../data/models/issue.dart';
import '../../data/models/report_support.dart';
import 'report_controller.dart';
import 'steps/info_step.dart';
import 'steps/location_step.dart';
import 'steps/photo_step.dart';
import 'steps/review_step.dart';

/// Wizard báo cáo 4 bước — web làm màn này trong 1.060 dòng một file; mobile
/// không chịu được form dài (Phase 3).
class ReportScreen extends ConsumerStatefulWidget {
  const ReportScreen({super.key});

  @override
  ConsumerState<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends ConsumerState<ReportScreen> {
  _Result? _result;

  static const _titles = ['Ảnh hiện trường', 'Thông tin sự cố', 'Vị trí', 'Xác nhận & gửi'];

  Future<void> _submit() async {
    final outcome = await ref.read(reportControllerProvider.notifier).submit();
    if (!mounted) return;
    switch (outcome) {
      case SubmitSent(:final issue):
        setState(() => _result = _Result.sent(issue.id));
      case SubmitQueued(:final reason):
        setState(() => _result = _Result.queued(reason));
      case SubmitFailed():
        break; // lỗi hiện ngay trong bước (inline), không đóng wizard
    }
  }

  Future<void> _confirmDuplicate(DuplicateCandidate c) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Xác nhận cùng một sự cố?'),
        content: Text(
          '“${c.issue.title}” sẽ được ghi nhận thêm một người dân xác nhận. '
          'Bạn sẽ nhận thông báo khi sự cố này được cập nhật, và không cần gửi báo cáo mới.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Không phải')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Đúng, xác nhận')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    final confirmed = await ref.read(reportControllerProvider.notifier).confirmDuplicate(c.issue.id);
    if (confirmed && mounted) setState(() => _result = _Result.confirmed(c.issue.id));
  }

  Future<bool> _confirmLeave() async {
    final s = ref.read(reportControllerProvider);
    final dirty = s.photos.isNotEmpty || s.title.isNotEmpty || s.description.isNotEmpty;
    if (!dirty || _result != null) return true;
    final leave = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Huỷ báo cáo?'),
        content: const Text('Nội dung bạn đã nhập sẽ không được lưu.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Tiếp tục soạn')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Huỷ báo cáo')),
        ],
      ),
    );
    return leave ?? false;
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(reportControllerProvider);
    final controller = ref.read(reportControllerProvider.notifier);
    final online = ref.watch(isOnlineProvider);

    if (_result != null) return _ResultView(result: _result!);

    final isLast = state.step == ReportController.stepCount - 1;
    final body = switch (state.step) {
      0 => const PhotoStep(),
      1 => const InfoStep(),
      2 => const LocationStep(),
      _ => ReviewStep(onConfirmDuplicate: _confirmDuplicate),
    };

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop || state.submitting) return;
        if (state.step > 0) {
          controller.back();
          return;
        }
        if (await _confirmLeave() && context.mounted) context.pop();
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Báo cáo sự cố'),
          leading: IconButton(
            tooltip: 'Đóng',
            icon: const Icon(Icons.close),
            onPressed: state.submitting
                ? null
                : () async {
                    if (await _confirmLeave() && context.mounted) context.pop();
                  },
          ),
        ),
        body: WizardStepper(
          stepTitles: _titles,
          currentStep: state.step,
          body: KeyedSubtree(key: ValueKey(state.step), child: body),
          onBack: state.step > 0 ? controller.back : null,
          onNext: isLast ? _submit : controller.next,
          nextEnabled: controller.canLeaveStep(state.step),
          hint: controller.blockedHint(state.step),
          busy: state.submitting,
          nextLabel: isLast
              ? (online ? 'Gửi báo cáo' : 'Lưu và gửi khi có mạng')
              : state.step == 0 && state.photos.isEmpty
                  ? 'Tiếp tục không có ảnh'
                  : 'Tiếp theo',
          nextIcon: isLast ? (online ? Icons.send : Icons.save_alt) : Icons.arrow_forward,
        ),
      ),
    );
  }
}

class _Result {
  const _Result._(this.kind, {this.issueId, this.reason});

  factory _Result.sent(String id) => _Result._(_Kind.sent, issueId: id);
  factory _Result.queued(String reason) => _Result._(_Kind.queued, reason: reason);
  factory _Result.confirmed(String id) => _Result._(_Kind.confirmed, issueId: id);

  final _Kind kind;
  final String? issueId;
  final String? reason;
}

enum _Kind { sent, queued, confirmed }

class _ResultView extends StatelessWidget {
  const _ResultView({required this.result});

  final _Result result;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    final (IconData icon, ChipColors colors, String title, String body) = switch (result.kind) {
      _Kind.sent => (
          Icons.task_alt,
          palette.statusColors(IssueStatus.resolved),
          'Đã gửi báo cáo',
          'Cảm ơn bạn! Đơn vị phụ trách sẽ tiếp nhận và bạn sẽ nhận thông báo khi có cập nhật.',
        ),
      _Kind.queued => (
          Icons.cloud_upload_outlined,
          palette.offline,
          'Đã lưu báo cáo trên máy',
          // Không hứa chạy nền: app tự gửi khi đang mở mà có mạng trở lại, hoặc
          // khi người dân mở lại app (kế hoạch 1.4.5 — iOS không cho chạy nền tuỳ ý).
          '${result.reason ?? ''} Báo cáo sẽ tự gửi khi có mạng trở lại — lúc app đang mở '
              'hoặc khi bạn mở lại app.'.trim(),
        ),
      _Kind.confirmed => (
          Icons.how_to_vote,
          palette.statusColors(IssueStatus.resolved),
          'Đã xác nhận cùng sự cố',
          'Bạn sẽ nhận thông báo khi sự cố này được cập nhật.',
        ),
    };

    return Scaffold(
      appBar: AppBar(title: const Text('Báo cáo sự cố'), automaticallyImplyLeading: false),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(Gap.xxl),
          child: Column(
            children: [
              const Spacer(),
              Container(
                padding: const EdgeInsets.all(Gap.xl),
                decoration: BoxDecoration(color: colors.container, shape: BoxShape.circle),
                child: Icon(icon, size: 48, color: colors.text),
              ),
              Gap.h24,
              Text(title, style: textTheme.headlineSmall, textAlign: TextAlign.center),
              Gap.h12,
              Text(body, style: textTheme.bodyLarge, textAlign: TextAlign.center),
              const Spacer(),
              if (result.issueId != null)
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: () => context.pushReplacement(Routes.issue(result.issueId!)),
                    icon: const Icon(Icons.visibility_outlined),
                    label: const Text('Xem sự cố'),
                  ),
                ),
              if (result.kind == _Kind.queued)
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: () => context.pushReplacement(Routes.pendingReports),
                    icon: const Icon(Icons.schedule_send_outlined),
                    label: const Text('Xem báo cáo chờ gửi'),
                  ),
                ),
              Gap.h12,
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () => context.go(Routes.home),
                  child: const Text('Về trang chủ'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

