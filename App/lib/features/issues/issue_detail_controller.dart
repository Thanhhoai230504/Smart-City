import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/app_exception.dart';
import '../../data/models/issue.dart';
import '../../data/repositories/issue_repository.dart';
import '../auth/auth_controller.dart';

/// Chi tiết một sự cố + các hành động của người dân trên nó.
class IssueDetailController extends AutoDisposeFamilyAsyncNotifier<Issue, String> {
  IssueRepository get _repo => ref.read(issueRepositoryProvider);

  @override
  Future<Issue> build(String id) {
    // Đăng nhập/đăng xuất đổi phạm vi dữ liệu (cán bộ thấy `phone`), tải lại.
    ref.watch(currentUserProvider.select((u) => u?.id));
    return _repo.detail(id);
  }

  Future<void> reload() async {
    final fresh = await AsyncValue.guard(() => _repo.detail(arg));
    if (fresh.hasValue || !state.hasValue) state = fresh;
  }

  /// Ủng hộ — cập nhật lạc quan rồi đồng bộ với số đếm thật của server.
  Future<void> toggleVote() async {
    final issue = state.valueOrNull;
    final userId = ref.read(currentUserProvider)?.id;
    if (issue == null || userId == null) return;
    final voted = issue.hasVoted(userId);
    state = AsyncData(issue.copyWith(
      voteCount: issue.voteCount + (voted ? -1 : 1),
      votes: voted ? (issue.votes.where((v) => v != userId).toList()) : [...issue.votes, userId],
    ));
    try {
      final r = await _repo.toggleVote(arg);
      final current = state.valueOrNull ?? issue;
      state = AsyncData(current.copyWith(
        voteCount: r.voteCount,
        votes: r.voted
            ? {...current.votes, userId}.toList()
            : current.votes.where((v) => v != userId).toList(),
      ));
    } on AppException {
      state = AsyncData(issue);
      rethrow;
    }
  }

  Future<void> rate(int score, String? comment) async {
    final updated = await _repo.rate(arg, score: score, comment: comment);
    // Response của rate không populate đủ — tải lại chi tiết cho chắc.
    state = AsyncData(updated);
    await reload();
  }

  Future<void> reopen(String reason) async {
    await _repo.reopen(arg, reason);
    await reload();
  }
}

final issueDetailProvider =
    AutoDisposeAsyncNotifierProviderFamily<IssueDetailController, Issue, String>(
  IssueDetailController.new,
);
