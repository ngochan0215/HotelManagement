import { Jimp } from "jimp";
import jsQR from "jsqr";

export const scanQRCodeService = async (imageBuffer) => {
  if (!imageBuffer) {
    throw new Error("Vui lòng tải lên một ảnh chứa mã QR");
  }

  // Read image
  const image = await Jimp.read(imageBuffer);

  const qrImage = {
    data: new Uint8ClampedArray(image.bitmap.data),
    width: image.bitmap.width,
    height: image.bitmap.height,
  };

  const code = jsQR(qrImage.data, qrImage.width, qrImage.height);

  if (!code) {
    throw new Error(
      "Không tìm thấy mã QR trong ảnh. Vui lòng thử lại với ảnh rõ hơn."
    );
  }

  const qrData = code.data;
  let parsedData = null;

  // CCCD format
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
        issueDate: parts[4]?.trim() || "",
      };
    }
  }

  // Fallback JSON
  if (!parsedData) {
    try {
      parsedData = JSON.parse(qrData);
    } catch {
      parsedData = qrData;
    }
  }

  return {
    parsedData,
    rawData: qrData,
  };
};

export const scanQRCode = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Vui lòng tải lên một ảnh." });
    }

    const result = await scanQRCodeService(req.file.buffer);
    
    return res.status(200).json({
      success: true,
      message: "Quét mã QR thành công",
      data: result.parsedData,
      rawData: result.rawData,
    });

  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};