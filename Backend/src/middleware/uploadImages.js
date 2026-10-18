const upload = require('./upload');
const cloudinary = require('../config/cloudinary');

/**
 * Xoá trên Cloudinary các ảnh multer vừa tải lên trong request này. Không bao giờ ném
 * lỗi (kể cả lỗi đồng bộ của SDK): hàm còn được gọi từ sự kiện `finish` của response,
 * nơi một exception sẽ làm sập tiến trình.
 */
const discardUploadedFiles = async (files) => {
  const publicIds = (Array.isArray(files) ? files : [])
    .map((file) => file.filename)
    .filter(Boolean);
  const results = await Promise.allSettled(
    publicIds.map(async (publicId) => cloudinary.uploader.destroy(publicId))
  );
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length) {
    console.error(`⚠️  Không thu hồi được ${failed.length}/${publicIds.length} ảnh vừa tải:`, failed[0].reason?.message);
  }
};

/**
 * Bọc multer để ảnh đã lên Cloudinary không thành dữ liệu rác:
 *
 * - Cả batch upload lỗi (quá số lượng, sai định dạng, quá dung lượng...): thu hồi ngay
 *   các file đứng trước file gây lỗi.
 * - Upload xong nhưng request vẫn kết thúc bằng lỗi: thu hồi khi response kết thúc.
 *   multipart phải qua multer mới có `req.body`, nên validator luôn chạy SAU bước upload.
 *   Trước đây phiếu bị từ chối vì dữ liệu sai (tiêu đề quá ngắn, thiếu toạ độ...) vẫn để
 *   lại ảnh trên Cloudinary, không phiếu nào giữ và không ai xoá.
 *
 * Quy tắc: ảnh chỉ được giữ khi request thành công (status < 400), tức đã có phiếu giữ
 * nó. Service vẫn tự xoá ảnh khi ghi lỗi; xoá lần hai không sao (Cloudinary trả "not
 * found"). Ngược lại service KHÔNG được trả lỗi sau khi đã lưu ảnh vào phiếu.
 */
const uploadImages = (fieldName, maxCount) => {
  const middleware = upload.array(fieldName, maxCount);

  return (req, res, next) => {
    middleware(req, res, async (error) => {
      if (!error) {
        if (Array.isArray(req.files) && req.files.length) {
          res.on('finish', () => {
            if (res.statusCode < 400) return;
            discardUploadedFiles(req.files).catch((err) => {
              console.error('⚠️  Lỗi khi thu hồi ảnh vừa tải:', err.message);
            });
          });
        }
        next();
        return;
      }

      await discardUploadedFiles(req.files);

      error.statusCode = 400;
      if (error.code === 'LIMIT_UNEXPECTED_FILE') {
        error.message = `Chỉ được tải tối đa ${maxCount} ảnh trong trường "${fieldName}".`;
      } else if (error.code === 'LIMIT_FILE_SIZE') {
        error.message = 'Mỗi ảnh có dung lượng tối đa 5MB.';
      }
      next(error);
    });
  };
};

module.exports = uploadImages;
module.exports.discardUploadedFiles = discardUploadedFiles;
