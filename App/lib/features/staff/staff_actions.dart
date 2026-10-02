import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/issue.dart';
import '../../data/repositories/issue_repository.dart';
import '../issues/issue_detail_controller.dart';
import 'work_list_screen.dart';

/// Hành động của cán bộ trên một phiếu. Mỗi lần thành công thì tải lại chi
/// tiết và đánh dấu danh sách việc cần làm mới.
class StaffActions {
  StaffActions(this._ref, this.issueId);

  final Ref _ref;
  final String issueId;

  IssueRepository get _repo => _ref.read(issueRepositoryProvider);

  Future<void> _afterChange() async {
    await _ref.read(issueDetailProvider(issueId).notifier).reload();
    _ref.invalidate(workListProvider);
  }

  /// Atomic ở server: hai cán bộ cùng bấm thì người sau nhận 400. Dù thành công
  /// hay thất bại đều tải lại để thấy ai đang giữ phiếu (task 4.3).
  Future<void> claim() async {
    try {
      await _repo.claim(issueId);
    } finally {
      await _afterChange();
    }
  }

  Future<void> updateStatus(IssueStatus status, {String? note}) async {
    await _repo.updateStatus(issueId, status, note: note);
    await _afterChange();
  }

  Future<List<IssueImage>> uploadResolutionImages(List<UploadImage> images) async {
    final result = await _repo.uploadResolutionImages(issueId, images);
    await _ref.read(issueDetailProvider(issueId).notifier).reload();
    return result;
  }

  Future<void> reload() => _afterChange();
}

final staffActionsProvider =
    Provider.autoDispose.family<StaffActions, String>((ref, id) => StaffActions(ref, id));
