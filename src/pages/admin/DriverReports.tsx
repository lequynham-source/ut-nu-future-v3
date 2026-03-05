import { useState, useEffect, useMemo } from 'react';
import { MapPin, Calendar, DollarSign, Image as ImageIcon, Search, Filter, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import ImageModal from '../../components/ImageModal';
import LoadingOverlay from '../../components/LoadingOverlay';
import * as XLSX from 'xlsx';

import { apiFetch } from '../../utils/api';

export default function AdminDriverReports() {
  const [searchParams] = useSearchParams();
  const [reports, setReports] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedImage, setSelectedImage] = useState<{ src: string, alt: string } | null>(null);
  const [fetchingPhoto, setFetchingPhoto] = useState<number | null>(null);

  const today = format(new Date(), 'yyyy-MM-dd');
  // Filter states
  const [startDate, setStartDate] = useState(searchParams.get('startDate') || today);
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || today);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchDrivers();
    fetchVehicles();
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

      const res = await apiFetch(`/api/driver-reports?${queryParams.toString()}`);
      const allData = res.data || [];

      const dataToExport = allData.filter((report: any) => {
        if (selectedDriver && report.driver_id !== parseInt(selectedDriver)) return false;
        if (selectedVehicle && report.vehicle_id !== parseInt(selectedVehicle)) return false;
        return true;
      }).map((report: any) => {
        const isNumeric = !isNaN(parseFloat(report.money_amount)) && isFinite(report.money_amount as any);
        const formattedMoney = isNumeric 
          ? `VNĐ ${Number(report.money_amount).toLocaleString('vi-VN')}` 
          : report.money_amount;

        return {
          'Ngày giờ': format(parseISO(report.timestamp), 'dd/MM/yyyy HH:mm'),
          'Đại lý': report.agency_name,
          'Tài xế': report.driver_name,
          'Số xe': report.license_plate,
          'Số tiền': formattedMoney,
          'Vị trí': `${report.location_lat}, ${report.location_lng}`,
          'Ảnh': report.has_photo === 1 ? 'Có ảnh' : 'Không có ảnh'
        };
      });

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Báo cáo Tài xế");
      XLSX.writeFile(wb, `Bao_cao_Tai_xe_${format(new Date(), 'ddMMyyyy_HHmm')}.xlsx`);
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
      
      const res = await apiFetch(`/api/driver-reports?${queryParams.toString()}`);
      setReports(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDrivers = async () => {
    try {
      const data = await apiFetch('/api/users');
      if (Array.isArray(data)) {
        setDrivers(data.filter((u: any) => u.role === 'driver'));
      } else {
        console.error('API returned non-array data for users:', data);
        setDrivers([]);
      }
    } catch (error) {
      console.error(error);
      setDrivers([]);
    }
  };

  const fetchVehicles = async () => {
    try {
      const data = await apiFetch('/api/vehicles');
      if (Array.isArray(data)) {
        setVehicles(data);
      } else {
        console.error('API returned non-array data for vehicles:', data);
        setVehicles([]);
      }
    } catch (error) {
      console.error(error);
      setVehicles([]);
    }
  };

  const handleViewPhoto = async (report: any) => {
    setFetchingPhoto(report.id);
    try {
      const res = await apiFetch(`/api/reports/driver/${report.id}/photo`);
      if (res.success && res.photo_url) {
        setSelectedImage({ src: res.photo_url, alt: `Biên lai từ ${report.agency_name}` });
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

      if (selectedDriver && report.driver_id !== parseInt(selectedDriver)) {
        match = false;
      }
      if (selectedVehicle && report.vehicle_id !== parseInt(selectedVehicle)) {
        match = false;
      }

      return match;
    });
  }, [reports, selectedDriver, selectedVehicle]);

  return (
    <div className="space-y-6 relative z-10">
      <LoadingOverlay isLoading={loading} message="Đang tải dữ liệu báo cáo..." />
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-extrabold text-gradient">Báo cáo Tài xế</h1>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
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
            <label className="block text-sm font-bold text-moss-dark mb-1">Tài xế</label>
            <select
              className="glass-input block w-full rounded-xl sm:text-sm p-2.5"
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
            >
              <option value="">Tất cả tài xế</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-moss-dark mb-1">Số xe</label>
            <select
              className="glass-input block w-full rounded-xl sm:text-sm p-2.5"
              value={selectedVehicle}
              onChange={(e) => setSelectedVehicle(e.target.value)}
            >
              <option value="">Tất cả xe</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.license_plate}</option>
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
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-lg font-bold text-moss-dark truncate">
                          {report.agency_name}
                        </p>
                        <div className="flex items-center text-sm font-medium text-moss-dark/70 bg-white/30 px-3 py-1 rounded-lg backdrop-blur-sm">
                          <Calendar className="flex-shrink-0 mr-1.5 h-4 w-4 text-moss" />
                          <p>{format(parseISO(report.timestamp), 'dd/MM/yyyy HH:mm')}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-moss-dark/80 mt-2">
                        <p className="bg-white/20 px-3 py-2 rounded-xl backdrop-blur-sm border border-white/30"><strong>Tài xế:</strong> {report.driver_name}</p>
                        <p className="bg-white/20 px-3 py-2 rounded-xl backdrop-blur-sm border border-white/30"><strong>Số xe:</strong> {report.license_plate}</p>
                        <div className="flex items-center text-moss-dark font-bold bg-moss/20 px-3 py-2 rounded-xl backdrop-blur-sm border border-moss/30">
                          <DollarSign className="mr-1 h-4 w-4 text-moss" />
                          {(!isNaN(parseFloat(report.money_amount)) && isFinite(report.money_amount as any))
                            ? `VNĐ ${Number(report.money_amount).toLocaleString('vi-VN')}` 
                            : report.money_amount}
                        </div>
                        {report.location_lat && report.location_lng && (
                          <div className="flex items-center bg-white/20 px-3 py-2 rounded-xl backdrop-blur-sm border border-white/30">
                            <MapPin className="mr-1 h-4 w-4 text-red-500" />
                            <a 
                              href={`https://maps.google.com/?q=${report.location_lat},${report.location_lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-moss font-bold hover:underline"
                            >
                              Xem vị trí
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {report.has_photo === 1 && (
                      <div 
                        className="flex-shrink-0 w-full md:w-48 h-32 bg-white/30 rounded-2xl overflow-hidden relative border-2 border-white/50 shadow-inner cursor-pointer group"
                        onClick={() => setSelectedImage({ src: `/api/reports/driver/${report.id}/image`, alt: `Biên lai từ ${report.agency_name}` })}
                      >
                        <img 
                          src={`/api/reports/driver/${report.id}/image`} 
                          alt="Tiền thu" 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-white" />
                        </div>
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
