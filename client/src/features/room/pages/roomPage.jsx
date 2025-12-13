import React, { useState } from "react";
import Sidebar from "../../../components/sidebar";
import Topbar from "../../../components/Topbar";
import RoomListTab from "./roomListTab";
import RoomCategoryTab from "./roomCategoryTab";
import { FaBed, FaLayerGroup } from "react-icons/fa";

export default function RoomPage() {
  const [activeTab, setActiveTab] = useState("rooms");

  return (
    <div className="flex bg-[#F3F4F6] min-h-screen font-sans text-gray-800">
      <Sidebar />

      <div className="flex-1 ml-[270px]">
        <Topbar />

        <div className="p-8 max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-gray-200 pb-4">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Quản lý Phòng</h1>
                <p className="text-gray-500 text-sm mt-1">Quản lý danh sách phòng và loại phòng.</p>
            </div>
            <div className="bg-gray-200 p-1 rounded-xl flex gap-1">
                <button
                    onClick={() => setActiveTab("rooms")}
                    className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                        activeTab === "rooms" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                    <FaBed /> Danh sách Phòng
                </button>
                <button
                    onClick={() => setActiveTab("types")}
                    className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                        activeTab === "types" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                    <FaLayerGroup /> Loại phòng
                </button>
            </div>
          </div>

          <div>
             {activeTab === "rooms" ? <RoomListTab /> : <RoomCategoryTab />}
          </div>

        </div>
      </div>
    </div>
  );
}