import { useState, useEffect, useMemo } from 'react';
import { MapPin, Clock, Calendar, Filter, Image as ImageIcon, Download, Search, ChevronLeft, ChevronRight, FileText, ShoppingCart } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import ImageModal from '../../components/ImageModal';
import LoadingOverlay from '../../components/LoadingOverlay';
import * as XLSX from 'xlsx';

import { apiFetch } from '../../utils/api';

export default function AdminSaleReports() {
  const [searchParams] = useSearchParams();
  const [reports, setReports] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [selectedImage, setSelectedImage] = useState<{ src: string, alt: string } | null>(null);
  const [fetchingPhoto, setFetchingPhoto] = useState<{ id: number, type: 'check_in' | 'check_out' } | null>(null);

  const today = format(new Date(), 'yyyy-MM-dd');
  // Filter states
  const [startDate, setStartDate] = useState(searchParams.get('startDate') || today);
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || today);
  const [selectedSale, setSelectedSale] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchSales();
  }, []);

  useEffect(() => {
    fetchReports();
  }, [page]);

  useEffect(() => {
    const start = searchParams.get('startDate');
    const end = searchParams.get('endDate');
    if (start) setStartDate(start);
    if (end) setEndDate(end);
  }, [searchParams]);

  const exportToExcel = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.append('startDate', startDate);
      if (endDate) queryParams.append('endDate', endDate);
      queryParams.append('limit', '10000'); // Fetch all for export

      const res = await apiFetch(`/api/sale-reports?${queryParams.toString()}`);
      const allData = res.data || [];

      const dataToExport = allData.filter((report: any) => {
        if (selectedSale && report.sale_id !== parseInt(selectedSale)) return false;
        return true;
      }).map((report: any) => ({
        'Ngày': format(parseISO(report.check_in_time), 'dd/MM/yyyy'),
        'Đại lý': report.agency_name,
        'Nhân viên Sale': report.sale_name,
        'Check-in': format(parseISO(report.check_in_time), 'HH:mm'),
        'Check-out': report.check_out_time ? format(parseISO(report.check_out_time), 'HH:mm') : 'Chưa check-out',
        'Thời gian (phút)': report.duration_minutes || 0,
        'Ghi chú': report.notes || '',
        'Có đơn hàng': report.has_order ? 'Có' : 'Không',
        'Chi tiết đơn hàng': report.order_details || '',
        'Vị trí Check-in': `${report.check_in_lat}, ${report.check_in_lng}`,
        'Ảnh Check-in': report.has_check_in_photo === 1 ? 'Có ảnh' : 'Không có ảnh',
        'Ảnh Check-out': report.has_check_out_photo === 1 ? 'Có ảnh' : 'Không có ảnh'
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Báo cáo Sale");
      XLSX.writeFile(wb, `Bao_cao_Sale_${format(new Date(), 'ddMMyyyy_HHmm')}.xlsx`);
    } catch (error) {
      console.error(error);
      alert('Lỗi khi xuất Excel');
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    if (page === 1) {
      fetchReports();
    } else {
      setPage(1);
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.append('startDate', startDate);
      if (endDate) queryParams.append('endDate', endDate);
      queryParams.append('page', page.toString());
      queryParams.append('limit', '50');
      
      const res = await apiFetch(`/api/sale-reports?${queryParams.toString()}`);
      setReports(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSales = async () => {
    try {
      const data = await apiFetch('/api/users');
      if (Array.isArray(data)) {
        setSales(data.filter((u: any) => u.role === 'sale'));
      } else {
        console.error('API returned non-array data for sales:', data);
        setSales([]);
      }
    } catch (error) {
      console.error(error);
      setSales([]);
    }
  };

  const handleViewPhoto = async (report: any, type: 'check_in' | 'check_out') => {
    setFetchingPhoto({ id: report.id, type });
    try {
      const res = await apiFetch(`/api/reports/sale/${report.id}/photo?photoType=${type}`);
      if (res.success && res.photo_url) {
        setSelectedImage({ 
          src: res.photo_url, 
          alt: `${type === 'check_in' ? 'Check-in' : 'Check-out'} tại ${report.agency_name}` 
        });
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

  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      let match = true;

      if (selectedSale && report.sale_id !== parseInt(selectedSale)) {
        match = false;
      }

      return match;
    });
  }, [reports, selectedSale]);

  return (
    <div className="space-y-6 relative z-10">
      <LoadingOverlay isLoading={loading} message="Đang tải dữ liệu báo cáo..." />
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-extrabold text-gradient">Báo cáo Nhân viên Sale</h1>
        <button
          onClick={exportToExcel}
          className="flex items-center gap-2 px-4 py-2 bg-moss text-white rounded-xl font-bold hover:bg-moss-dark transition-all shadow-md active:scale-95"
        >
          <Download className="w-5 h-5" />
          Xuất Excel
        </button>
      </div>

      <div className="glass-panel p-6 rounded-3xl space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Filter className="w-5 h-5 text-moss-dark" />
          <h2 className="text-lg font-bold text-moss-dark">Bộ lọc tìm kiếm</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
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
            <label className="block text-sm font-bold text-moss-dark mb-1">Nhân viên Sale</label>
            <select
              className="glass-input block w-full rounded-xl sm:text-sm p-2.5"
              value={selectedSale}
              onChange={(e) => setSelectedSale(e.target.value)}
            >
              <option value="">Tất cả nhân viên</option>
              {sales.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
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
        {filteredReports.length === 0 ? (
          <p className="p-8 text-center text-moss-dark/70 font-medium">Không tìm thấy báo cáo nào phù hợp.</p>
        ) : (
          <>
            <ul className="divide-y divide-white/20">
              {filteredReports.map((report) => (
                <li key={report.id} className="p-4 sm:px-6 hover:bg-white/10 transition-colors">
                  <div className="flex flex-col space-y-4">
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
                      <p className="bg-white/20 px-3 py-2 rounded-xl backdrop-blur-sm border border-white/30"><strong>Nhân viên:</strong> {report.sale_name}</p>
                      {report.check_in_lat && report.check_in_lng && (
                        <div className="flex items-center bg-white/20 px-3 py-2 rounded-xl backdrop-blur-sm border border-white/30">
                          <MapPin className="mr-1 h-4 w-4 text-red-500" />
                          <a 
                            href={`https://maps.google.com/?q=${report.check_in_lat},${report.check_in_lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-moss font-bold hover:underline"
                          >
                            Vị trí Check-in
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                      {/* Check-in */}
                      <div className="border border-white/30 rounded-2xl p-4 bg-white/20 backdrop-blur-sm">
                        <h4 className="font-bold text-moss-dark mb-2 flex items-center">
                          <Clock className="w-4 h-4 mr-2 text-moss" />
                          Check-in: {format(parseISO(report.check_in_time), 'HH:mm')}
                        </h4>
                        {report.has_check_in_photo === 1 ? (
                          <div 
                            className="relative group cursor-pointer overflow-hidden rounded-xl border border-white/40 shadow-inner h-48 flex items-center justify-center bg-white/30"
                            onClick={() => setSelectedImage({ src: `/api/reports/sale/${report.id}/image?photoType=check_in`, alt: `Check-in tại ${report.agency_name}` })}
                          >
                            <img 
                              src={`/api/reports/sale/${report.id}/image?photoType=check_in`} 
                              alt="Check-in" 
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <ImageIcon className="w-8 h-8 text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-48 bg-white/30 rounded-xl flex items-center justify-center text-moss-dark/50 font-medium border border-white/40 shadow-inner">
                            Không có ảnh
                          </div>
                        )}
                      </div>
  
                      {/* Check-out */}
                      <div className="border border-white/30 rounded-2xl p-4 bg-white/20 backdrop-blur-sm">
                        <h4 className="font-bold text-moss-dark mb-2 flex items-center">
                          <Clock className="w-4 h-4 mr-2 text-red-500" />
                          Check-out: {report.check_out_time ? format(parseISO(report.check_out_time), 'HH:mm') : 'Chưa check-out'}
                        </h4>
                        {report.has_check_out_photo === 1 ? (
                          <div 
                            className="relative group cursor-pointer overflow-hidden rounded-xl border border-white/40 shadow-inner h-48 flex items-center justify-center bg-white/30"
                            onClick={() => setSelectedImage({ src: `/api/reports/sale/${report.id}/image?photoType=check_out`, alt: `Check-out tại ${report.agency_name}` })}
                          >
                            <img 
                              src={`/api/reports/sale/${report.id}/image?photoType=check_out`} 
                              alt="Check-out" 
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <ImageIcon className="w-8 h-8 text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-48 bg-white/30 rounded-xl flex items-center justify-center text-moss-dark/50 font-medium border border-white/40 shadow-inner">
                            {report.check_out_time ? 'Không có ảnh' : 'Đang chờ...'}
                          </div>
                        )}
                        
                        {report.duration_minutes !== null && (
                          <p className="mt-3 text-sm font-bold text-moss-dark bg-moss/20 py-2 px-4 rounded-xl text-center border border-moss/30">
                            Thời gian làm việc: {report.duration_minutes} phút
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Notes and Orders */}
                    {(report.notes || !!report.has_order) && (
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {report.notes && (
                          <div className="bg-white/40 p-4 rounded-2xl border border-moss/20 shadow-sm">
                            <h4 className="font-bold text-moss-dark mb-2 flex items-center text-sm">
                              <FileText className="w-4 h-4 mr-2 text-moss" />
                              Ghi chú chăm sóc
                            </h4>
                            <p className="text-sm text-moss-dark/80 whitespace-pre-wrap leading-relaxed">{report.notes}</p>
                          </div>
                        )}
                        {!!report.has_order && (
                          <div className="bg-amber-500/10 p-4 rounded-2xl border border-amber-500/20 shadow-sm">
                            <h4 className="font-bold text-amber-700 mb-2 flex items-center text-sm">
                              <ShoppingCart className="w-4 h-4 mr-2 text-amber-600" />
                              Đơn hàng phát sinh
                            </h4>
                            <p className="text-sm text-moss-dark/80 whitespace-pre-wrap leading-relaxed">{report.order_details || 'Có đơn hàng nhưng không có chi tiết'}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            
            {/* Pagination Controls */}
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

      {selectedImage && (
        <ImageModal 
          src={selectedImage.src} 
          alt={selectedImage.alt} 
          isOpen={!!selectedImage} 
          onClose={() => setSelectedImage(null)} 
        />
      )}
    </div>
  );
}
