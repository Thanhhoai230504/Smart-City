const EventEmitter = require('events');

jest.mock('../../src/middleware/upload', () => ({ array: jest.fn() }));
jest.mock('../../src/config/cloudinary', () => ({ uploader: { destroy: jest.fn() } }));

const upload = require('../../src/middleware/upload');
const cloudinary = require('../../src/config/cloudinary');
const uploadImages = require('../../src/middleware/uploadImages');

/** multer giả: gắn req.files như thể đã tải xong lên Cloudinary rồi gọi callback. */
const fakeMulter = (files, error) => (req, res, cb) => {
  req.files = files;
  cb(error);
};

const makeRes = () => Object.assign(new EventEmitter(), { statusCode: 200 });
const flush = () => new Promise((resolve) => setImmediate(resolve));

const FILES = [{ filename: 'smart-city-issues/a' }, { filename: 'smart-city-issues/b' }];

describe('middleware/uploadImages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cloudinary.uploader.destroy.mockResolvedValue({ result: 'ok' });
  });

  const run = (files, error) => {
    upload.array.mockReturnValue(fakeMulter(files, error));
    const middleware = uploadImages('images', 5);
    const req = {};
    const res = makeRes();
    const next = jest.fn();
    middleware(req, res, next);
    return { req, res, next };
  };

  // multipart phải qua multer mới có req.body nên validator chạy SAU bước upload: phiếu
  // bị từ chối vì dữ liệu sai từng để lại ảnh trên Cloudinary, không phiếu nào giữ.
  it('thu hồi ảnh vừa tải khi request kết thúc bằng lỗi (vd. validator từ chối)', async () => {
    const { res, next } = run(FILES);
    expect(next).toHaveBeenCalledWith();

    res.statusCode = 400;
    res.emit('finish');
    await flush();

    expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(2);
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('smart-city-issues/a');
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('smart-city-issues/b');
  });

  it('giữ ảnh khi request thành công (đã có phiếu giữ ảnh)', async () => {
    const { res } = run(FILES);

    res.statusCode = 201;
    res.emit('finish');
    await flush();

    expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
  });

  it('lỗi đồng bộ của Cloudinary lúc thu hồi không làm sập tiến trình', async () => {
    cloudinary.uploader.destroy.mockImplementation(() => { throw new Error('boom'); });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { res } = run(FILES);

    res.statusCode = 500;
    expect(() => res.emit('finish')).not.toThrow();
    await flush();

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('không có ảnh nào thì không theo dõi response', () => {
    const { res } = run([]);
    expect(res.listenerCount('finish')).toBe(0);
  });

  it('lỗi giữa chừng của multer: thu hồi ngay và trả 400 kèm câu báo tiếng Việt', async () => {
    const multerError = Object.assign(new Error('File too large'), { code: 'LIMIT_FILE_SIZE' });
    const { next } = run(FILES, multerError);
    await flush();

    expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 400,
      message: 'Mỗi ảnh có dung lượng tối đa 5MB.',
    }));
  });
});
