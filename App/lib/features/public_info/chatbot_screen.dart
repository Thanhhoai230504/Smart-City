import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/app_exception.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/widgets/surfaces.dart';
import '../../data/repositories/support_repositories.dart';

class ChatMessage {
  const ChatMessage(this.role, this.content);

  /// `user` | `assistant` — đúng định dạng `history` của backend.
  final String role;
  final String content;
}

/// Câu hỏi gợi ý — cùng bộ "quick actions" của widget chatbot trên web.
const chatbotQuickActions = <(IconData, String, String)>[
  (Icons.edit_note, 'Cách báo cáo sự cố', 'Hướng dẫn tôi cách báo cáo sự cố'),
  (Icons.insights_outlined, 'Thống kê sự cố', 'Cho tôi xem thống kê sự cố hiện tại'),
  (Icons.map_outlined, 'Hướng dẫn dùng bản đồ', 'Hướng dẫn sử dụng bản đồ'),
  (Icons.support_agent, 'Liên hệ hỗ trợ', 'Tôi muốn liên hệ hỗ trợ'),
];

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
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Row(
          children: [
            IconBubble(icon: Icons.support_agent, ink: palette.onPrimary, container: palette.primary, size: 38),
            Gap.w12,
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Trợ lý Smart City'),
                  Text('Trả lời tự động bằng AI', style: textTheme.bodySmall),
                ],
              ),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              controller: _scroll,
              padding: const EdgeInsets.fromLTRB(Gap.screen, Gap.sm, Gap.screen, Gap.md),
              children: [
                for (final m in _messages) _Bubble(message: m),
                if (_sending) const _TypingBubble(),
                if (_messages.length == 1) ...[
                  Gap.h12,
                  Text('Gợi ý câu hỏi', style: textTheme.titleSmall?.copyWith(color: palette.textSecondary)),
                  Gap.h8,
                  for (final (icon, label, message) in chatbotQuickActions)
                    Padding(
                      padding: const EdgeInsets.only(bottom: Gap.sm),
                      child: AppCard(
                        elevated: false,
                        padding: const EdgeInsets.symmetric(horizontal: Gap.md, vertical: Gap.sm + 2),
                        onTap: () => _send(message),
                        child: Row(
                          children: [
                            IconBubble(icon: icon, ink: scheme.onPrimaryContainer, container: scheme.primaryContainer, size: 34),
                            Gap.w12,
                            Expanded(child: Text(label, style: textTheme.titleSmall)),
                            Icon(Icons.north_east, size: 18, color: palette.textSecondary),
                          ],
                        ),
                      ),
                    ),
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
          DecoratedBox(
            decoration: BoxDecoration(
              color: palette.surface,
              border: Border(top: BorderSide(color: palette.border)),
            ),
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(Gap.screen, Gap.sm, Gap.sm, Gap.sm),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _input,
                        minLines: 1,
                        maxLines: 4,
                        maxLength: 500,
                        textInputAction: TextInputAction.send,
                        onSubmitted: (_) => _send(),
                        decoration: InputDecoration(
                          hintText: 'Nhập câu hỏi…',
                          counterText: '',
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(24),
                            borderSide: BorderSide.none,
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(24),
                            borderSide: BorderSide.none,
                          ),
                        ),
                      ),
                    ),
                    Gap.w8,
                    IconButton.filled(
                      tooltip: 'Gửi câu hỏi',
                      style: IconButton.styleFrom(minimumSize: const Size(52, 52)),
                      onPressed: _sending ? null : _send,
                      icon: const Icon(Icons.send_rounded),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final textTheme = Theme.of(context).textTheme;
    final mine = message.role == 'user';
    const r = Radius.circular(18);
    const tail = Radius.circular(4);

    final bubble = Container(
      padding: const EdgeInsets.symmetric(horizontal: Gap.md, vertical: Gap.sm + 2),
      constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.78),
      decoration: BoxDecoration(
        gradient: mine ? palette.brandGradient : null,
        color: mine ? null : palette.surface,
        border: mine ? null : Border.all(color: palette.border),
        borderRadius: BorderRadius.only(
          topLeft: mine ? r : tail,
          topRight: mine ? tail : r,
          bottomLeft: r,
          bottomRight: r,
        ),
      ),
      child: SelectableText(
        message.content,
        style: textTheme.bodyMedium?.copyWith(color: mine ? palette.onBrand : palette.textPrimary),
      ),
    );

    return Padding(
      padding: const EdgeInsets.only(bottom: Gap.sm),
      child: Row(
        mainAxisAlignment: mine ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!mine) ...[
            IconBubble(
              icon: Icons.support_agent,
              ink: Theme.of(context).colorScheme.onPrimaryContainer,
              container: Theme.of(context).colorScheme.primaryContainer,
              size: 30,
            ),
            Gap.w8,
          ],
          Flexible(child: bubble),
        ],
      ),
    );
  }
}

/// "Đang trả lời" — ba chấm nhấp nháy thay cho dòng chữ tĩnh.
class _TypingBubble extends StatefulWidget {
  const _TypingBubble();

  @override
  State<_TypingBubble> createState() => _TypingBubbleState();
}

class _TypingBubbleState extends State<_TypingBubble> with SingleTickerProviderStateMixin {
  late final _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final reduceMotion = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    return Semantics(
      label: 'Trợ lý đang trả lời',
      child: Padding(
        padding: const EdgeInsets.only(left: 38, bottom: Gap.sm),
        child: Align(
          alignment: Alignment.centerLeft,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: Gap.md, vertical: Gap.md),
            decoration: BoxDecoration(
              color: palette.surface,
              border: Border.all(color: palette.border),
              borderRadius: BorderRadius.circular(18),
            ),
            child: AnimatedBuilder(
              animation: _controller,
              builder: (context, _) => Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  for (var i = 0; i < 3; i++)
                    Container(
                      width: 8,
                      height: 8,
                      margin: const EdgeInsets.symmetric(horizontal: 2),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: palette.textSecondary.withValues(
                          alpha: reduceMotion ? 0.6 : 0.3 + 0.7 * (((_controller.value * 3 - i) % 3) < 1 ? 1 : 0),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
