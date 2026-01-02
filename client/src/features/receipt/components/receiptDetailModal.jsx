import React, { useRef } from "react";
import { FiX, FiPrinter } from "react-icons/fi";

export default function ReceiptDetailModal({ receipt, onClose }) {
  const printRef = useRef();
  const handlePrint = () => {
    const printContent = printRef.current.innerHTML;
    const printWindow = window.open('', '', 'height=800,width=800');

    if(!printWindow) return alert("Trình duyệt đã chặn cửa sổ in. Vui lòng cho phép popup.");

    printWindow.document.write('<html><head><title>Hóa Đơn - ' + receipt._id + '</title>');
    printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
    printWindow.document.write(`
        <style>
            @media print {
                body { -webkit-print-color-adjust: exact; }
            }
            body { font-family: sans-serif; padding: 20px; }
        </style>
    `);

    printWindow.document.write('</head><body>');
    printWindow.document.write(printContent);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    }, 500);
  };

  if (!receipt) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50 rounded-t-xl">
          <h3 className="font-bold text-gray-800">Chi tiết Hóa đơn</h3>
          <div className="flex gap-2">
            <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition shadow-sm"
            >
                <FiPrinter/> In Hóa Đơn
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg text-gray-500 transition">
                <FiX size={20}/>
            </button>
          </div>
        </div>
        <div className="p-8 overflow-y-auto bg-white" ref={printRef}>
            <div className="text-center mb-8 border-b-2 border-dashed border-gray-200 pb-6">
                <h1 className="text-2xl font-black text-gray-900 uppercase tracking-wide">Khách Sạn Demo</h1>
                <p className="text-sm text-gray-500 mt-1">123 Đường ABC, Quận 1, TP.HCM</p>
                <p className="text-sm text-gray-500">Hotline: 1900 1234</p>
                <h2 className="text-xl font-bold mt-4 uppercase">Hóa Đơn Thanh Toán</h2>
                <div className="text-xs text-gray-400 mt-1 font-mono">#{receipt._id}</div>
            </div>
            <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
                <div>
                    <p className="text-gray-500 text-xs uppercase font-bold mb-1">Khách hàng</p>
                    <p className="font-bold text-gray-800 text-base">
                        {receipt.booking_id?.customer_id?.full_name || "Khách lẻ"}
                    </p>
                    <p className="text-gray-600">{receipt.booking_id?.customer_id?.phone_number}</p>
                </div>
                <div className="text-right">
                    <p className="text-gray-500 text-xs uppercase font-bold mb-1">Ngày lập</p>
                    <p className="font-mono font-bold text-gray-800">
                        {new Date(receipt.created_at).toLocaleString('vi-VN')}
                    </p>
                    <p className="text-gray-600 mt-1">
                        Thu ngân: {receipt.employee_id?.user_id?.full_name || "Admin"}
                    </p>
                </div>
            </div>
            <table className="w-full mb-6 border-collapse">
                <thead>
                    <tr className="border-b-2 border-gray-800 text-xs uppercase font-bold text-gray-600 text-left">
                        <th className="py-2">Khoản mục</th>
                        <th className="py-2 text-right">Số tiền (VNĐ)</th>
                    </tr>
                </thead>
                <tbody className="text-sm">
                    <tr className="border-b border-gray-100">
                        <td className="py-3 font-medium">Tiền phòng (đã trừ KM)</td>
                        <td className="py-3 text-right">{receipt.total_fee?.toLocaleString()}</td>
                    </tr>

                    {receipt.service_fee > 0 && (
                        <tr className="border-b border-gray-100">
                            <td className="py-3 font-medium text-gray-600">Phí dịch vụ thêm</td>
                            <td className="py-3 text-right">{receipt.service_fee?.toLocaleString()}</td>
                        </tr>
                    )}

                    {receipt.compensate_fee > 0 && (
                        <tr className="border-b border-gray-100">
                            <td className="py-3 font-medium text-red-600">Phí đền bù hư hại</td>
                            <td className="py-3 text-right text-red-600">{receipt.compensate_fee?.toLocaleString()}</td>
                        </tr>
                    )}
                </tbody>
                <tfoot className="text-sm">
                    <tr>
                        <td className="py-3 font-bold text-gray-800">Tổng giá trị</td>
                        <td className="py-3 text-right font-bold text-gray-800">
                            {receipt.final_amount?.toLocaleString()}
                        </td>
                    </tr>

                    <tr>
                        <td className="py-1 text-gray-500 italic">Đã đặt cọc</td>
                        <td className="py-1 text-right text-gray-500 italic">
                            - {receipt.deposit_amount?.toLocaleString()}
                        </td>
                    </tr>

                    <tr className="text-lg">
                        <td className="py-4 font-black uppercase text-indigo-700">Thực thu</td>
                        <td className="py-4 text-right font-black text-indigo-700">
                            {receipt.amount_due?.toLocaleString()} đ
                        </td>
                    </tr>
                </tfoot>
            </table>

            <div className="text-center pt-6 border-t border-gray-200 mt-8">
                <p className="text-sm font-bold text-gray-800 mb-1">Cảm ơn quý khách!</p>
                <p className="text-xs text-gray-500 italic">Hẹn gặp lại quý khách lần sau.</p>
            </div>
        </div>
      </div>
    </div>
  );
}