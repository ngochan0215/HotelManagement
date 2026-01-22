import multer from "multer";

// Cấu hình multer để lưu ảnh tạm thời trong memory để xử lý QR code
const memoryStorage = multer.memoryStorage();

export const uploadQRImage = multer({
  storage: memoryStorage, // Lưu trong memory để xử lý nhanh
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    // Chỉ chấp nhận file ảnh
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file ảnh"), false);
    }
  }
});
