const upload = require('./upload');
const cloudinary = require('../config/cloudinary');

/**
 * Bọc multer để mọi ảnh đã lên Cloudinary được thu hồi nếu cả batch upload lỗi
 * (quá số lượng, sai định dạng, quá dung lượng...). Nếu không có lớp này,
 * các file đứng trước file gây lỗi có thể trở thành dữ liệu rác.
 */
const uploadImages = (fieldName, maxCount) => {
  const middleware = upload.array(fieldName, maxCount);

  return (req, res, next) => {
    middleware(req, res, async (error) => {
      if (!error) {
        next();
        return;
      }

      const uploadedFiles = Array.isArray(req.files) ? req.files : [];
      await Promise.allSettled(
        uploadedFiles
          .map((file) => file.filename)
          .filter(Boolean)
          .map((publicId) => cloudinary.uploader.destroy(publicId))
      );

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
