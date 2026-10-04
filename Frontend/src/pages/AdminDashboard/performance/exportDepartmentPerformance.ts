import type { DepartmentEvaluation, DepartmentPerformanceDetail, DepartmentPerformanceResponse } from '../../../types';
import {
  buildCriteriaRows,
  buildDetailSheets,
  buildRankingRows,
  exportFileName,
  SheetRow,
} from '../../../utils/performanceExport';

/**
 * Ghi file Excel đánh giá đơn vị. Dữ liệu dựng ở utils/performanceExport (có test);
 * ở đây chỉ nạp xlsx khi cần (tách khỏi bundle chính, như ExportButton) và ghi file.
 */
const autoWidth = (rows: SheetRow[]) => Object.keys(rows[0] || {}).map((key) => ({
  wch: Math.min(60, Math.max(key.length, ...rows.map((r) => String(r[key] ?? '').length)) + 2),
}));

const CRITERIA_COLS = [{ wch: 32 }, { wch: 100 }];

export const exportRankingWorkbook = async (data: DepartmentPerformanceResponse) => {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const rows = buildRankingRows(data);
  const ranking = rows.length
    ? XLSX.utils.json_to_sheet(rows)
    : XLSX.utils.aoa_to_sheet([['Không có đơn vị nào để đánh giá trong kỳ']]);
  if (rows.length) ranking['!cols'] = autoWidth(rows);
  XLSX.utils.book_append_sheet(wb, ranking, 'Xếp hạng');
  const criteria = XLSX.utils.aoa_to_sheet(buildCriteriaRows(data.config, data.period));
  criteria['!cols'] = CRITERIA_COLS;
  XLSX.utils.book_append_sheet(wb, criteria, 'Tiêu chí');
  XLSX.writeFile(wb, exportFileName('DanhGia_DonVi', data.period));
};

/** Kèm lịch sử quyết định của lãnh đạo (sheet "Quyết định") nếu có. */
export const exportDetailWorkbook = async (detail: DepartmentPerformanceDetail, evaluations: DepartmentEvaluation[] = []) => {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  for (const sheet of buildDetailSheets(detail, evaluations)) {
    const ws = sheet.rows.length
      ? XLSX.utils.json_to_sheet(sheet.rows)
      : XLSX.utils.aoa_to_sheet([['Không có dữ liệu trong kỳ']]);
    if (sheet.rows.length) ws['!cols'] = autoWidth(sheet.rows);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  const criteria = XLSX.utils.aoa_to_sheet(buildCriteriaRows(detail.config, detail.period));
  criteria['!cols'] = CRITERIA_COLS;
  XLSX.utils.book_append_sheet(wb, criteria, 'Tiêu chí');
  XLSX.writeFile(wb, exportFileName(`DanhGia_${detail.department.code}`, detail.period));
};
