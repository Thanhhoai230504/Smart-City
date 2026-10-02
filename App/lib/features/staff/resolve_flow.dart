import '../../core/network/app_exception.dart';
import '../../data/models/issue.dart';
import '../../data/repositories/issue_repository.dart';

sealed class ResolveOutcome {
  const ResolveOutcome();
}

class ResolveDone extends ResolveOutcome {
  const ResolveDone();
}

/// Chưa có ảnh nào — trên máy lẫn trên server.
class ResolveNeedsPhotos extends ResolveOutcome {
  const ResolveNeedsPhotos();
}

class ResolveUploadFailed extends ResolveOutcome {
  const ResolveUploadFailed(this.error);

  final AppException error;
}

/// Ảnh đã lên server, chỉ bước đổi trạng thái lỗi — lần sau KHÔNG upload lại.
class ResolveStatusFailed extends ResolveOutcome {
  const ResolveStatusFailed(this.error);

  final AppException error;
}

/// Thứ tự backend bắt buộc: ảnh minh chứng **trước**, đổi `resolved` **sau**
/// (task 4.5). Giữ trạng thái giữa các lần thử để không tải trùng ảnh.
class ResolveFlow {
  ResolveFlow({
    required this.upload,
    required this.markResolved,
    List<IssueImage> alreadyUploaded = const [],
  }) : uploaded = [...alreadyUploaded];

  final Future<List<IssueImage>> Function(List<UploadImage> images) upload;
  final Future<void> Function(String? note) markResolved;

  /// Ảnh minh chứng đã có trên server.
  List<IssueImage> uploaded;

  /// Ảnh mới chụp, chưa tải lên.
  final List<UploadImage> pending = [];

  Future<ResolveOutcome> run({String? note, void Function(bool uploading)? onPhase}) async {
    if (pending.isNotEmpty) {
      onPhase?.call(true);
      try {
        uploaded = await upload(List.of(pending));
        pending.clear();
      } catch (e) {
        return ResolveUploadFailed(AppException.from(e));
      }
    }
    if (uploaded.isEmpty) return const ResolveNeedsPhotos();

    onPhase?.call(false);
    try {
      await markResolved(note);
      return const ResolveDone();
    } catch (e) {
      return ResolveStatusFailed(AppException.from(e));
    }
  }
}
