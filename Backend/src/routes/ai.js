const express = require('express');
const multer = require('multer');
const { authMiddleware } = require('../middleware/auth');
const { classifyImage } = require('../controllers/aiController');
const { isSupportedImageBuffer } = require('../utils/imageSignature');

// memoryStorage giữ nguyên tệp trong RAM, nên phải chặn tệp không phải ảnh ngay từ
// fileFilter. Giới hạn 5MB giữ đúng con số dùng ở middleware/upload.js.
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Lỗi multer (sai định dạng, quá dung lượng) là lỗi phía client. Không gắn statusCode
// thì errorHandler trả 500, giống cách middleware/uploadImages.js đã xử lý.
const uploadImage = (req, res, next) => {
  upload.single('image')(req, res, (error) => {
    if (error) {
      error.statusCode = 400;
      next(error);
      return;
    }
    next();
  });
};

// mimetype do client khai nên không tin được. Buffer vẫn còn trong RAM ở đây, đủ để
// đối chiếu magic bytes trước khi gửi tệp sang Gemini.
const verifyImageSignature = (req, res, next) => {
  if (req.file && !isSupportedImageBuffer(req.file.buffer)) {
    return res.status(400).json({ success: false, message: 'Tệp tải lên không phải ảnh hợp lệ' });
  }
  next();
};

const router = express.Router();

// @route POST /api/ai/classify-image
router.post('/classify-image', authMiddleware, uploadImage, verifyImageSignature, classifyImage);

module.exports = router;
