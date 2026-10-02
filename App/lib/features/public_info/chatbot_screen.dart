import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/app_exception.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../data/repositories/support_repositories.dart';

class ChatMessage {
  const ChatMessage(this.role, this.content);

  /// `user` | `assistant` — đúng định dạng `history` của backend.
  final String role;
  final String content;
}

/// Trợ lý hỏi đáp (task 2.10). `chatbotLimiter` 25 tin/15 phút — chạm trần thì
/// **báo lịch sự**, không crash và không mất cuộc trò chuyện.
class ChatbotScreen extends ConsumerStatefulWidget {
  const ChatbotScreen({super.key});

  @override
  ConsumerState<ChatbotScreen> createState() => _ChatbotScreenState();
}

class _ChatbotScreenState extends ConsumerState<ChatbotScreen> {
  final _messages = <ChatMessage>[
    const ChatMessage(
      'assistant',
      'Xin chào! Tôi có thể giúp bạn cách báo cáo sự cố, tra cứu tiến độ xử lý, hoặc thông tin đơn vị phụ trách.',
    ),
  ];
  final _input = TextEditingController();
  final _scroll = ScrollController();
  bool _sending = false;
  String? _notice;

  static const _suggestions = [
    'Làm sao để báo cáo ổ gà?',
    'Bao lâu thì sự cố được xử lý?',
    'Tôi có thể mở lại sự cố không?',
  ];

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _send([String? preset]) async {
    final text = (preset ?? _input.text).trim();
    if (text.isEmpty || _sending) return;
    _input.clear();
    setState(() {
      _messages.add(ChatMessage('user', text));
      _sending = true;
      _notice = null;
    });
    _scrollToEnd();
    try {
      // Gửi tối đa 10 lượt gần nhất làm ngữ cảnh — đủ cho hội thoại ngắn, không
      // phình payload/token.
      final history = [
        for (final m in _messages.sublist(0, _messages.length - 1).reversed.take(10).toList().reversed)
          {'role': m.role, 'content': m.content},
      ];
      final reply = await ref.read(publicRepositoryProvider).chat(text, history);
      if (!mounted) return;
      setState(() => _messages.add(ChatMessage('assistant', reply)));
    } on AppException catch (e) {
      if (!mounted) return;
      setState(() => _notice = e.kind == AppErrorKind.rateLimited
          ? 'Bạn đã hỏi khá nhiều trong thời gian ngắn. Vui lòng chờ ít phút rồi hỏi tiếp nhé.'
          : e.kind == AppErrorKind.network
              ? 'Không có kết nối mạng — câu hỏi chưa được gửi.'
              : 'Trợ lý đang bận, vui lòng thử lại sau.');
    } finally {
      if (mounted) setState(() => _sending = false);
      _scrollToEnd();
    }
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(_scroll.position.maxScrollExtent,
            duration: const Duration(milliseconds: 200), curve: Curves.easeOutCubic);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Trợ lý Smart City')),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              controller: _scroll,
              padding: const EdgeInsets.all(Gap.screen),
              itemCount: _messages.length + (_sending ? 1 : 0),
              itemBuilder: (context, i) {
                if (i == _messages.length) {
                  return Align(
                    alignment: Alignment.centerLeft,
                    child: Text('Trợ lý đang trả lời…', style: textTheme.bodySmall),
                  );
                }
                final m = _messages[i];
                final mine = m.role == 'user';
                return Align(
                  alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    margin: const EdgeInsets.only(bottom: Gap.sm),
                    padding: const EdgeInsets.symmetric(horizontal: Gap.md, vertical: Gap.sm),
                    constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.8),
                    decoration: BoxDecoration(
                      color: mine ? palette.primary : palette.surface,
                      border: mine ? null : Border.all(color: palette.border),
                      borderRadius: BorderRadius.circular(Radii.card),
                    ),
                    child: SelectableText(
                      m.content,
                      style: textTheme.bodyMedium?.copyWith(color: mine ? palette.onPrimary : palette.textPrimary),
                    ),
                  ),
                );
              },
            ),
          ),
          if (_messages.length == 1)
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: Gap.screenPadding,
              child: Row(
                children: [
                  for (final s in _suggestions) ...[
                    ActionChip(label: Text(s), onPressed: () => _send(s)),
                    Gap.w8,
                  ],
                ],
              ),
            ),
          if (_notice != null)
            Container(
              width: double.infinity,
              color: palette.offline.container,
              padding: const EdgeInsets.all(Gap.md),
              child: Text(_notice!, style: textTheme.bodySmall?.copyWith(color: palette.offline.text)),
            ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(Gap.screen, Gap.sm, Gap.sm, Gap.sm),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _input,
                      minLines: 1,
                      maxLines: 4,
                      maxLength: 500,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _send(),
                      decoration: const InputDecoration(hintText: 'Nhập câu hỏi…', counterText: ''),
                    ),
                  ),
                  Gap.w8,
                  IconButton.filled(
                    tooltip: 'Gửi câu hỏi',
                    onPressed: _sending ? null : _send,
                    icon: const Icon(Icons.send),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
