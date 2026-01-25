import React, { useState, useEffect, useMemo } from 'react';
import { FiRefreshCw, FiEye, FiFilter, FiCheckCircle } from 'react-icons/fi';
import { bookingApi } from '../../api/bookingApi.js';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

export default function AllTasksPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filterType, setFilterType] = useState('all'); // 'all', 'cleaning', 'install'
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'pending', 'in_progress', 'completed', 'confirmed', 'waiting_confirm'

  useEffect(() => {
    fetchTasks();
  }, [filterType, filterStatus]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterType !== 'all') {
        params.type = filterType;
      }
      if (filterStatus !== 'all') {
        params.status = filterStatus;
      }
      const res = await bookingApi.getAllTasks(params);
      if (res.success) {
        setTasks(res.tasks || []);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      alert('Lỗi khi tải danh sách công việc');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = async (task) => {
    setSelectedTask(task);
    setShowDetailModal(true);
  };

  const getTaskTypeLabel = (type) => {
    switch (type) {
      case 'cleaning':
        return 'Dọn dẹp phòng';
      case 'install':
        return 'Lắp đặt/Tháo dỡ thiết bị';
      case 'equipment_import':
        return 'Phiếu nhập thiết bị';
      case 'product_import':
        return 'Phiếu nhập sản phẩm';
      case 'incident':
        return 'Báo cáo sự cố';
      default:
        return 'Khác';
    }
  };

  const getTaskTypeColor = (type) => {
    switch (type) {
      case 'cleaning':
        return 'bg-blue-100 text-blue-800';
      case 'install':
        return 'bg-purple-100 text-purple-800';
      case 'equipment_import':
        return 'bg-green-100 text-green-800';
      case 'product_import':
        return 'bg-yellow-100 text-yellow-800';
      case 'incident':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending':
      case 'new':
        return 'Chờ xử lý';
      case 'in_progress':
        return 'Đang thực hiện';
      case 'completed':
        return 'Hoàn thành';
      case 'confirmed':
        return 'Đã xác nhận';
      case 'waiting_confirm':
        return 'Chờ xác nhận';
      case 'cancelled':
        return 'Đã hủy';
      case 'expired':
        return 'Đã hết hạn';
      case 'resolved':
        return 'Đã xử lý';
      case 'closed':
        return 'Đã đóng'
      default:
        return status;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
      case 'new':
        return 'bg-yellow-100 text-yellow-800';

      case 'in_progress':
        return 'bg-blue-100 text-blue-800';

      case 'completed':
      case 'resolved':
        return 'bg-green-100 text-green-800';

      case 'confirmed':
        return 'bg-emerald-100 text-emerald-800';

      case 'waiting_confirm':
        return 'bg-orange-100 text-orange-800';

      case 'cancelled':
      case 'expired':
      case 'closed':
        return 'bg-red-100 text-red-800';

      default:
        return 'bg-gray-100 text-gray-800';
    }
  };


  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: vi });
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quản lý công việc</h1>
            <p className="text-sm text-gray-600 mt-1">Xem và quản lý tất cả các công việc trong hệ thống</p>
          </div>
          <button
            onClick={fetchTasks}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <FiFilter className="text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Lọc theo:</span>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Loại công việc:</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Tất cả</option>
                <option value="cleaning">Dọn dẹp phòng</option>
                <option value="install">Lắp đặt/Tháo dỡ</option>
                <option value="equipment_import">Phiếu nhập thiết bị</option>
                <option value="product_import">Phiếu nhập sản phẩm</option>
                <option value="incident">Báo cáo sự cố</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Trạng thái:</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Tất cả</option>
                <option value="pending">Chờ xử lý</option>
                <option value="in_progress">Đang thực hiện</option>
                <option value="completed">Hoàn thành</option>
                <option value="confirmed">Đã xác nhận</option>
                <option value="waiting_confirm">Chờ xác nhận</option>
                <option value="cancelled">Đã hủy</option>
                <option value="new">Mới</option>
                <option value="resolved">Đã xử lý</option>
                <option value="closed">Đã đóng</option>
                <option value="expired">Hết hạn</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tasks Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p className="mt-2 text-gray-600">Đang tải...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <p>Không có công việc nào</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Loại
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Phòng
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Nhân viên
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Trạng thái
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Thời gian tạo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tasks.map((task, index) => (
                    <tr key={`${task.task_type}-${task._id}-${index}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTaskTypeColor(task.task_type)}`}>
                          {getTaskTypeLabel(task.task_type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {task.room_id?.room_number || 
                           (task.task_type === 'equipment_import' || task.task_type === 'product_import' 
                             ? 'N/A' 
                             : 'N/A')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {task.handled_by?.full_name || 
                           task.employee_id?.full_name ||
                           task.assignee_info?.assignee_id?.full_name ||
                           task.assignee_info?.assignee_name ||
                           'Chưa gán'}
                        </div>
                        {(task.handled_by?.phone_number || 
                          task.employee_id?.phone_number ||
                          task.assignee_info?.assignee_id?.phone_number) && (
                          <div className="text-xs text-gray-500">
                            {task.handled_by?.phone_number || 
                             task.employee_id?.phone_number ||
                             task.assignee_info?.assignee_id?.phone_number}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                          {getStatusLabel(task.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(task.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleViewDetail(task)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                        >
                          <FiEye />
                          Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedTask(null);
          }}
          onRefresh={fetchTasks}
        />
      )}
    </div>
  );
}

// Task Detail Modal Component
function TaskDetailModal({ task, onClose, onRefresh }) {
  const [confirming, setConfirming] = useState(false);

  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: vi });
    } catch {
      return 'N/A';
    }
  };

  const handleConfirmCleaning = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xác nhận hoàn thành dọn dẹp phòng này?')) {
      return;
    }

    setConfirming(true);
    try {
      await bookingApi.confirmCleaning(task._id);
      alert('Xác nhận hoàn thành dọn dẹp thành công!');
      onRefresh();
      onClose();
    } catch (error) {
      alert('Lỗi: ' + (error.response?.data?.message || error.message));
    } finally {
      setConfirming(false);
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending':
        return 'Chờ xử lý';
      case 'in_progress':
        return 'Đang thực hiện';
      case 'completed':
        return 'Hoàn thành';
      case 'confirmed':
        return 'Đã xác nhận';
      case 'waiting_confirm':
        return 'Chờ xác nhận';
      case 'cancelled':
        return 'Đã hủy';
      default:
        return status;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'confirmed':
        return 'bg-emerald-100 text-emerald-800';
      case 'waiting_confirm':
        return 'bg-orange-100 text-orange-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTaskTypeLabel = (type) => {
    switch (type) {
      case 'cleaning':
        return 'Dọn dẹp phòng';
      case 'install':
        return 'Lắp đặt/Tháo dỡ thiết bị';
      case 'equipment_import':
        return 'Phiếu nhập thiết bị';
      case 'product_import':
        return 'Phiếu nhập sản phẩm';
      case 'incident':
        return 'Báo cáo sự cố';
      default:
        return 'Khác';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Chi tiết công việc</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Task Type & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Loại công việc</label>
              <p className="text-sm text-gray-900">{getTaskTypeLabel(task.task_type)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                {getStatusLabel(task.status)}
              </span>
            </div>
          </div>

          {/* Room Info */}
          {(task.task_type === 'cleaning' || task.task_type === 'install' || task.task_type === 'incident') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phòng</label>
            <p className="text-sm text-gray-900">{task.room_id?.room_number || 'N/A'}</p>
          </div>
          )}

          {/* Employee Info */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {task.task_type === 'equipment_import' || task.task_type === 'product_import' 
                ? 'Nhân viên tạo phiếu' 
                : task.task_type === 'incident'
                ? 'Người được gán'
                : 'Nhân viên được gán'}
            </label>
            {task.handled_by ? (
              <div>
                <p className="text-sm text-gray-900">{task.handled_by.full_name}</p>
                {task.handled_by.phone_number && (
                  <p className="text-xs text-gray-500">{task.handled_by.phone_number}</p>
                )}
              </div>
            ) : task.employee_id ? (
              <div>
                <p className="text-sm text-gray-900">{task.employee_id.full_name}</p>
                {task.employee_id.phone_number && (
                  <p className="text-xs text-gray-500">{task.employee_id.phone_number}</p>
                )}
              </div>
            ) : task.assignee_info?.assignee_id ? (
              <div>
                <p className="text-sm text-gray-900">{task.assignee_info.assignee_id.full_name}</p>
                {task.assignee_info.assignee_id.phone_number && (
                  <p className="text-xs text-gray-500">{task.assignee_info.assignee_id.phone_number}</p>
                )}
              </div>
            ) : task.assignee_info?.assignee_name ? (
              <p className="text-sm text-gray-900">{task.assignee_info.assignee_name}</p>
            ) : (
              <p className="text-sm text-gray-500">Chưa gán</p>
            )}
          </div>

          {/* Task-specific details */}
          {task.task_type === 'cleaning' && (
            <>
              {task.booking_id && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Booking ID</label>
                  <p className="text-sm text-gray-900">{task.booking_id._id || task.booking_id}</p>
                </div>
              )}
              {task.note && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                  <p className="text-sm text-gray-900">{task.note}</p>
                </div>
              )}
            </>
          )}

          {task.task_type === 'install' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loại</label>
                <p className="text-sm text-gray-900">
                  {task.mode === 'install' ? 'Lắp đặt' : task.mode === 'uninstall' ? 'Tháo dỡ' : task.type === 'install' ? 'Lắp đặt' : 'Tháo dỡ'}
                </p>
              </div>
              {task.install_date && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày lắp đặt</label>
                  <p className="text-sm text-gray-900">{formatDate(task.install_date)}</p>
                </div>
              )}
              {task.install_details && task.install_details.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Danh sách thiết bị</label>
                  <div className="space-y-2">
                    {(() => {
                      // Group equipment by category
                      const groupedByCategory = {};
                      task.install_details.forEach((detail) => {
                        const category = detail.equipment_id?.category_id;
                        const categoryId = category?._id || category || 'unknown';
                        const categoryName = category?.name || "Thiết bị";
                        
                        if (!groupedByCategory[categoryId]) {
                          groupedByCategory[categoryId] = { name: categoryName, description: category?.description, count: 0 };
                        }
                        groupedByCategory[categoryId].count += 1;
                      });

                      return Object.values(groupedByCategory).map((group, index) => (
                        <div key={index} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">
                                {group.name} {group.count > 1 && <span className="text-indigo-600">(x{group.count})</span>}
                              </p>
                              {group.description && (
                                <p className="text-xs text-gray-500 mt-1">{group.description}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
              {task.note && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                  <p className="text-sm text-gray-900">{task.note}</p>
                </div>
              )}
            </>
          )}

          {task.task_type === 'equipment_import' && (
            <>
              {task.import_date && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày nhập</label>
                  <p className="text-sm text-gray-900">{formatDate(task.import_date)}</p>
                </div>
              )}
              {task.total_fee !== undefined && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tổng chi phí</label>
                  <p className="text-sm text-gray-900">{task.total_fee.toLocaleString('vi-VN')} VNĐ</p>
                </div>
              )}
              {task.import_details && task.import_details.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Chi tiết nhập</label>
                  <div className="space-y-2">
                    {task.import_details.map((detail, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">
                              {detail.category_id?.name || 'Danh mục thiết bị'}
                            </p>
                            <div className="mt-1 text-sm text-gray-600">
                              <span>Số lượng: {detail.import_quantity}</span>
                              {detail.import_price > 0 && (
                                <span className="ml-4">Giá: {detail.import_price.toLocaleString('vi-VN')} VNĐ</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {task.task_type === 'product_import' && (
            <>
              {task.import_date && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày nhập</label>
                  <p className="text-sm text-gray-900">{formatDate(task.import_date)}</p>
                </div>
              )}
              {task.import_details && task.import_details.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Chi tiết nhập</label>
                  <div className="space-y-2">
                    {task.import_details.map((detail, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">
                              {detail.service_id?.name || 'Sản phẩm'}
                            </p>
                            <div className="mt-1 text-sm text-gray-600">
                              <span>Số lượng: {detail.import_quantity}</span>
                              {detail.import_price > 0 && (
                                <span className="ml-4">Giá: {detail.import_price.toLocaleString('vi-VN')} VNĐ</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {task.task_type === 'incident' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                <p className="text-sm text-gray-900">{task.description || 'N/A'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loại sự cố</label>
                  <p className="text-sm text-gray-900">
                    {task.type === 'equipment' ? 'Thiết bị' :
                     task.type === 'technical' ? 'Kỹ thuật' :
                     task.type === 'facility' ? 'Cơ sở vật chất' :
                     task.type === 'service' ? 'Dịch vụ' :
                     task.type === 'safety' ? 'An toàn' :
                     task.type === 'other' ? 'Khác' : task.type}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mức độ nghiêm trọng</label>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                    task.severity === 'critical' ? 'bg-red-100 text-red-800' :
                    task.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                    task.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {task.severity === 'critical' ? 'Nghiêm trọng' :
                     task.severity === 'high' ? 'Cao' :
                     task.severity === 'medium' ? 'Trung bình' :
                     'Thấp'}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Người báo cáo</label>
                <p className="text-sm text-gray-900">{task.reporter_id?.email || 'N/A'}</p>
              </div>
              {task.occured_at && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Thời gian xảy ra</label>
                  <p className="text-sm text-gray-900">{formatDate(task.occured_at)}</p>
                </div>
              )}
              {task.assignee_info?.assigned_at && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Thời gian được gán</label>
                  <p className="text-sm text-gray-900">{formatDate(task.assignee_info.assigned_at)}</p>
                </div>
              )}
              {task.resolved_at && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Thời gian xử lý</label>
                  <p className="text-sm text-gray-900">{formatDate(task.resolved_at)}</p>
                </div>
              )}
            </>
          )}

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
            {task.started_at && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bắt đầu</label>
                <p className="text-sm text-gray-900">{formatDate(task.started_at)}</p>
              </div>
            )}
            {task.completed_at && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hoàn thành</label>
                <p className="text-sm text-gray-900">{formatDate(task.completed_at)}</p>
              </div>
            )}
            {task.confirmed_at && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Xác nhận</label>
                <p className="text-sm text-gray-900">{formatDate(task.confirmed_at)}</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Thời gian tạo</label>
              <p className="text-sm text-gray-900">{formatDate(task.created_at)}</p>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          {/* Button xác nhận cho cleaning tasks có status completed */}
          {task.task_type === 'cleaning' && task.status === 'completed' && (
            <button
              onClick={handleConfirmCleaning}
              disabled={confirming}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <FiCheckCircle />
              {confirming ? 'Đang xác nhận...' : 'Xác nhận hoàn thành'}
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
