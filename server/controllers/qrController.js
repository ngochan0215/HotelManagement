import { Jimp } from "jimp";
import jsQR from "jsqr";

// Quét mã QR từ ảnh và trả về thông tin
export const scanQRCode = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng tải lên một ảnh chứa mã QR"
      });
    }

    // Đọc ảnh từ buffer (vì dùng memory storage)
    const imageBuffer = req.file.buffer;
    
    // Đọc và xử lý ảnh bằng Jimp
    const image = await Jimp.read(imageBuffer);
    
    // Chuyển đổi ảnh sang định dạng mà jsQR có thể đọc (RGBA)
    const qrImage = {
      data: new Uint8ClampedArray(image.bitmap.data),
      width: image.bitmap.width,
      height: image.bitmap.height
    };

    // Giải mã QR code
    const code = jsQR(qrImage.data, qrImage.width, qrImage.height);

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Không tìm thấy mã QR trong ảnh. Vui lòng thử lại với ảnh rõ hơn."
      });
    }

    // Lấy dữ liệu từ QR code
    const qrData = code.data;
    let parsedData = null;

    if (qrData.includes("||") && qrData.includes("|")) {
      const [cccd, rest] = qrData.split("||");
      const parts = rest.split("|");

      if (parts.length >= 5) {
        parsedData = {
          cccd: cccd.trim(),
          fullName: parts[0]?.trim() || "",
          dateOfBirth: parts[1]?.trim() || "",
          gender: parts[2]?.trim() || "",
          address: parts[3]?.trim() || "",
          issueDate: parts[4]?.trim() || ""
        };
      }
    }

    // fallback: nếu không đúng format trên → thử JSON
    if (!parsedData) {
      try {
        parsedData = JSON.parse(qrData);
      } catch {
        parsedData = qrData;
      }
    }

    return res.status(200).json({
      success: true,
      message: "Quét mã QR thành công",
      data: parsedData,
      rawData: qrData
    });

  } catch (error) {
    console.error("Error scanning QR code:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi xử lý ảnh: " + error.message
    });
  }
};
