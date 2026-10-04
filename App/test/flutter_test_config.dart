import 'dart:async';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// Nạp font thật cho mọi test: **Be Vietnam Pro** của app (từ `assets/fonts/`)
/// và Material Icons + Roboto có sẵn trong Flutter SDK.
///
/// Font mặc định của `flutter_test` vẽ mỗi ký tự thành ô vuông rộng đúng bằng cỡ
/// chữ, nên test bố cục sẽ báo tràn ở chỗ thực tế không tràn — hoặc ngược lại,
/// bỏ sót chỗ tràn thật. Be Vietnam Pro rộng hơn Roboto, nên đo bằng đúng font
/// app dùng mới bắt được chữ tràn trên máy thật.
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  TestWidgetsFlutterBinding.ensureInitialized();
  await _loadAppFonts();
  await _loadSdkFonts();
  await testMain();
}

Future<void> _loadAppFonts() async {
  final dir = Directory('assets/fonts');
  if (!dir.existsSync()) return;
  final loader = FontLoader('BeVietnamPro');
  for (final w in ['Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold']) {
    final file = File('${dir.path}/BeVietnamPro-$w.ttf');
    if (file.existsSync()) {
      loader.addFont(Future.value(ByteData.sublistView(file.readAsBytesSync())));
    }
  }
  await loader.load();
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
