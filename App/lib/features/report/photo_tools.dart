import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:image_picker/image_picker.dart';

import '../../data/repositories/issue_repository.dart';

/// Ảnh đã chọn, đã nén, kèm hash để chống chọn trùng.
class PickedPhoto {
  const PickedPhoto({required this.bytes, required this.hash, required this.format});

  final Uint8List bytes;
  final String hash;

  /// `jpeg` | `png` | `webp` | `gif` — theo magic bytes, không theo đuôi file.
  final String format;

  UploadImage toUpload(int index) =>
      UploadImage(bytes, filename: 'photo_${index + 1}.${format == 'jpeg' ? 'jpg' : format}', mimeSubtype: format);
}

class PhotoRejected implements Exception {
  const PhotoRejected(this.message);

  final String message;

  @override
  String toString() => message;
}

/// Nhận diện định dạng bằng magic bytes — server cũng kiểm tra đúng cách này
/// (`utils/imageSignature.js`) nên mimetype client khai không có giá trị.
String? detectImageFormat(Uint8List b) {
  if (b.length >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF) return 'jpeg';
  if (b.length >= 8 && b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47) return 'png';
  if (b.length >= 12 &&
      b[0] == 0x52 && b[1] == 0x49 && b[2] == 0x46 && b[3] == 0x46 && // RIFF
      b[8] == 0x57 && b[9] == 0x45 && b[10] == 0x42 && b[11] == 0x50) {
    return 'webp';
  }
  if (b.length >= 4 && b[0] == 0x47 && b[1] == 0x49 && b[2] == 0x46 && b[3] == 0x38) return 'gif';
  return null;
}

String photoHash(Uint8List bytes) => sha1.convert(bytes).toString();

/// Chọn và chuẩn hoá ảnh (task 3.1): **≤ 1920px, quality 80**, JPEG.
///
/// `image_picker` tự thu nhỏ + nén JPEG trên Android/iOS. Trên di động, ảnh
/// còn quá dung lượng hoặc không phải JPEG (HEIC, PNG chụp màn hình) được nén
/// lại bằng `flutter_image_compress` — backend chặn 5MB/ảnh và Cloudinary
/// không nhận HEIC.
class PhotoPicker {
  PhotoPicker({ImagePicker? picker, required this.maxBytes}) : _picker = picker ?? ImagePicker();

  final ImagePicker _picker;
  final int maxBytes;

  static const maxDimension = 1920.0;
  static const quality = 80;

  Future<List<PickedPhoto>> pick({required bool camera, required int remaining}) async {
    if (remaining <= 0) return const [];
    final files = <XFile>[];
    if (camera) {
      final shot = await _picker.pickImage(
        source: ImageSource.camera,
        maxWidth: maxDimension,
        maxHeight: maxDimension,
        imageQuality: quality,
      );
      if (shot != null) files.add(shot);
    } else {
      files.addAll(await _picker.pickMultiImage(
        maxWidth: maxDimension,
        maxHeight: maxDimension,
        imageQuality: quality,
        limit: remaining > 1 ? remaining : null,
      ));
      if (remaining == 1 && files.length > 1) files.removeRange(1, files.length);
    }

    final out = <PickedPhoto>[];
    for (final f in files.take(remaining)) {
      out.add(await normalize(await f.readAsBytes()));
    }
    return out;
  }

  Future<PickedPhoto> normalize(Uint8List raw) async {
    var bytes = raw;
    var format = detectImageFormat(bytes);

    final needsTranscode = format == null || format == 'gif' || bytes.length > maxBytes;
    if (needsTranscode && !kIsWeb) {
      for (final q in const [quality, 65, 50]) {
        final out = await FlutterImageCompress.compressWithList(
          raw,
          minWidth: maxDimension.toInt(),
          minHeight: maxDimension.toInt(),
          quality: q,
          format: CompressFormat.jpeg,
        );
        bytes = out;
        format = 'jpeg';
        if (bytes.length <= maxBytes) break;
      }
    }

    if (format == null) {
      throw const PhotoRejected('Định dạng ảnh không được hỗ trợ. Hãy chọn ảnh JPG hoặc PNG.');
    }
    if (bytes.length > maxBytes) {
      final mb = (maxBytes / (1024 * 1024)).round();
      throw PhotoRejected('Ảnh vượt quá $mb MB kể cả sau khi nén. Hãy chọn ảnh khác.');
    }
    return PickedPhoto(bytes: bytes, hash: photoHash(bytes), format: format);
  }
}

/// Thêm ảnh mới vào danh sách đang có: bỏ ảnh trùng (theo hash) và cắt theo
/// trần `limits.maxImages`. Trả về số ảnh bị bỏ vì trùng / vì vượt trần.
({List<PickedPhoto> photos, int duplicates, int overflow}) mergePhotos(
  List<PickedPhoto> current,
  List<PickedPhoto> incoming, {
  required int maxImages,
}) {
  final result = [...current];
  final seen = {for (final p in current) p.hash};
  var duplicates = 0;
  var overflow = 0;
  for (final p in incoming) {
    if (seen.contains(p.hash)) {
      duplicates++;
      continue;
    }
    if (result.length >= maxImages) {
      overflow++;
      continue;
    }
    seen.add(p.hash);
    result.add(p);
  }
  return (photos: result, duplicates: duplicates, overflow: overflow);
}
