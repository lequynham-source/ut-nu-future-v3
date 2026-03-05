import React, { useState, useEffect } from 'react';
import { PackageMinus, Search, Calendar, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { apiFetch } from '../../utils/api';
import LoadingOverlay from '../../components/LoadingOverlay';

export default function ReturnGoodsReports() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [dateRange, setDateRange] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [fetchingPhoto, setFetchingPhoto] = useState<number | null>(null);

  useEffect(() => {
    fetchReports();
  }, [pagination.page, dateRange]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/return-goods-reports?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&page=${pagination.page}&limit=20`);
      if (data && data.success) {
        setReports(data.data);
        setPagination(prev => ({
          ...prev,
          totalPages: data.pagination.totalPages,
          total: data.pagination.total
        }));
      }
    } catch (error) {
      console.error('Error fetching return goods reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewPhoto = async (report: any) => {
    setFetchingPhoto(report.id);
    try {
      const res = await apiFetch(`/api/reports/return/${report.id}/photo`);
      if (res.success && res.photo_url) {
        setSelectedPhoto(res.photo_url);
      } else {
        alert('Không tìm thấy ảnh cho báo cáo này.');
      }
    } catch (error) {
      console.error('Error fetching photo:', error);
      alert('Lỗi khi tải ảnh.');
    } finally {
      setFetchingPhoto(null);
    }
  };

  return (
    <div className="space-y-6">
      <LoadingOverlay isLoading={loading} message="Đang tải danh sách hàng trả về..." />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-moss-dark flex items-center">
          <PackageMinus className="mr-2 h-8 w-8 text-red-500" />
          Báo cáo Hàng trả về
        </h1>

        <div className="flex items-center gap-2 bg-white/50 p-2 rounded-2xl backdrop-blur-sm border border-white/50">
          <Calendar className="w-5 h-5 text-moss-dark/60 ml-2" />
          <input
            type="date"
            className="bg-transparent border-none focus:ring-0 text-sm font-bold text-moss-dark"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
          />
          <span className="text-moss-dark/40">→</span>
          <input
            type="date"
            className="bg-transparent border-none focus:ring-0 text-sm font-bold text-moss-dark"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
          />
        </div>
      </div>

      <div className="glass-panel rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-moss/10 text-moss-dark text-sm font-bold">
                <th className="p-4">Thời gian</th>
                <th className="p-4">Tài xế</th>
                <th className="p-4">Đại lý</th>
                <th className="p-4">Hàng hóa</th>
                <th className="p-4">Số lượng</th>
                <th className="p-4">Lý do</th>
                <th className="p-4 text-center">Ảnh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-moss/10">
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-moss-dark/50 italic">
                    Không có dữ liệu trong khoảng thời gian này
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr key={report.id} className="hover:bg-white/40 transition-colors">
                    <td className="p-4 text-sm font-medium text-moss-dark">
                      {format(parseISO(report.timestamp), 'dd/MM HH:mm')}
                    </td>
                    <td className="p-4 text-sm font-bold text-moss-dark">
                      {report.driver_name}
                    </td>
                    <td className="p-4 text-sm font-medium text-moss-dark">
                      {report.agency_name}
                    </td>
                    <td className="p-4 text-sm font-medium text-moss-dark">
                      {report.product_name}
                    </td>
                    <td className="p-4 text-sm font-bold text-red-600">
                      {report.quantity}
                    </td>
                    <td className="p-4 text-sm text-moss-dark/70 max-w-xs truncate">
                      {report.reason}
                    </td>
                    <td className="p-4 text-center">
                      {report.has_photo === 1 ? (
                        <div 
                          className="w-12 h-12 mx-auto bg-white/30 rounded-lg overflow-hidden relative border border-white/50 shadow-inner cursor-pointer group"
                          onClick={() => setSelectedPhoto(`/api/reports/return/${report.id}/image`)}
                        >
                          <img 
                            src={`/api/reports/return/${report.id}/image`} 
                            alt="Return" 
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Eye className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-moss-dark/30">N/A</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="p-4 bg-moss/5 flex items-center justify-between border-t border-moss/10">
            <span className="text-sm text-moss-dark/60 font-medium">
              Hiển thị {reports.length} / {pagination.total} kết quả
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page === 1}
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                className="p-2 rounded-xl hover:bg-white/50 disabled:opacity-30 transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm font-bold text-moss-dark px-4">
                Trang {pagination.page} / {pagination.totalPages}
              </span>
              <button
                disabled={pagination.page === pagination.totalPages}
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                className="p-2 rounded-xl hover:bg-white/50 disabled:opacity-30 transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Photo Modal */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-4xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl">
            <button 
              className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-all"
              onClick={() => setSelectedPhoto(null)}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <img src={selectedPhoto} alt="Return Goods" className="w-full h-auto max-h-[80vh] object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
