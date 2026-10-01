import React, { useState } from 'react';
import {
  Button, Menu, MenuItem, ListItemIcon, ListItemText, CircularProgress,
} from '@mui/material';
import { FileDownload, TableChart, PictureAsPdf } from '@mui/icons-material';
import { issueApi } from '../../api/issueApi';
import { CATEGORY_MAP, STATUS_MAP } from '../../utils/constants';
import { escapeHtml } from '../../utils/helpers';

const ExportButton: React.FC = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [exporting, setExporting] = useState(false);

  /**
   * Trần số bản ghi một lần xuất.
   *
   * Trước đây hàm này lặp tới HẾT số trang, nên số request tỉ lệ thuận với tổng
   * số phiếu: 50.000 phiếu là 500 request — vừa đủ tự đụng `generalLimiter`
   * (500 req/15 phút), tức chức năng xuất tự chặn chính nó. Toàn bộ kết quả còn
   * tích luỹ trong RAM trình duyệt kèm trường mô tả dài tới 2000 ký tự.
   *
   * Trần 5.000 ứng với tối đa 50 request — rộng hơn nhiều so với nhu cầu thật
   * mà vẫn an toàn. Vượt trần thì báo rõ cho người dùng thay vì cắt im lặng.
   */
  const MAX_EXPORT_ROWS = 5000;
  const PAGE_SIZE = 100;
  const MAX_PAGES = MAX_EXPORT_ROWS / PAGE_SIZE;

  /** @returns {{ issues: any[], truncated: boolean, total: number }} */
  const fetchAllIssues = async () => {
    const { data: firstResponse } = await issueApi.getIssues({
      page: 1,
      limit: PAGE_SIZE,
      sort: '-createdAt',
    });
    const allIssues = [...firstResponse.data.issues];
    const total = firstResponse.data.pagination.total;
    const totalPages = Math.min(firstResponse.data.pagination.pages, MAX_PAGES);

    // Tải theo lô nhỏ để không tạo hàng trăm request đồng thời khi dữ liệu lớn.
    for (let startPage = 2; startPage <= totalPages; startPage += 4) {
      const pages = Array.from(
        { length: Math.min(4, totalPages - startPage + 1) },
        (_, index) => startPage + index
      );
      const responses = await Promise.all(
        pages.map((page) => issueApi.getIssues({ page, limit: PAGE_SIZE, sort: '-createdAt' }))
      );
      responses.forEach((response) => allIssues.push(...response.data.data.issues));
    }

    return { issues: allIssues, truncated: total > allIssues.length, total };
  };

  const handleExportExcel = async () => {
    setAnchorEl(null);
    setExporting(true);
    try {
      const { issues, truncated, total } = await fetchAllIssues();
      if (truncated) {
        // Báo rõ thay vì cắt im lặng — người dùng cần biết file không đầy đủ.
        window.alert(
          `Dữ liệu có ${total} sự cố, vượt giới hạn mỗi lần xuất.\n`
          + `File sẽ chứa ${issues.length} sự cố mới nhất.\n\n`
          + 'Hãy dùng bộ lọc (trạng thái, khoảng thời gian) để thu hẹp phạm vi nếu cần đầy đủ.'
        );
      }
      const XLSX = await import('xlsx');

      const rows = issues.map((issue: any, idx: number) => ({
        'STT': idx + 1,
        'Tiêu đề': issue.title,
        'Mô tả': issue.description,
        'Danh mục': CATEGORY_MAP[issue.category]?.label || issue.category,
        'Trạng thái': STATUS_MAP[issue.status]?.label || issue.status,
        'Vị trí': issue.location,
        'Kinh độ': issue.longitude,
        'Vĩ độ': issue.latitude,
        'Người báo cáo': typeof issue.userId === 'object' ? issue.userId.name : 'N/A',
        'Ngày báo cáo': new Date(issue.createdAt).toLocaleDateString('vi-VN'),
        'Ngày xử lý': issue.resolvedAt ? new Date(issue.resolvedAt).toLocaleDateString('vi-VN') : '',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Danh sách sự cố');

      // Auto-fit columns
      const colWidths = Object.keys(rows[0] || {}).map((key) => ({
        wch: Math.max(key.length, ...rows.map((r: any) => String(r[key] || '').length)) + 2,
      }));
      ws['!cols'] = colWidths;

      XLSX.writeFile(wb, `BaoCao_SuCo_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error('Export Excel failed:', err);
    }
    setExporting(false);
  };

  const handleExportPDF = async () => {
    setAnchorEl(null);
    setExporting(true);
    try {
      const { issues, truncated, total } = await fetchAllIssues();
      if (truncated) {
        window.alert(
          `Dữ liệu có ${total} sự cố, vượt giới hạn mỗi lần xuất.\n`
          + `Báo cáo sẽ chứa ${issues.length} sự cố mới nhất.\n\n`
          + 'Hãy dùng bộ lọc (trạng thái, khoảng thời gian) để thu hẹp phạm vi nếu cần đầy đủ.'
        );
      }
      const now = new Date();
      const dateStr = `ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`;

      // Mọi ô lấy từ dữ liệu người dùng đều qua escapeHtml — xem ghi chú ở hàm đó.
      // escapeHtml trả '' cho null/undefined nên không cần `|| ''` nữa.
      const tableRows = issues.map((issue: any, idx: number) => `
        <tr>
          <td style="text-align:center">${idx + 1}</td>
          <td>${escapeHtml(issue.title)}</td>
          <td>${escapeHtml(CATEGORY_MAP[issue.category]?.label || issue.category)}</td>
          <td>${escapeHtml(STATUS_MAP[issue.status]?.label || issue.status)}</td>
          <td>${escapeHtml(issue.location)}</td>
          <td>${escapeHtml(typeof issue.userId === 'object' ? issue.userId.name : 'N/A')}</td>
          <td style="text-align:center">${new Date(issue.createdAt).toLocaleDateString('vi-VN')}</td>
        </tr>`).join('');

      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Báo cáo sự cố đô thị</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Roboto', 'Times New Roman', serif; color: #1a1a1a; padding: 30px; }
  .header { text-align: center; margin-bottom: 20px; }
  .header h2 { font-size: 18px; text-transform: uppercase; letter-spacing: 1px; }
  .header p { font-size: 12px; color: #555; margin-top: 4px; }
  .header hr { border: none; border-top: 2px solid #0EA5E9; margin: 10px 100px 0; }
  .meta { display: flex; justify-content: space-between; margin: 15px 0; font-size: 12px; color: #555; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
  th { background: #0EA5E9; color: white; padding: 8px 6px; text-align: left; font-weight: 600; }
  td { padding: 6px; border: 1px solid #ddd; }
  tr:nth-child(even) { background: #f8f9fa; }
  .footer { text-align: center; font-size: 9px; color: #999; margin-top: 30px; border-top: 1px solid #eee; padding-top: 8px; }
  @media print { body { padding: 15px; } .no-print { display: none; } }
</style></head><body>
  <div class="no-print" style="text-align:center;margin-bottom:15px">
    <button onclick="window.print()" style="padding:10px 30px;font-size:14px;background:#0EA5E9;color:white;border:none;border-radius:8px;cursor:pointer">🖨️ In / Lưu PDF</button>
  </div>
  <div class="header">
    <h2>Báo cáo sự cố đô thị — Đà Nẵng</h2>
    <p>Hệ thống Giám sát Đô thị Thông minh</p>
    <hr/>
  </div>
  <div class="meta">
    <span>Tổng số sự cố: <strong>${issues.length}</strong></span>
    <span>Ngày xuất: ${dateStr}</span>
  </div>
  <table>
    <thead><tr>
      <th style="width:40px">STT</th><th>Tiêu đề</th><th style="width:100px">Danh mục</th>
      <th style="width:90px">Trạng thái</th><th>Vị trí</th>
      <th style="width:110px">Người báo cáo</th><th style="width:80px">Ngày</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="footer">Tài liệu được tạo tự động bởi Hệ thống Giám sát Đô thị Thông minh Đà Nẵng</div>
</body></html>`;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
      }
    } catch (err) {
      console.error('Export PDF failed:', err);
    }
    setExporting(false);
  };

  return (
    <>
      <Button
        variant="outlined" size="small"
        startIcon={exporting ? <CircularProgress size={14} /> : <FileDownload />}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        disabled={exporting}
        sx={{ borderRadius: '10px', textTransform: 'none', fontSize: '0.8rem', fontWeight: 600, height: 32 }}
      >
        Xuất báo cáo
      </Button>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}
        PaperProps={{ sx: { bgcolor: 'background.paper', border: '1px solid #DCE7EB', borderRadius: '12px' } }}>
        <MenuItem onClick={handleExportExcel}>
          <ListItemIcon><TableChart sx={{ color: '#10B981' }} /></ListItemIcon>
          <ListItemText primary="Excel (.xlsx)" secondary="Xuất danh sách chi tiết" />
        </MenuItem>
        <MenuItem onClick={handleExportPDF}>
          <ListItemIcon><PictureAsPdf sx={{ color: '#EF4444' }} /></ListItemIcon>
          <ListItemText primary="PDF" secondary="Xuất báo cáo tổng hợp" />
        </MenuItem>
      </Menu>
    </>
  );
};

export default ExportButton;
