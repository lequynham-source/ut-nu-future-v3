import { useState, useEffect } from 'react';
import { MapPin, Clock, Calendar, Search, Filter, ChevronLeft, ChevronRight, FileText, ShoppingCart } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { apiFetch } from '../../utils/api';
import LoadingOverlay from '../../components/LoadingOverlay';

export default function SaleHistory({ user }: { user: any }) {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const today = format(new Date(), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  useEffect(() => {
    fetchHistory();
  }, [page]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.append('startDate', startDate);
      if (endDate) queryParams.append('endDate', endDate);
      queryParams.append('page', page.toString());
      queryParams.append('limit', '20');
      
      const res = await apiFetch(`/api/sale-reports?${queryParams.toString()}`);
      // Filter by current user
      const userReports = (res.data || []).filter((r: any) => r.sale_id === user.id);
      setReports(userReports);
      setTotalPages(res.pagination?.totalPages || 1);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    if (page === 1) {
      fetchHistory();
    } else {
      setPage(1);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 relative z-10">
      <LoadingOverlay isLoading={loading} message="Đang tải lịch sử..." />
      
      <h1 className="text-3xl font-extrabold text-gradient">Lịch sử Chăm sóc</h1>

      <div className="glass-panel p-6 rounded-3xl space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Filter className="w-5 h-5 text-moss-dark" />
          <h2 className="text-lg font-bold text-moss-dark">Lọc thời gian</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-bold text-moss-dark mb-1">Từ ngày</label>
            <input
              type="date"
              className="glass-input block w-full rounded-xl sm:text-sm p-2.5"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-moss-dark mb-1">Đến ngày</label>
            <input
              type="date"
              className="glass-input block w-full rounded-xl sm:text-sm p-2.5"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div>
            <button
              onClick={handleFilter}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-moss text-white rounded-xl font-bold hover:bg-moss-dark transition-all shadow-md active:scale-95"
            >
              <Search className="w-5 h-5" />
              Lọc
            </button>
          </div>
        </div>
      </div>

      <div className="glass-panel overflow-hidden rounded-3xl">
        {reports.length === 0 ? (
          <p className="p-8 text-center text-moss-dark/70 font-medium">Không có lịch sử chăm sóc nào.</p>
        ) : (
          <>
            <ul className="divide-y divide-white/20">
              {reports.map((report) => (
                <li key={report.id} className="p-4 sm:px-6 hover:bg-white/10 transition-colors">
                  <div className="flex flex-col space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-lg font-bold text-moss-dark truncate">
                        {report.agency_name}
                      </p>
                      <div className="flex items-center text-sm font-medium text-moss-dark/70 bg-white/30 px-3 py-1 rounded-lg backdrop-blur-sm">
                        <Calendar className="flex-shrink-0 mr-1.5 h-4 w-4 text-moss" />
                        <p>{format(parseISO(report.check_in_time), 'dd/MM/yyyy')}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-moss-dark/80">
                      <div className="bg-white/20 px-3 py-2 rounded-xl backdrop-blur-sm border border-white/30 flex items-center">
                        <Clock className="w-4 h-4 mr-2 text-moss" />
                        <span>Check-in: {format(parseISO(report.check_in_time), 'HH:mm')}</span>
                      </div>
                      <div className="bg-white/20 px-3 py-2 rounded-xl backdrop-blur-sm border border-white/30 flex items-center">
                        <Clock className="w-4 h-4 mr-2 text-red-500" />
                        <span>Check-out: {report.check_out_time ? format(parseISO(report.check_out_time), 'HH:mm') : 'Chưa check-out'}</span>
                      </div>
                    </div>

                    {report.duration_minutes !== null && (
                      <p className="text-sm font-bold text-moss-dark bg-moss/20 py-2 px-4 rounded-xl inline-block border border-moss/30 w-fit">
                        Thời gian làm việc: {report.duration_minutes} phút
                      </p>
                    )}

                    {(report.notes || report.has_order === 1) && (
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {report.notes && (
                          <div className="bg-white/20 p-3 rounded-xl border border-white/30 backdrop-blur-sm">
                            <h4 className="font-bold text-moss-dark mb-1 flex items-center text-xs">
                              <FileText className="w-3 h-3 mr-1 text-moss" />
                              Ghi chú
                            </h4>
                            <p className="text-xs text-moss-dark/80">{report.notes}</p>
                          </div>
                        )}
                        {report.has_order === 1 && (
                          <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/30 backdrop-blur-sm">
                            <h4 className="font-bold text-amber-700 mb-1 flex items-center text-xs">
                              <ShoppingCart className="w-3 h-3 mr-1 text-amber-600" />
                              Đơn hàng
                            </h4>
                            <p className="text-xs text-moss-dark/80">{report.order_details || 'Có đơn hàng'}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            
            {totalPages > 1 && (
              <div className="p-4 border-t border-white/20 flex items-center justify-between bg-white/10">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center px-4 py-2 text-sm font-bold text-moss-dark bg-white/40 rounded-xl hover:bg-white/60 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Trang trước
                </button>
                <span className="text-sm font-bold text-moss-dark">
                  Trang {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex items-center px-4 py-2 text-sm font-bold text-moss-dark bg-white/40 rounded-xl hover:bg-white/60 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Trang sau
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
