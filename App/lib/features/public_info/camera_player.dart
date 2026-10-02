import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../core/theme/app_spacing.dart';
import '../../data/models/public_info.dart';

/// Phát camera công cộng (task 2.9). Dùng `embedUrl` server đã dựng sẵn —
/// client không tự ghép URL từ youtubeId (chống iframe injection).
///
/// Bản web (xem thử) không có WebView native → mở thẳng YouTube.
class CameraPlayer extends StatefulWidget {
  const CameraPlayer({super.key, required this.camera});

  final PublicCamera camera;

  static Future<void> open(BuildContext context, PublicCamera camera) async {
    if (kIsWeb) {
      await launchUrl(Uri.parse(camera.watchUrl), mode: LaunchMode.externalApplication);
      return;
    }
    await Navigator.of(context).push<void>(
      MaterialPageRoute(builder: (_) => CameraPlayer(camera: camera)),
    );
  }

  @override
  State<CameraPlayer> createState() => _CameraPlayerState();
}

class _CameraPlayerState extends State<CameraPlayer> {
  late final WebViewController _web = WebViewController()
    ..setJavaScriptMode(JavaScriptMode.unrestricted)
    ..setNavigationDelegate(NavigationDelegate(
      // Chỉ cho chạy trong khung phát của YouTube; link khác mở bằng trình duyệt.
      onNavigationRequest: (req) {
        final host = Uri.tryParse(req.url)?.host ?? '';
        if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com') ||
            host.endsWith('ytimg.com') || host.endsWith('google.com') || host.endsWith('gstatic.com')) {
          return NavigationDecision.navigate;
        }
        launchUrl(Uri.parse(req.url), mode: LaunchMode.externalApplication);
        return NavigationDecision.prevent;
      },
    ))
    ..loadRequest(Uri.parse(widget.camera.embedUrl));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.camera.name, maxLines: 1, overflow: TextOverflow.ellipsis),
        actions: [
          IconButton(
            tooltip: 'Mở trên YouTube',
            icon: const Icon(Icons.open_in_new),
            onPressed: () => launchUrl(Uri.parse(widget.camera.watchUrl), mode: LaunchMode.externalApplication),
          ),
        ],
      ),
      body: Column(
        children: [
          AspectRatio(aspectRatio: 16 / 9, child: WebViewWidget(controller: _web)),
          Padding(
            padding: const EdgeInsets.all(Gap.screen),
            child: Text(
              'Hình ảnh trực tiếp từ camera công cộng. Nếu không phát được, bấm biểu tượng mở trên YouTube.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
        ],
      ),
    );
  }
}
