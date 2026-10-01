// Rà từng <IconButton> trong src/: có nhãn cho trình đọc màn hình không? (G26)
// Chạy: node scripts/audit-icon-buttons.cjs  — thoát mã 1 nếu còn nút thiếu nhãn.
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'src');

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx$/.test(e.name) && !/\.test\./.test(e.name)) files.push(p);
  }
})(SRC);

// Lấy thẻ mở đầy đủ: bỏ qua '>' nằm trong {...} (arrow function, JSX lồng).
const openTag = (txt, start) => {
  let depth = 0;
  for (let i = start; i < txt.length; i++) {
    const c = txt[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return txt.slice(start, i + 1);
  }
  return txt.slice(start);
};

let total = 0, viaAria = 0, viaTooltip = 0;
const missing = [];
for (const f of files) {
  const txt = fs.readFileSync(f, 'utf8');
  const re = /<IconButton\b/g;
  let m;
  while ((m = re.exec(txt))) {
    total++;
    const tag = openTag(txt, m.index);
    const line = txt.slice(0, m.index).split('\n').length;
    if (/aria-label(ledby)?\s*=/.test(tag)) { viaAria++; continue; }
    // Tooltip bọc ngay bên ngoài với title là chuỗi -> MUI tự gắn aria-label.
    const before = txt.slice(Math.max(0, m.index - 400), m.index);
    const tip = before.match(/<Tooltip\b[^]*?title=(\{?['"`][^'"`]+['"`]\}?|\{[^}]+\})[^]*$/);
    if (tip && !/<\/Tooltip>/.test(before.slice(before.lastIndexOf('<Tooltip')))) { viaTooltip++; continue; }
    // Nút có chữ bên trong (không chỉ icon) cũng có nhãn.
    const close = txt.indexOf('</IconButton>', m.index);
    const inner = txt.slice(m.index + tag.length, close).replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').trim();
    if (inner) { viaAria++; continue; }
    // Gợi ý chức năng từ icon + onClick để dễ đặt nhãn.
    const icon = (txt.slice(m.index + tag.length, close).match(/<([A-Z]\w+)/) || [])[1] || '?';
    const onClick = (tag.match(/onClick=\{([^}]{0,60})/) || [])[1] || '';
    missing.push({ file: path.relative(SRC, f).replace(/\\/g, '/'), line, icon, onClick: onClick.trim() });
  }
}
console.log(`Tổng <IconButton>: ${total}`);
console.log(`  có aria-label/nội dung chữ : ${viaAria}`);
console.log(`  được Tooltip gắn nhãn       : ${viaTooltip}`);
console.log(`  THIẾU NHÃN                  : ${missing.length}\n`);
for (const x of missing) console.log(`  ${x.file}:${x.line}  <${x.icon}>  ${x.onClick}`);

process.exitCode = missing.length ? 1 : 0;
