import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';

/// Nguồn ảnh: URL (đã lên server) hoặc bytes (ảnh vừa chụp, phiếu offline).
class PhotoSource {
  const PhotoSource.url(String this.url) : bytes = null;
  const PhotoSource.bytes(Uint8List this.bytes) : url = null;

  final String? url;
  final Uint8List? bytes;
}

/// Ảnh có trạng thái tải và lỗi — dùng chung toàn app.
class AppImage extends StatelessWidget {
  const AppImage(this.source, {super.key, this.fit = BoxFit.cover, this.semanticLabel});

  final PhotoSource source;
  final BoxFit fit;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    Widget fallback() => ColoredBox(
          color: palette.surfaceAlt,
          child: Center(
            child: Icon(Icons.broken_image_outlined, color: palette.textSecondary),
          ),
        );

    if (source.bytes != null) {
      return Image.memory(
        source.bytes!,
        fit: fit,
        semanticLabel: semanticLabel,
        errorBuilder: (_, _, _) => fallback(),
      );
    }
    return Image.network(
      source.url!,
      fit: fit,
      semanticLabel: semanticLabel,
      errorBuilder: (_, _, _) => fallback(),
      loadingBuilder: (context, child, progress) => progress == null
          ? child
          : ColoredBox(
              color: palette.surfaceAlt,
              child: const Center(
                child: SizedBox.square(
                  dimension: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            ),
    );
  }
}

/// Dải ảnh vuốt ngang, chạm để phóng to (design system mục 8). Có nhãn nguồn
/// ảnh — "Người dân chụp" / "Đơn vị chụp sau xử lý" — để điểm đánh giá của
/// người dân có căn cứ.
class PhotoEvidenceStrip extends StatelessWidget {
  const PhotoEvidenceStrip({
    super.key,
    required this.label,
    required this.photos,
    this.icon = Icons.photo_camera_outlined,
    this.height = 96,
    this.emptyText,
  });

  final String label;
  final IconData icon;
  final List<PhotoSource> photos;
  final double height;
  final String? emptyText;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            Icon(icon, size: 18, color: palette.textSecondary),
            Gap.w8,
            Expanded(
              child: Text(
                photos.isEmpty ? label : '$label · ${photos.length} ảnh',
                style: textTheme.labelMedium?.copyWith(color: palette.textSecondary),
              ),
            ),
          ],
        ),
        Gap.h8,
        if (photos.isEmpty)
          Text(emptyText ?? 'Chưa có ảnh', style: textTheme.bodySmall)
        else
          SizedBox(
            height: height,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: photos.length,
              separatorBuilder: (_, _) => Gap.w8,
              itemBuilder: (context, i) => Semantics(
                button: true,
                label: '$label, ảnh ${i + 1} trên ${photos.length}. Chạm để phóng to',
                child: InkWell(
                  borderRadius: BorderRadius.circular(Radii.image),
                  onTap: () => PhotoViewer.open(context, photos, initialIndex: i, title: label),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(Radii.image),
                    child: SizedBox(
                      width: height * 1.25,
                      height: height,
                      child: AppImage(photos[i]),
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// Xem ảnh toàn màn hình: vuốt ngang chuyển ảnh, chụm để phóng to.
class PhotoViewer extends StatefulWidget {
  const PhotoViewer({super.key, required this.photos, this.initialIndex = 0, this.title});

  final List<PhotoSource> photos;
  final int initialIndex;
  final String? title;

  static Future<void> open(
    BuildContext context,
    List<PhotoSource> photos, {
    int initialIndex = 0,
    String? title,
  }) =>
      Navigator.of(context, rootNavigator: true).push<void>(
        MaterialPageRoute(
          fullscreenDialog: true,
          builder: (_) => PhotoViewer(photos: photos, initialIndex: initialIndex, title: title),
        ),
      );

  @override
  State<PhotoViewer> createState() => _PhotoViewerState();
}

class _PhotoViewerState extends State<PhotoViewer> {
  late final PageController _controller = PageController(initialPage: widget.initialIndex);
  late int _index = widget.initialIndex;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        shape: const Border(),
        title: Text(
          '${widget.title ?? 'Ảnh'} · ${_index + 1}/${widget.photos.length}',
          style: const TextStyle(color: Colors.white, fontSize: 16),
        ),
      ),
      body: PageView.builder(
        controller: _controller,
        itemCount: widget.photos.length,
        onPageChanged: (i) => setState(() => _index = i),
        itemBuilder: (_, i) => InteractiveViewer(
          maxScale: 5,
          child: Center(child: AppImage(widget.photos[i], fit: BoxFit.contain)),
        ),
      ),
    );
  }
}
