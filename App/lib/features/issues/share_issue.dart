import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/widgets/async_states.dart';
import '../../data/models/issue.dart';
import '../update/app_update.dart';

/// Link công khai của sự cố trên web (`/issues/:id`), hoặc `null` khi máy chủ
/// không có địa chỉ web https.
String? issueShareLink(String? webUrl, String issueId) =>
    webUrl == null || webUrl.isEmpty ? null : '$webUrl/issues/$issueId';

String issueShareText(Issue issue, String? link) => [
      issue.title,
      if (issue.location.isNotEmpty) issue.location,
      ?link,
    ].join('\n');

/// Chia sẻ như web: Zalo, Facebook, sao chép link — cộng bảng chia sẻ của hệ
/// điều hành để gửi qua bất kỳ app nào khác (Messenger, Gmail…).
Future<void> showShareIssueSheet(BuildContext context, WidgetRef ref, Issue issue) {
  final link = issueShareLink(ref.read(appUpdateProvider).config?.webUrl, issue.id);
  return showModalBottomSheet<void>(
    context: context,
    builder: (ctx) => _ShareSheet(issue: issue, link: link),
  );
}

class _ShareSheet extends StatelessWidget {
  const _ShareSheet({required this.issue, required this.link});

  final Issue issue;
  final String? link;

  Future<void> _open(BuildContext context, String url) async {
    final ok = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    if (!ok && context.mounted) showAppSnack(context, 'Không mở được ứng dụng chia sẻ.', error: true);
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final palette = context.palette;
    final encoded = link == null ? null : Uri.encodeComponent(link!);

    Widget target(String label, Widget icon, Color color, VoidCallback? onTap) => Expanded(
          child: Semantics(
            button: true,
            enabled: onTap != null,
            label: label,
            excludeSemantics: true,
            child: InkWell(
              borderRadius: BorderRadius.circular(Radii.tile),
              onTap: onTap,
              child: Opacity(
                opacity: onTap == null ? 0.4 : 1,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: Gap.sm),
                  child: Column(
                    children: [
                      Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                        alignment: Alignment.center,
                        child: icon,
                      ),
                      Gap.h8,
                      Text(label, style: textTheme.labelMedium, textAlign: TextAlign.center, maxLines: 2),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(Gap.screen, 0, Gap.screen, Gap.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Chia sẻ sự cố', style: textTheme.titleLarge),
            Gap.h4,
            Text(
              link == null
                  ? 'Máy chủ chưa có địa chỉ web công khai — chỉ chia sẻ được nội dung.'
                  : 'Người nhận mở link sẽ thấy sự cố trên web, không cần cài app.',
              style: textTheme.bodySmall,
            ),
            Gap.h16,
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                target(
                  'Zalo',
                  Text('Zalo', style: textTheme.labelMedium?.copyWith(color: Colors.white)),
                  const Color(0xFF0068FF),
                  encoded == null ? null : () => _open(context, 'https://zalo.me/share?url=$encoded'),
                ),
                target(
                  'Facebook',
                  const Icon(Icons.facebook, color: Colors.white, size: 30),
                  const Color(0xFF1877F2),
                  encoded == null
                      ? null
                      : () => _open(context, 'https://www.facebook.com/sharer/sharer.php?u=$encoded'),
                ),
                target(
                  'Sao chép liên kết',
                  Icon(Icons.link, color: palette.primary, size: 28),
                  Theme.of(context).colorScheme.primaryContainer,
                  link == null
                      ? null
                      : () async {
                          await Clipboard.setData(ClipboardData(text: link!));
                          if (context.mounted) {
                            Navigator.pop(context);
                            showAppSnack(context, 'Đã sao chép liên kết.');
                          }
                        },
                ),
                target(
                  'Ứng dụng khác',
                  Icon(Icons.ios_share, color: palette.textPrimary, size: 26),
                  palette.field,
                  () => SharePlus.instance.share(
                    ShareParams(text: issueShareText(issue, link), subject: issue.title),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
