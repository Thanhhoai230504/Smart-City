const { logger } = require('../../src/utils/logger');
const Issue = require('../../src/models/Issue');

/**
 * Từ 01/07/2025 Đà Nẵng bỏ cấp quận/huyện và sáp nhập Quảng Nam (94 đơn vị cấp
 * xã), nhưng hệ thống vẫn suy khu vực bằng cách tìm tên 8 quận cũ trong chuỗi
 * địa chỉ (KE-HOACH-FLUTTER-APP.md mục 5.1). Địa chỉ ở Hội An, Tam Kỳ hay ghi
 * theo phường mới rơi vào "Khác" mà KHÔNG để lại dấu vết gì: thống kê theo khu
 * vực lệch, thông báo theo khu vực ngừng gửi, và không ai biết vì sao.
 *
 * Log này không sửa mô hình — nó biến lỗi im lặng thành thứ đếm được, và giữ
 * lại toạ độ để sau này backfill theo vị trí khi đổi sang mô hình mới.
 */
const build = (location, extra = {}) => new Issue({
  title: 'Ổ gà',
  description: 'Ổ gà lớn giữa đường',
  category: 'pothole',
  location,
  latitude: 15.8801,
  longitude: 108.338,
  userId: '507f1f77bcf86cd799439011',
  ...extra,
});

describe('Issue — cảnh báo khi không xác định được khu vực', () => {
  let warn;
  beforeEach(() => { warn = jest.spyOn(logger, 'warn').mockImplementation(() => {}); });
  afterEach(() => warn.mockRestore());

  it('logs a structured warning with coordinates when the district is unknown', async () => {
    const issue = build('12 Trần Phú, phường Hội An, thành phố Đà Nẵng');
    await issue.validate();

    expect(issue.district).toBe('Khác');
    expect(warn).toHaveBeenCalledTimes(1);
    const [, meta] = warn.mock.calls[0];
    expect(meta).toEqual(expect.objectContaining({
      event: 'district_unresolved',
      location: '12 Trần Phú, phường Hội An, thành phố Đà Nẵng',
      latitude: 15.8801,
      longitude: 108.338,
    }));
  });

  it('stays silent when the district is recognised', async () => {
    const issue = build('1 Trần Hưng Đạo, Hải Châu, Đà Nẵng');
    await issue.validate();

    expect(issue.district).toBe('Hải Châu');
    expect(warn).not.toHaveBeenCalled();
  });

  // Sửa một field khác (vd. trạng thái) không được log lại mỗi lần lưu, nếu
  // không một phiếu "Khác" sẽ sinh cảnh báo trùng lặp suốt vòng đời của nó.
  it('does not warn again when the location has not changed', async () => {
    // hydrate = bản ghi đọc lên từ DB: không phải bản mới, chưa sửa field nào.
    const issue = Issue.hydrate({
      _id: '507f1f77bcf86cd799439099',
      title: 'Ổ gà', description: 'Ổ gà lớn giữa đường', category: 'pothole',
      location: 'phường Tam Kỳ, thành phố Đà Nẵng', district: 'Khác',
      latitude: 15.57, longitude: 108.47, userId: '507f1f77bcf86cd799439011',
      status: 'reported',
    });
    issue.status = 'processing';
    await issue.validate();

    expect(warn).not.toHaveBeenCalled();
  });

  it('warns when an existing issue is edited to an unrecognised address', async () => {
    const issue = Issue.hydrate({
      _id: '507f1f77bcf86cd799439098',
      title: 'Ổ gà', description: 'Ổ gà lớn giữa đường', category: 'pothole',
      location: '1 Trần Hưng Đạo, Hải Châu, Đà Nẵng', district: 'Hải Châu',
      latitude: 16.06, longitude: 108.22, userId: '507f1f77bcf86cd799439011',
      status: 'reported',
    });
    issue.location = 'phường Tam Kỳ, thành phố Đà Nẵng';
    await issue.validate();

    expect(issue.district).toBe('Khác');
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
