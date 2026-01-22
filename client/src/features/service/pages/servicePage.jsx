import React, { useState } from "react";
import Sidebar from "../../../components/sidebar.jsx";
import Topbar from "../../../components/topbar.jsx";
import { FiGrid, FiClipboard } from "react-icons/fi";
import ServiceListTab from "./serviceListTab.jsx";
import ServiceTicketTab from "./serviceTicketTab.jsx";

export default function ServicePage() {
  const [activeTab, setActiveTab] = useState("list");

  return (
    <div className="flex bg-[#F3F4F6] min-h-screen font-sans text-gray-800">
      <Sidebar />
      <div className="flex-1 ml-[270px]">
        <Topbar />

        <div className="p-8 max-w-7xl mx-auto space-y-6">

            <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-gray-200 pb-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        Quản lý Dịch vụ & Sản phẩm
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Quản lý menu, kho hàng hóa và theo dõi phiếu nhập/xuất.</p>
                </div>

                <div className="bg-gray-200 p-1 rounded-xl flex gap-1">
                    <button
                        onClick={() => setActiveTab("list")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                            activeTab === "list"
                            ? "bg-white text-indigo-600 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        <FiGrid size={16} /> Danh sách & Kho
                    </button>

                    <button
                        onClick={() => setActiveTab("tickets")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                            activeTab === "tickets"
                            ? "bg-white text-indigo-600 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        <FiClipboard size={16} /> Phiếu Nhập & Sử dụng
                    </button>
                </div>
            </div>

            <div className="min-h-[500px]">
                {activeTab === "list" && <ServiceListTab />}
                {activeTab === "tickets" && <ServiceTicketTab />}
            </div>

        </div>
      </div>
    </div>
  );
}