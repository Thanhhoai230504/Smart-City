import React, { useState } from 'react';
import {
  Button, Menu, MenuItem, ListItemIcon, ListItemText, CircularProgress,
} from '@mui/material';
import { FileDownload, TableChart, PictureAsPdf } from '@mui/icons-material';
import { issueApi } from '../../api/issueApi';
import { CATEGORY_MAP, STATUS_MAP } from '../../utils/constants';

const ExportButton: React.FC = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [exporting, setExporting] = useState(false);

  const fetchAllIssues = async () => {
    const { data } = await issueApi.getIssues({ limit: 1000, sort: '-createdAt' });
    return data.data.issues;
  };

  const handleExportExcel = async () => {
    setAnchorEl(null);
    setExporting(true);
    try {
      const issues = await fetchAllIssues();
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
      const issues = await fetchAllIssues();
      const now = new Date();
      const dateStr = `ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`;

      const tableRows = issues.map((issue: any, idx: number) => `
        <tr>
          <td style="text-align:center">${idx + 1}</td>
          <td>${issue.title || ''}</td>
          <td>${CATEGORY_MAP[issue.category]?.label || issue.category}</td>
          <td>${STATUS_MAP[issue.status]?.label || issue.status}</td>
          <td>${issue.location || ''}</td>
          <td>${typeof issue.userId === 'object' ? issue.userId.name : 'N/A'}</td>
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
        PaperProps={{ sx: { bgcolor: 'background.paper', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' } }}>
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
