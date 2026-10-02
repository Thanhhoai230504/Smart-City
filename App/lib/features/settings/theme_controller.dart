import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/storage/prefs.dart';

/// Mặc định **theo hệ điều hành**, có ghi đè thủ công (design system 3.2) —
/// cán bộ đi hiện trường ban ngày muốn ép sáng dù máy đang để tối.
class ThemeModeController extends Notifier<ThemeMode> {
  @override
  ThemeMode build() {
    final raw = ref.read(sharedPrefsProvider).getString(PrefKeys.themeMode);
    return ThemeMode.values.firstWhere((m) => m.name == raw, orElse: () => ThemeMode.system);
  }

  Future<void> set(ThemeMode mode) async {
    state = mode;
    await ref.read(sharedPrefsProvider).setString(PrefKeys.themeMode, mode.name);
  }
}

final themeModeProvider = NotifierProvider<ThemeModeController, ThemeMode>(ThemeModeController.new);
