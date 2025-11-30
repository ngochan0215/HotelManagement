import Sidebar from "../../components/sidebar";
import Topbar from "../../components/topbar";
export default function MainLayout({ children }) {
  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Topbar />
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
