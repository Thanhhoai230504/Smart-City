const Issue = require('../../src/models/Issue');

// E3: giới hạn 500 ký tự của statusHistory.note trước đây CHỈ tồn tại ở client
// (UpdateStatusDialog.tsx), model không có maxlength nên gọi API thẳng là bỏ qua.
// App mobile sẽ là client thứ hai — ràng buộc phải nằm ở server.
const baseIssue = (note) => new Issue({
  title: 'Ổ gà',
  description: 'Ổ gà lớn giữa đường',
  category: 'pothole',
  location: 'Đường Nguyễn Văn Linh, Hải Châu, Đà Nẵng',
  latitude: 16.0544,
  longitude: 108.2022,
  userId: '507f1f77bcf86cd799439011',
  statusHistory: [{ status: 'processing', changedBy: '507f1f77bcf86cd799439012', note }],
});

describe('Issue statusHistory.note schema', () => {
  it('accepts a note within 500 characters', async () => {
    await expect(baseIssue('Đã phân công cho đơn vị').validate()).resolves.toBeUndefined();
  });

  it('rejects a note longer than 500 characters', async () => {
    await expect(baseIssue('a'.repeat(501)).validate()).rejects.toThrow(/500/);
  });

  it('trims surrounding whitespace from the note', async () => {
    const issue = baseIssue('  Đã xử lý xong  ');
    await issue.validate();
    expect(issue.statusHistory[0].note).toBe('Đã xử lý xong');
  });

  it('defaults the note to an empty string', async () => {
    const issue = baseIssue(undefined);
    await issue.validate();
    expect(issue.statusHistory[0].note).toBe('');
  });
});

// E6: hạn tiếp nhận phải được sinh ở MODEL để mọi đường ghi (create, seed,
// script) đều có, giống cách `district` và `geo` đang được xử lý. Đặt trong
// service sẽ bỏ sót seed và backfill.
describe('Issue intake deadline schema', () => {
  const base = {
    title: 'Ổ gà',
    description: 'Ổ gà lớn giữa đường',
    category: 'pothole',
    location: 'Đường Nguyễn Văn Linh, Hải Châu, Đà Nẵng',
    latitude: 16.0544,
    longitude: 108.2022,
    userId: '507f1f77bcf86cd799439011',
  };

  it('derives intakeDueAt from the category when a new issue is validated', async () => {
    const issue = new Issue(base);
    await issue.validate();
    expect(issue.intakeDueAt).toBeInstanceOf(Date);
    // pothole = 24 giờ tiếp nhận
    const hours = (issue.intakeDueAt.getTime() - Date.now()) / 3600000;
    expect(hours).toBeGreaterThan(23);
    expect(hours).toBeLessThan(25);
  });

  it('does not overwrite an existing intakeDueAt', async () => {
    const fixed = new Date('2026-01-01T00:00:00Z');
    const issue = new Issue({ ...base, intakeDueAt: fixed });
    await issue.validate();
    expect(issue.intakeDueAt).toEqual(fixed);
  });

  it('indexes the unassigned-intake cron query', () => {
    const indexes = Issue.schema.indexes();
    expect(indexes.some(([f]) => f.departmentId === 1 && f.intakeDueAt === 1)).toBe(true);
  });
});
