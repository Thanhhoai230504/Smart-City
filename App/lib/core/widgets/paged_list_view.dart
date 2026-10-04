import 'package:flutter/material.dart';

import '../theme/app_spacing.dart';
import '../utils/paged_controller.dart';
import 'async_states.dart';

/// Danh sách có đủ 5 trạng thái + kéo để làm mới + tải thêm khi gần cuối.
class PagedListView<T> extends StatefulWidget {
  const PagedListView({
    super.key,
    required this.state,
    required this.onRefresh,
    required this.onLoadMore,
    required this.itemBuilder,
    required this.empty,
    this.header,
    this.padding = const EdgeInsets.fromLTRB(Gap.screen, Gap.md, Gap.screen, 96),
    this.separator = Gap.h12,
  });

  final PagedState<T> state;
  final Future<void> Function() onRefresh;
  final VoidCallback onLoadMore;
  final Widget Function(BuildContext, T) itemBuilder;
  final Widget empty;
  final Widget? header;
  final EdgeInsets padding;
  final Widget separator;

  @override
  State<PagedListView<T>> createState() => _PagedListViewState<T>();
}

class _PagedListViewState<T> extends State<PagedListView<T>> {
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (_scroll.position.extentAfter < 600) widget.onLoadMore();
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.state;
    // Header có thể cao (header thương hiệu của màn cán bộ) — đặt trong danh
    // sách cuộn được thay vì Column cố định, kẻo tràn khi chữ phóng to.
    if (s.isLoading && s.items.isEmpty) {
      return ListView(
        padding: EdgeInsets.zero,
        children: [?widget.header, const SkeletonList()],
      );
    }
    if (s.error != null && s.items.isEmpty) {
      return RefreshIndicator(
        onRefresh: widget.onRefresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsets.zero,
          children: [
            ?widget.header,
            SizedBox(
              height: MediaQuery.sizeOf(context).height * 0.5,
              child: ErrorState(error: s.error!, onRetry: widget.onRefresh),
            ),
          ],
        ),
      );
    }

    final itemCount = s.items.length;
    return RefreshIndicator(
      onRefresh: widget.onRefresh,
      child: ListView.separated(
        controller: _scroll,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: widget.padding,
        itemCount: itemCount + 2,
        separatorBuilder: (_, i) => i == 0 || i >= itemCount ? const SizedBox.shrink() : widget.separator,
        itemBuilder: (context, i) {
          if (i == 0) {
            return Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (widget.header != null) widget.header!,
                if (s.isLoading) const LinearProgressIndicator(minHeight: 2),
                if (s.items.isEmpty)
                  SizedBox(height: MediaQuery.sizeOf(context).height * 0.55, child: widget.empty),
              ],
            );
          }
          if (i == itemCount + 1) return _footer(s);
          return widget.itemBuilder(context, s.items[i - 1]);
        },
      ),
    );
  }

  Widget _footer(PagedState<T> s) {
    if (s.isLoadingMore) {
      return const Padding(
        padding: EdgeInsets.all(Gap.lg),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (s.loadMoreError != null) {
      return Center(
        child: TextButton.icon(
          onPressed: widget.onLoadMore,
          icon: const Icon(Icons.refresh),
          label: Text('Không tải thêm được — thử lại (${s.loadMoreError!.message})'),
        ),
      );
    }
    if (!s.hasMore && s.items.length > 5) {
      return Padding(
        padding: const EdgeInsets.all(Gap.lg),
        child: Center(
          child: Text('Đã hiển thị tất cả ${s.pagination.total} mục',
              style: Theme.of(context).textTheme.bodySmall),
        ),
      );
    }
    return const SizedBox(height: Gap.lg);
  }
}
