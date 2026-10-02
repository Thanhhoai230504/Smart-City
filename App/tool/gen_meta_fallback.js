#!/usr/bin/env node
/**
 * Sinh lib/data/models/meta_fallback.dart từ chính cấu hình của backend.
 *
 *   cd Project/Backend && node ../App/tool/gen_meta_fallback.js
 *
 * Chạy lại mỗi khi metaConfig.js đổi (META_VERSION tăng). Không chép tay — bản
 * dự phòng chép tay chính là kiểu trùng lặp đã làm nhãn web lệch backend 3 lần.
 */
const fs = require('fs');
const path = require('path');

const backendRoot = process.cwd();
const { buildMeta } = require(path.join(backendRoot, 'src/utils/metaConfig'));

const json = JSON.stringify(buildMeta(), null, 2).replace(/\$/g, '\\$');
const out = `// GENERATED — đừng sửa tay. Sinh từ Backend/src/utils/metaConfig.js:
//   cd Project/Backend && node ../App/tool/gen_meta_fallback.js
//
// Bản dự phòng khi chưa tải được GET /api/meta/enums (cold start không mạng —
// nghiệm thu task 0.7). Test test/data/meta_test.dart so khớp bản này với
// fixture lấy thật từ API để phát hiện lệch.
// ignore_for_file: prefer_single_quotes, lines_longer_than_80_chars

const Map<String, Object?> kMetaFallbackJson = ${json};
`;

const target = path.join(__dirname, '..', 'lib', 'data', 'models', 'meta_fallback.dart');
fs.writeFileSync(target, out);
console.log(`Đã ghi ${path.relative(process.cwd(), target)} (version ${buildMeta().version})`);
