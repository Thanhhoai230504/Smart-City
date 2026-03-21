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
      const { default: jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF({ orientation: 'landscape' });

      doc.setFontSize(16);
      doc.text('BAO CAO SU CO DO THI - DA NANG', 14, 15);
      doc.setFontSize(10);
      doc.text(`Ngay xuat: ${new Date().toLocaleDateString('vi-VN')}`, 14, 22);
      doc.text(`Tong so su co: ${issues.length}`, 14, 28);

      const tableData = issues.map((issue: any, idx: number) => [
        idx + 1,
        issue.title?.substring(0, 40) || '',
        CATEGORY_MAP[issue.category]?.label || issue.category,
        STATUS_MAP[issue.status]?.label || issue.status,
        issue.location?.substring(0, 30) || '',
        typeof issue.userId === 'object' ? issue.userId.name : 'N/A',
        new Date(issue.createdAt).toLocaleDateString('vi-VN'),
      ]);

      autoTable(doc, {
        startY: 34,
        head: [['STT', 'Tieu de', 'Danh muc', 'Trang thai', 'Vi tri', 'Nguoi bao cao', 'Ngay']],
        body: tableData,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [108, 99, 255], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 250] },
      });

      doc.save(`BaoCao_SuCo_${new Date().toISOString().slice(0, 10)}.pdf`);
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
        sx={{ borderRadius: '10px', textTransform: 'none', fontSize: '0.8rem' }}
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
