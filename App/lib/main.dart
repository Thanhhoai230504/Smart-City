import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_ce_flutter/hive_ce_flutter.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'core/platform/app_info.dart';
import 'core/storage/prefs.dart';
import 'data/local/draft_store.dart';
import 'data/repositories/meta_repository.dart';
import 'features/report/offline_queue.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Giấy phép SIL OFL của phông Be Vietnam Pro phải đi kèm bản phân phối —
  // hiện trong Cài đặt → Giấy phép mã nguồn mở.
  LicenseRegistry.addLicense(() async* {
    yield LicenseEntryWithLineBreaks(['Be Vietnam Pro'], await rootBundle.loadString('assets/fonts/OFL.txt'));
  });

  // Chạy song song các bước khởi tạo độc lập để màn splash ngắn nhất có thể.
  final prefsFuture = SharedPreferences.getInstance();
  final infoFuture = AppInfo.load();
  final storeFuture = Hive.initFlutter().then((_) => HiveDraftStore.open());
  await initializeDateFormatting('vi');

  final container = ProviderContainer(
    overrides: [
      sharedPrefsProvider.overrideWithValue(await prefsFuture),
      appInfoProvider.overrideWithValue(await infoFuture),
      draftStoreProvider.overrideWithValue(await storeFuture),
    ],
  );

  // Taxonomy: dùng ngay bản cache/dự phòng, làm mới từ server ở nền (0.7).
  unawaited(container.read(metaProvider.notifier).refresh());
  // Khởi động hàng đợi offline sớm để nó nghe mạng/vòng đời app (3.6).
  container.read(offlineQueueProvider);

  runApp(UncontrolledProviderScope(container: container, child: const SmartCityApp()));
}
