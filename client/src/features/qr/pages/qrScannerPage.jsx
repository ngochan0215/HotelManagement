import { useState, useRef, useEffect } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { qrApi } from "../../api/qrApi";
import Sidebar from "../../../components/sidebar";
import Topbar from "../../../components/topbar";
import Toast from "../../../components/toast";

const QrScannerPage = () => {
  const [scanning, setScanning] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [scanningTips, setScanningTips] = useState(false);
  const [cameraInfo, setCameraInfo] = useState(null);
  const [scanStatus, setScanStatus] = useState("");
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  const scanTimeoutRef = useRef(null);
  const qualityCheckIntervalRef = useRef(null);
  const scanAttemptsRef = useRef(0);

  useEffect(() => {
    return () => {
      // Cleanup khi component unmount
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current
          .stop()
          .then(() => {
            console.log("QR Scanner stopped");
          })
          .catch((err) => {
            console.error("Error stopping scanner:", err);
          });
      }
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
      if (qualityCheckIntervalRef.current) {
        clearInterval(qualityCheckIntervalRef.current);
      }
    };
  }, []);

  // Kiểm tra quyền truy cập camera
  const checkCameraPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      
      // Lấy thông tin camera
      const capabilities = track.getCapabilities?.() || {};
      setCameraInfo({
        width: settings.width,
        height: settings.height,
        facingMode: settings.facingMode,
        hasFocus: capabilities.focusMode?.includes('continuous') || false,
      });

      // Dừng stream tạm thời
      track.stop();
      return { success: true, settings };
    } catch (err) {
      console.error("Camera permission error:", err);
      let errorMessage = "Không thể truy cập camera.";
      
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        errorMessage = "Quyền truy cập camera bị từ chối. Vui lòng cấp quyền trong cài đặt trình duyệt.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        errorMessage = "Không tìm thấy camera. Vui lòng kiểm tra kết nối camera.";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        errorMessage = "Camera đang được sử dụng bởi ứng dụng khác. Vui lòng đóng các ứng dụng khác.";
      } else if (err.name === "OverconstrainedError") {
        errorMessage = "Camera không hỗ trợ yêu cầu. Vui lòng thử camera khác.";
      }
      
      return { success: false, error: errorMessage };
    }
  };

  // Kiểm tra chất lượng camera và đưa ra gợi ý
  const checkCameraQuality = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      
      const issues = [];
      const suggestions = [];

      // Kiểm tra độ phân giải
      if (settings.width < 640 || settings.height < 480) {
        issues.push("Độ phân giải camera thấp");
        suggestions.push("Vui lòng sử dụng camera có độ phân giải cao hơn hoặc kiểm tra cài đặt camera.");
      }

      // Kiểm tra focus
      const capabilities = track.getCapabilities?.() || {};
      if (!capabilities.focusMode?.includes('continuous') && !capabilities.focusMode?.includes('single-shot')) {
        suggestions.push("Camera có thể không có tự động lấy nét. Vui lòng giữ camera cách mã QR khoảng 15-30cm.");
      }

      track.stop();
      
      if (issues.length > 0 || suggestions.length > 0) {
        return { hasIssues: true, issues, suggestions };
      }
      
      return { hasIssues: false };
    } catch (err) {
      console.error("Quality check error:", err);
      return { hasIssues: true, issues: ["Không thể kiểm tra chất lượng camera"], suggestions: [] };
    }
  };

  const startScanning = async () => {
    try {
      setError(null);
      setQrData(null);
      setScanningTips(false);

      // Kiểm tra quyền camera trước
      const permissionCheck = await checkCameraPermissions();
      if (!permissionCheck.success) {
        setError(permissionCheck.error);
        setToast({ 
          message: permissionCheck.error, 
          type: "error" 
        });
        return;
      }

      // Kiểm tra chất lượng camera
      const qualityCheck = await checkCameraQuality();
      if (qualityCheck.hasIssues) {
        const tips = [
          "Giữ camera ổn định, cách mã QR khoảng 15-30cm",
          "Đảm bảo đủ ánh sáng, tránh phản quang",
          "Làm sạch ống kính camera nếu bị mờ",
          "Đảm bảo mã QR rõ ràng, không bị mờ hoặc nhăn",
          ...qualityCheck.suggestions
        ];
        setScanningTips(true);
        setToast({ 
          message: "Camera đã sẵn sàng. Lưu ý: " + qualityCheck.issues.join(", "), 
          type: "info" 
        });
      }

      setScanning(true);
      setScanStatus("Đang khởi động camera...");
      scanAttemptsRef.current = 0;

      const html5QrCode = new Html5Qrcode("qr-reader");
      html5QrCodeRef.current = html5QrCode;

      // Thiết lập timeout để thông báo nếu quét quá lâu
      scanTimeoutRef.current = setTimeout(() => {
        setScanStatus("Đang quét... (đã thử nhiều lần)");
        setToast({ 
          message: "Chưa quét được mã QR. Vui lòng kiểm tra: ánh sáng, khoảng cách, độ rõ của mã QR", 
          type: "info" 
        });
      }, 10000); // 10 giây

      const maxAttempts = 100; // Tương đương ~6-7 giây với fps 15

      await html5QrCode.start(
        {
          facingMode: "environment", // Sử dụng camera sau
        },
        {
          fps: 15,
          qrbox: { width: 350, height: 350 },
          aspectRatio: 1.0,
        },
        async (decodedText, decodedResult) => {
          // Khi quét thành công
          setScanStatus("Đã quét thành công!");
          if (scanTimeoutRef.current) {
            clearTimeout(scanTimeoutRef.current);
          }
          if (qualityCheckIntervalRef.current) {
            clearInterval(qualityCheckIntervalRef.current);
          }
          await handleQRCodeScanned(decodedText);
          await html5QrCode.stop();
          setScanning(false);
          setScanningTips(false);
          setScanStatus("");
        },
        (errorMessage) => {
          // Đếm số lần thử quét
          scanAttemptsRef.current++;
          
          // Cập nhật trạng thái
          if (scanAttemptsRef.current === 1) {
            setScanStatus("Đang quét mã QR...");
          } else if (scanAttemptsRef.current % 30 === 0) {
            setScanStatus(`Đang quét... (đã thử ${scanAttemptsRef.current} lần)`);
          }
          
          // Nếu quét nhiều lần không thành công, đưa ra gợi ý
          if (scanAttemptsRef.current > maxAttempts && scanAttemptsRef.current % 50 === 0) {
            const suggestions = [
              "Điều chỉnh khoảng cách: quá gần hoặc quá xa đều khó quét",
              "Cải thiện ánh sáng: đảm bảo đủ sáng nhưng tránh phản quang",
              "Giữ camera ổn định, tránh rung lắc",
              "Làm sạch ống kính camera",
              "Thử quay mã QR một góc khác",
              "Nếu vẫn không được, hãy thử tải ảnh lên thay vì quét trực tiếp"
            ];
            
            const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
            setToast({ 
              message: `Chưa quét được. Gợi ý: ${randomSuggestion}`, 
              type: "info" 
            });
          }
        }
      );
    } catch (err) {
      console.error("Error starting scanner:", err);
      
      let errorMessage = "Không thể khởi động camera.";
      let suggestion = "";

      if (err.name === "NotAllowedError" || err.message?.includes("permission")) {
        errorMessage = "Quyền truy cập camera bị từ chối.";
        suggestion = "Vui lòng cấp quyền camera trong cài đặt trình duyệt và thử lại.";
      } else if (err.name === "NotFoundError" || err.message?.includes("camera")) {
        errorMessage = "Không tìm thấy camera.";
        suggestion = "Vui lòng kiểm tra kết nối camera hoặc thử tải ảnh lên thay vì quét trực tiếp.";
      } else if (err.name === "NotReadableError" || err.message?.includes("busy")) {
        errorMessage = "Camera đang được sử dụng.";
        suggestion = "Vui lòng đóng các ứng dụng khác đang sử dụng camera.";
      } else if (err.message?.includes("NotSupportedError")) {
        errorMessage = "Trình duyệt không hỗ trợ quét QR code.";
        suggestion = "Vui lòng sử dụng trình duyệt hiện đại (Chrome, Firefox, Edge) hoặc thử tải ảnh lên.";
      } else {
        suggestion = "Vui lòng thử tải ảnh lên thay vì quét trực tiếp, hoặc làm mới trang và thử lại.";
      }

      setError(`${errorMessage} ${suggestion}`);
      setScanning(false);
      setToast({ 
        message: errorMessage, 
        type: "error" 
      });
    }
  };

  const stopScanning = async () => {
    try {
      if (html5QrCodeRef.current) {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current = null;
      }
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
      if (qualityCheckIntervalRef.current) {
        clearInterval(qualityCheckIntervalRef.current);
      }
      setScanning(false);
      setScanningTips(false);
      setScanStatus("");
      scanAttemptsRef.current = 0;
    } catch (err) {
      console.error("Error stopping scanner:", err);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Kiểm tra loại file
    if (!file.type.startsWith("image/")) {
      setToast({ 
        message: "Vui lòng chọn file ảnh (JPG, PNG, WEBP)", 
        type: "error" 
      });
      return;
    }

    // Kiểm tra kích thước file (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setToast({ 
        message: "File quá lớn. Vui lòng chọn file nhỏ hơn 5MB", 
        type: "error" 
      });
      return;
    }

    // Kiểm tra độ phân giải ảnh
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    
    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);
      
      // Kiểm tra độ phân giải tối thiểu
      if (img.width < 200 || img.height < 200) {
        setToast({ 
          message: "Ảnh quá nhỏ. Vui lòng chọn ảnh có độ phân giải cao hơn (tối thiểu 200x200px)", 
          type: "error" 
        });
        return;
      }

      // Nếu ảnh quá lớn, có thể cảnh báo nhưng vẫn cho phép
      if (img.width > 4000 || img.height > 4000) {
        setToast({ 
          message: "Ảnh có độ phân giải rất cao, có thể mất thời gian xử lý", 
          type: "info" 
        });
      }

      await handleQRCodeScanned(null, file);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setToast({ 
        message: "Không thể đọc file ảnh. Vui lòng chọn file ảnh hợp lệ", 
        type: "error" 
      });
    };

    img.src = objectUrl;
  };

  const handleQRCodeScanned = async (decodedText = null, imageFile = null) => {
    try {
      setLoading(true);
      setError(null);

      let result;

      if (imageFile) {
        // Nếu là upload file, gửi file lên server
        result = await qrApi.scanQRCode(imageFile);
      } else if (decodedText) {
        // Nếu quét trực tiếp từ camera, có thể là URL hoặc text
        // Nếu là URL ảnh, tải về và gửi lên server
        // Nếu là text thuần, hiển thị trực tiếp
        try {
          // Thử parse JSON nếu có thể
          const parsed = JSON.parse(decodedText);
          result = {
            success: true,
            data: parsed,
            rawData: decodedText,
          };
        } catch (e) {
          // Nếu không phải JSON, trả về dạng text
          result = {
            success: true,
            data: decodedText,
            rawData: decodedText,
          };
        }
      }

      if (result && result.success) {
        setQrData(result.data || result.rawData);
        setToast({ message: "Quét mã QR thành công!", type: "success" });
      } else {
        const errorMsg = result?.message || "Không thể đọc mã QR";
        throw new Error(errorMsg);
      }
    } catch (err) {
      console.error("Error processing QR code:", err);
      
      let errorMessage = err.response?.data?.message || err.message || "Có lỗi xảy ra khi xử lý mã QR";
      let suggestions = "";

      // Thêm gợi ý cụ thể dựa trên loại lỗi
      if (errorMessage.includes("Không tìm thấy mã QR") || errorMessage.includes("không thể đọc")) {
        suggestions = "\n\n💡 Gợi ý:\n" +
          "• Đảm bảo ảnh rõ nét, mã QR không bị mờ\n" +
          "• Kiểm tra ánh sáng đủ, tránh phản quang\n" +
          "• Đảm bảo mã QR không bị che khuất\n" +
          "• Thử chụp lại ảnh với góc độ khác\n" +
          "• Nếu quét bằng camera, thử tải ảnh lên thay thế";
      } else if (errorMessage.includes("xử lý ảnh")) {
        suggestions = "\n\n💡 Gợi ý:\n" +
          "• Kiểm tra định dạng file (JPG, PNG, WEBP)\n" +
          "• Thử với ảnh khác\n" +
          "• Kiểm tra kích thước file (tối đa 5MB)";
      }

      setError(errorMessage + suggestions);
      setToast({ 
        message: errorMessage, 
        type: "error" 
      });
    } finally {
      setLoading(false);
    }
  };

  const resetScan = () => {
    setQrData(null);
    setError(null);
    if (scanning) {
      stopScanning();
    }
  };

  return (
    <div className="flex bg-[#F3F4F6] min-h-screen font-sans text-gray-800">
      <Sidebar />
      <div className="flex-1 ml-[270px]">
        <Topbar />
        <div className="p-8 max-w-4xl mx-auto space-y-6">
          <div className="border-b border-gray-200 pb-4">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              Quét mã QR căn cước công dân
            </h1>
            <p className="text-gray-500 text-sm mt-1">Quét mã QR từ căn cước công dân để lấy thông tin.</p>
          </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        {!qrData ? (
          <>
            {/* Khu vực quét QR */}
            <div className="mb-6">
              <div
                id="qr-reader"
                className={`w-full ${scanning ? "block" : "hidden"}`}
                style={{ minHeight: "300px" }}
              ></div>

              {!scanning && (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                  <p className="text-gray-500 mb-4">
                    Chọn phương thức quét mã QR
                  </p>
                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={startScanning}
                      disabled={loading}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Quét bằng camera
                    </button>
                    <label className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={loading}
                      />
                      Tải ảnh lên
                    </label>
                  </div>
                </div>
              )}

              {scanning && (
                <div className="mt-4 space-y-4">
                  {/* Trạng thái quét */}
                  {scanStatus && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span className="text-sm text-blue-800 font-medium">{scanStatus}</span>
                      </div>
                    </div>
                  )}

                  <div className="text-center">
                    <button
                      onClick={stopScanning}
                      className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      Dừng quét
                    </button>
                  </div>
                  
                  {/* Gợi ý khi quét */}
                  {scanningTips && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-semibold text-blue-900 mb-2">💡 Gợi ý để quét tốt hơn:</h4>
                      <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                        <li>Giữ camera ổn định, cách mã QR khoảng 15-30cm</li>
                        <li>Đảm bảo đủ ánh sáng, tránh phản quang</li>
                        <li>Làm sạch ống kính camera nếu bị mờ</li>
                        <li>Đảm bảo mã QR rõ ràng, không bị mờ hoặc nhăn</li>
                        <li>Giữ camera vuông góc với mã QR</li>
                      </ul>
                    </div>
                  )}

                  {/* Thông tin camera */}
                  {cameraInfo && (
                    <div className="text-xs text-gray-500 text-center">
                      Camera: {cameraInfo.width}x{cameraInfo.height}
                      {!cameraInfo.hasFocus && " (Không có tự động lấy nét)"}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Loading */}
            {loading && (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">Đang xử lý...</p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <div className="text-red-500 text-xl">⚠️</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-red-900 mb-2">Có lỗi xảy ra</h4>
                    <div className="text-red-800 whitespace-pre-line text-sm">
                      {error.split('\n\n').map((part, idx) => {
                        if (part.startsWith('💡')) {
                          return (
                            <div key={idx} className="mt-2 bg-red-100 p-3 rounded border border-red-300">
                              <div className="whitespace-pre-line">{part}</div>
                            </div>
                          );
                        }
                        return <p key={idx}>{part}</p>;
                      })}
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={resetScan}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                      >
                        Thử lại
                      </button>
                      {!scanning && (
                        <label className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer text-sm font-medium">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            className="hidden"
                            disabled={loading}
                          />
                          Tải ảnh lên thay thế
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Hiển thị kết quả */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Thông tin từ mã QR</h2>
                <button
                  onClick={resetScan}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Quét lại
                </button>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                {typeof qrData === "object" ? (
                  <div className="space-y-3">
                    {Object.entries(qrData).map(([key, value]) => (
                      <div key={key} className="border-b pb-2">
                        <span className="font-semibold text-gray-700 capitalize">
                          {key.replace(/_/g, " ")}:
                        </span>{" "}
                        <span className="text-gray-900">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white p-4 rounded border">
                    <pre className="whitespace-pre-wrap text-sm">
                      {JSON.stringify(qrData, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
        </div>
      </div>
    </div>
  );
};

export default QrScannerPage;
