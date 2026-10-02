import 'dart:async';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// Nạp font thật (Roboto + Material Icons có sẵn trong Flutter SDK) cho mọi test.
///
/// Font mặc định của `flutter_test` vẽ mỗi ký tự thành ô vuông rộng đúng bằng cỡ
/// chữ — rộng gấp ~2 lần font thật, nên test bố cục sẽ báo tràn ở những chỗ
/// thực tế không tràn. Roboto là font hệ thống của Android (font body của app,
/// design system 4.1) và có đủ dấu tiếng Việt, nên số đo sát với máy thật.
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  TestWidgetsFlutterBinding.ensureInitialized();
  await _loadSdkFonts();
  await testMain();
}

Future<void> _loadSdkFonts() async {
  final root = Platform.environment['FLUTTER_ROOT'] ??
      File(Platform.resolvedExecutable).parent.parent.parent.parent.parent.path;
  final dir = Directory('$root/bin/cache/artifacts/material_fonts');
  if (!dir.existsSync()) return; // giữ font test mặc định (khắt khe hơn) nếu thiếu

  Future<void> load(String family, List<String> files) async {
    final loader = FontLoader(family);
    for (final f in files) {
      final file = File('${dir.path}/$f');
      if (file.existsSync()) {
        loader.addFont(Future.value(ByteData.sublistView(file.readAsBytesSync())));
      }
    }
    await loader.load();
  }

  await load('Roboto', ['roboto-regular.ttf', 'roboto-medium.ttf', 'roboto-bold.ttf']);
  await load('MaterialIcons', ['materialicons-regular.otf']);
}
