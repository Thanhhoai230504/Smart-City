/**
 * Chống chèn HTML vào email.
 *
 * Tên người dùng, tiêu đề, địa chỉ và ghi chú đều do người dùng nhập. Email gửi
 * đi từ chính hệ thống nên người nhận tin tưởng nó; một tiêu đề sự cố dạng
 * `<a href="...">Xác minh tài khoản quản trị</a>` sẽ thành một đường link lừa
 * đảo nằm trong email chính thức gửi tới cán bộ và admin. Mail client chặn
 * script, nhưng KHÔNG chặn link, ảnh theo dõi hay HTML giả giao diện.
 */
const templates = require('../../src/utils/emailTemplates');
const { escapeHtml } = require('../../src/utils/escapeHtml');

const EVIL = '<img src=x onerror=alert(1)><a href="https://evil.example">Bấm vào đây</a>';

const expectSafe = (html) => {
  expect(html).not.toContain('<img src=x');
  expect(html).not.toContain('href="https://evil.example"');
  expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
};

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`))
      .toBe('&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
  });

  // Thay & trước tiên, nếu không '&lt;' đã escape sẽ thành '&amp;lt;'.
  it('does not double-escape', () => {
    expect(escapeHtml('a & b <c>')).toBe('a &amp; b &lt;c&gt;');
  });

  it('keeps Vietnamese text untouched', () => {
    expect(escapeHtml('Ổ gà đường Nguyễn Văn Linh')).toBe('Ổ gà đường Nguyễn Văn Linh');
  });

  it('turns null and undefined into an empty string, but keeps 0', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(0)).toBe('0');
  });
});

describe('email templates escape user-supplied fields', () => {
  const base = { issueId: '64b000000000000000000001', clientUrl: 'https://app.example' };

  it('verification email — userName', () => {
    expectSafe(templates.buildVerificationEmail({ userName: EVIL, verificationUrl: 'https://app.example/v' }));
  });

  it('password reset email — userName', () => {
    expectSafe(templates.buildPasswordResetEmail({ userName: EVIL, resetUrl: 'https://app.example/r', expiresMinutes: 30 }));
  });

  it('status change email — userName, issueTitle and note', () => {
    for (const field of ['userName', 'issueTitle', 'note']) {
      const args = { ...base, userName: 'An', issueTitle: 'Ổ gà', note: 'ok', newStatus: 'resolved', [field]: EVIL };
      expectSafe(templates.buildStatusChangeEmail(args));
    }
  });

  it('rating request email — userName and issueTitle', () => {
    for (const field of ['userName', 'issueTitle']) {
      const args = { ...base, userName: 'An', issueTitle: 'Ổ gà', [field]: EVIL };
      expectSafe(templates.buildRatingRequestEmail(args));
    }
  });

  it('assignment email — departmentName, issueTitle and location', () => {
    for (const field of ['departmentName', 'issueTitle', 'location']) {
      const args = {
        ...base, departmentName: 'Đơn vị', issueTitle: 'Ổ gà', category: 'pothole',
        location: 'Hải Châu', dueAt: new Date(), slaHours: 72, [field]: EVIL,
      };
      expectSafe(templates.buildAssignmentEmail(args));
    }
  });

  it('SLA reminder email — recipientName, issue title and location', () => {
    expectSafe(templates.buildSlaReminderEmail({
      ...base, recipientName: EVIL,
      issues: [{ _id: base.issueId, title: 'Ổ gà', location: 'Hải Châu', overdueHours: 3 }],
    }));
    expectSafe(templates.buildSlaReminderEmail({
      ...base, recipientName: 'An',
      issues: [{ _id: base.issueId, title: EVIL, location: EVIL, overdueHours: 3 }],
    }));
  });

  it('SLA escalation email — adminName, issue title and department name', () => {
    expectSafe(templates.buildSlaEscalationEmail({
      ...base, adminName: EVIL,
      issues: [{ _id: base.issueId, title: 'Ổ gà', departmentName: 'Đơn vị', overdueHours: 3 }],
    }));
    expectSafe(templates.buildSlaEscalationEmail({
      ...base, adminName: 'An',
      issues: [{ _id: base.issueId, title: EVIL, departmentName: EVIL, overdueHours: 3 }],
    }));
  });

  // Escape không được làm hỏng nội dung hợp lệ có dấu và dấu &.
  it('still renders legitimate Vietnamese content correctly', () => {
    const html = templates.buildStatusChangeEmail({
      ...base, userName: 'Nguyễn Văn A', issueTitle: 'Ngập nước & cây đổ', note: 'Đã xử lý', newStatus: 'resolved',
    });
    expect(html).toContain('Nguyễn Văn A');
    expect(html).toContain('Ngập nước &amp; cây đổ');
  });
});
