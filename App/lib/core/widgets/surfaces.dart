import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/repositories/meta_repository.dart';
import '../theme/app_colors.dart';
import '../theme/app_icons.dart';
import '../theme/app_spacing.dart';

/// Card chuẩn của app: mặt trắng, viền mảnh, bóng mềm (theme tối chỉ viền),
/// bo 20. Có [onTap] thì có hiệu ứng chạm đúng theo hình bo.
class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.all(Gap.card),
    this.color,
    this.radius = Radii.card,
    this.elevated = true,
    this.borderColor,
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final Color? color;
  final double radius;

  /// `false` cho card lồng trong card — chỉ giữ viền, bỏ bóng.
  final bool elevated;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final shape = BorderRadius.circular(radius);
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: shape,
        boxShadow: elevated ? p.cardShadow : null,
      ),
      child: Material(
        color: color ?? p.surface,
        shape: RoundedRectangleBorder(
          borderRadius: shape,
          side: BorderSide(color: borderColor ?? p.border),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(padding: padding, child: child),
        ),
      ),
    );
  }
}

/// Bọc vùng cuộn có [HeroHeader] ở đầu. Header đặt chữ thanh trạng thái màu
/// trắng; khi nó đã trôi khỏi giờ/pin, lớp này phủ một dải nền mờ dưới thanh
/// trạng thái và trả màu chữ về theo theme. Thiếu nó, giờ/pin trắng ở lại trên
/// nền sáng và nội dung chạy đè dưới chữ.
class HeroScrollScope extends StatefulWidget {
  const HeroScrollScope({super.key, required this.child});

  final Widget child;

  @override
  State<HeroScrollScope> createState() => _HeroScrollScopeState();
}

class _HeroScrollScopeState extends State<HeroScrollScope> {
  final _heroes = <BuildContext>{};
  bool _heroOnTop = true;
  bool _updateScheduled = false;

  @override
  void initState() {
    super.initState();
    // Màn chưa có header (đang tải, lỗi) thì phải hiện dải nền ngay từ đầu.
    _scheduleUpdate();
  }

  void _register(BuildContext hero) {
    _heroes.add(hero);
    _scheduleUpdate();
  }

  void _unregister(BuildContext hero) {
    _heroes.remove(hero);
    _scheduleUpdate();
  }

  /// Đo sau khi khung hình đã bố trí xong: thông báo cuộn tới *trước* lượt bố
  /// trí của vị trí mới, và header cuộn ngược về chỉ được dựng lại trong lượt đó.
  void _scheduleUpdate() {
    if (_updateScheduled) return;
    _updateScheduled = true;
    WidgetsBinding.instance
      ..addPostFrameCallback((_) {
        _updateScheduled = false;
        _update();
      })
      ..ensureVisualUpdate();
  }

  void _update() {
    if (!mounted) return;
    final statusBar = MediaQuery.paddingOf(context).top;
    var onTop = false;
    for (final hero in _heroes) {
      final box = hero.findRenderObject();
      if (box is RenderBox && box.attached && box.hasSize) {
        if (box.localToGlobal(Offset(0, box.size.height)).dy > statusBar) {
          onTop = true;
          break;
        }
      }
    }
    if (onTop != _heroOnTop) setState(() => _heroOnTop = onTop);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final themeStyle = p.brightness == Brightness.light ? SystemUiOverlayStyle.dark : SystemUiOverlayStyle.light;
    return _HeroScope(
      state: this,
      child: NotificationListener<ScrollNotification>(
        onNotification: (n) {
          if (n.metrics.axis == Axis.vertical) _scheduleUpdate();
          return false;
        },
        child: Stack(
          fit: StackFit.expand,
          children: [
            widget.child,
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              height: MediaQuery.paddingOf(context).top,
              // Vùng này luôn nằm trên cùng nên quyết định màu chữ thanh trạng
              // thái: trắng khi header còn dưới giờ/pin, theo theme khi đã cuộn qua.
              child: IgnorePointer(
                child: AnnotatedRegion<SystemUiOverlayStyle>(
                  value: _heroOnTop ? SystemUiOverlayStyle.light : themeStyle,
                  child: AnimatedOpacity(
                    opacity: _heroOnTop ? 0 : 1,
                    duration: Motion.of(context, Motion.fast),
                    child: ColoredBox(color: p.background.withValues(alpha: 0.97)),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HeroScope extends InheritedWidget {
  const _HeroScope({required this.state, required super.child});

  final _HeroScrollScopeState state;

  @override
  bool updateShouldNotify(_HeroScope old) => state != old.state;
}

/// Báo cho [HeroScrollScope] gần nhất biết header đang có mặt trên cây.
class _HeroMarker extends StatefulWidget {
  const _HeroMarker({required this.child});

  final Widget child;

  @override
  State<_HeroMarker> createState() => _HeroMarkerState();
}

class _HeroMarkerState extends State<_HeroMarker> {
  _HeroScrollScopeState? _scope;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final scope = context.getInheritedWidgetOfExactType<_HeroScope>()?.state;
    if (scope != _scope) {
      _scope?._unregister(context);
      _scope = scope?.._register(context);
    }
  }

  @override
  void dispose() {
    _scope?._unregister(context);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

/// Header chữ ký: gradient "biển Đà Nẵng" kèm hoạ tiết sóng mờ, bo đáy 28.
/// Nằm dưới thanh trạng thái (chữ trạng thái chuyển trắng) — màn dùng nó không
/// có AppBar riêng, và bọc vùng cuộn bằng [HeroScrollScope].
class HeroHeader extends StatelessWidget {
  const HeroHeader({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.fromLTRB(Gap.screen, Gap.md, Gap.screen, Gap.xxl),
    this.bottomRadius = Radii.hero,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final double bottomRadius;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final top = MediaQuery.paddingOf(context).top;
    return _HeroMarker(
      child: AnnotatedRegion<SystemUiOverlayStyle>(
        value: SystemUiOverlayStyle.light,
        child: ClipRRect(
          borderRadius: BorderRadius.vertical(bottom: Radius.circular(bottomRadius)),
          child: DecoratedBox(
            decoration: BoxDecoration(gradient: p.brandGradient),
            child: CustomPaint(
              painter: _WavePainter(p.onBrand),
              child: Padding(
                padding: EdgeInsets.only(top: top).add(padding),
                child: DefaultTextStyle.merge(
                  style: TextStyle(color: p.onBrand),
                  child: IconTheme.merge(data: IconThemeData(color: p.onBrand), child: child),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Logo thương hiệu — cùng hình với icon app (skyline xanh ngọc trên nền navy),
/// viền sáng mảnh để tách khỏi gradient của [HeroHeader]. Chữ tên app luôn đứng
/// cạnh nên ảnh chỉ để trang trí với trình đọc màn hình.
class BrandLogo extends StatelessWidget {
  const BrandLogo({super.key, this.size = 40});

  final double size;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(size * 0.3),
          border: Border.all(color: context.palette.onBrand.withValues(alpha: 0.22)),
          image: const DecorationImage(
            image: AssetImage('assets/branding/logo_tile.png'),
            fit: BoxFit.cover,
            filterQuality: FilterQuality.medium,
          ),
        ),
      );
}

/// Ba dải sóng và một vầng mặt trời mờ — gợi biển và bình minh trên sông Hàn,
/// đủ nhạt (≤ 10% trắng) để không ảnh hưởng độ tương phản của chữ.
class _WavePainter extends CustomPainter {
  _WavePainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final sun = Paint()..color = color.withValues(alpha: 0.07);
    canvas.drawCircle(Offset(size.width * 0.86, size.height * 0.18), size.width * 0.22, sun);
    canvas.drawCircle(Offset(size.width * 0.86, size.height * 0.18), size.width * 0.13, sun);

    for (var i = 0; i < 3; i++) {
      final paint = Paint()..color = color.withValues(alpha: 0.05 + 0.025 * i);
      final baseY = size.height * (0.62 + 0.13 * i);
      final amp = 10.0 + 4 * i;
      final path = Path()..moveTo(0, baseY);
      for (double x = 0; x <= size.width; x += 4) {
        path.lineTo(x, baseY + amp * math.sin((x / size.width) * 2 * math.pi + i * 1.3));
      }
      path
        ..lineTo(size.width, size.height)
        ..lineTo(0, size.height)
        ..close();
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(_WavePainter old) => old.color != color;
}

/// Ô số liệu "kính mờ" đặt trên [HeroHeader].
class GlassTile extends StatelessWidget {
  const GlassTile({super.key, required this.value, required this.label, this.icon});

  final String value;
  final String label;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final textTheme = Theme.of(context).textTheme;
    return Semantics(
      label: '$label: $value',
      excludeSemantics: true,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: Gap.md, vertical: Gap.md),
        decoration: BoxDecoration(
          color: p.onBrand.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(Radii.tile),
          border: Border.all(color: p.onBrand.withValues(alpha: 0.18)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 18, color: p.onBrandMuted),
              Gap.h4,
            ],
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(value, style: textTheme.headlineSmall?.copyWith(color: p.onBrand)),
            ),
            Text(
              label,
              style: textTheme.bodySmall?.copyWith(color: p.onBrandMuted),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

/// Tiêu đề khu vực + hành động phụ ("Xem tất cả").
class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title, {super.key, this.actionLabel, this.onAction, this.padding});

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Padding(
      padding: padding ?? const EdgeInsets.only(top: Gap.xxl, bottom: Gap.sm),
      child: Row(
        children: [
          Expanded(child: Text(title, style: textTheme.titleLarge)),
          if (actionLabel != null)
            TextButton(onPressed: onAction, child: Text(actionLabel!)),
        ],
      ),
    );
  }
}

/// Icon trong ô bo tròn pha màu — dùng cho lối tắt, danh mục, mục cài đặt.
class IconBubble extends StatelessWidget {
  const IconBubble({
    super.key,
    required this.icon,
    required this.ink,
    required this.container,
    this.size = 44,
    this.radius,
  });

  final IconData icon;
  final Color ink;
  final Color container;
  final double size;
  final double? radius;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: container,
          borderRadius: BorderRadius.circular(radius ?? size * 0.32),
        ),
        child: Icon(icon, color: ink, size: size * 0.52),
      );
}

/// Ô icon danh mục, màu lấy từ meta nhưng đã chỉnh cho đủ tương phản.
class CategoryBadge extends ConsumerWidget {
  const CategoryBadge(this.category, {super.key, this.size = 44});

  final String category;
  final double size;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = ref.watch(metaProvider).category(category);
    final tone = CategoryTone.of(hexColor(c.color), context.palette);
    return Semantics(
      label: 'Loại: ${c.label}',
      excludeSemantics: true,
      child: IconBubble(
        icon: AppIcons.category(category),
        ink: tone.ink,
        container: tone.container,
        size: size,
      ),
    );
  }
}
