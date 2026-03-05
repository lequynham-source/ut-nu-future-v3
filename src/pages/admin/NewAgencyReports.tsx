import React, { useState, useEffect } from 'react';
import { ShoppingCart, MapPin, Phone, Calendar, User, FileText, ExternalLink, Search, Filter, Camera } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { apiFetch } from '../../utils/api';
import LoadingOverlay from '../../components/LoadingOverlay';

export default function NewAgencyReports() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/new-agency-reports');
      setReports(data);
    } catch (error) {
      console.error('Error fetching new agency reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = reports.filter(report => 
    report.agency_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.sale_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <LoadingOverlay isLoading={loading} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Báo cáo Mở Đại lý mới</h1>
          <p className="text-gray-500 text-sm">Theo dõi chỉ tiêu KPI mở mới của đội ngũ Sale</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm kiếm đại lý, nhân viên..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 w-full md:w-80 transition-all"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredReports.map((report) => (
          <div key={report.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex flex-col sm:flex-row">
              {/* Photo Section */}
              <div className="sm:w-48 h-48 sm:h-auto relative group cursor-pointer" onClick={() => setSelectedImage(report.photo_url)}>
                <img 
                  src={report.photo_url} 
                  alt={report.agency_name} 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-8 h-8 text-white" />
                </div>
              </div>

              {/* Info Section */}
              <div className="flex-1 p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{report.agency_name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
                        Đại lý mới
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(parseISO(report.created_at), 'HH:mm dd/MM/yyyy')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-start gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-600 line-clamp-2">{report.address}</span>
                  </div>
                  
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-600">{report.phone || 'Chưa cập nhật'}</span>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-900 font-semibold">Sale: {report.sale_name}</span>
                  </div>
                </div>

                {report.notes && (
                  <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-600 italic flex gap-2">
                    <FileText className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    {report.notes}
                  </div>
                )}

                <div className="pt-2 flex gap-2">
                  {report.lat && report.lng && (
                    <a
                      href={`https://www.google.com/maps?q=${report.lat},${report.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors"
                    >
                      <MapPin className="w-3 h-3" />
                      Xem vị trí
                    </a>
                  )}
                  <button
                    onClick={() => setSelectedImage(report.photo_url)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-50 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-100 transition-colors"
                  >
                    <Camera className="w-3 h-3" />
                    Xem ảnh
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredReports.length === 0 && !loading && (
        <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200">
          <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900">Chưa có báo cáo nào</h3>
          <p className="text-gray-500">Các báo cáo mở đại lý mới sẽ xuất hiện tại đây</p>
        </div>
      )}

      {/* Image Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl w-full">
            <button 
              className="absolute -top-12 right-0 text-white hover:text-gray-300"
              onClick={() => setSelectedImage(null)}
            >
              <X className="w-8 h-8" />
            </button>
            <img src={selectedImage} alt="Full size" className="w-full h-auto max-h-[80vh] object-contain rounded-lg" />
          </div>
        </div>
      )}
    </div>
  );
}

function X({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
  );
}
