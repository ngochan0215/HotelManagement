import React, { useState } from "react";
import { FiAlertTriangle, FiFileText } from "react-icons/fi";

import Sidebar from "../../../components/sidebar";
import Topbar from "../../../components/topbar";

import IncidentListTab from "./incidentListTab";
import CompensationListTab from "./compensationListTab";

export default function IncidentPage() {
  const [activeTab, setActiveTab] = useState("incidents");

  return (
    <div className="flex bg-[#F3F4F6] min-h-screen font-sans text-gray-800">
      <Sidebar />
      <div className="flex-1 ml-[270px]">
        <Topbar />

        <div className="p-8 max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-gray-200 pb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                Quản lý Sự cố & Bồi thường
              </h1>
              <p className="text-gray-500 text-sm mt-1">
                Ghi nhận sự cố vận hành và xử lý đền bù thiết bị.
              </p>
            </div>

            <div className="bg-gray-200 p-1 rounded-xl flex gap-1">
              <button
                onClick={() => setActiveTab("incidents")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  activeTab === "incidents"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <FiAlertTriangle size={16} /> Danh sách Sự cố
              </button>

              <button
                onClick={() => setActiveTab("compensations")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  activeTab === "compensations"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <FiFileText size={16} /> Phiếu Bồi thường
              </button>
            </div>
          </div>

          <div className="min-h-[500px]">
            {activeTab === "incidents" && <IncidentListTab />}
            {activeTab === "compensations" && <CompensationListTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
