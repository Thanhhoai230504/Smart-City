import 'dart:convert';
import 'dart:io';

/// Đọc fixture JSON thật chụp từ backend bằng `tool/capture_fixtures.js`.
Map<String, dynamic> fixture(String name) {
  final file = File('test/fixtures/api/$name.json');
  return jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
}

/// `data` trong envelope `{success, data}`.
Map<String, dynamic> fixtureData(String name) => fixture(name)['data'] as Map<String, dynamic>;
