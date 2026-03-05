import { useState, useEffect, useMemo, useRef, memo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { format, parseISO } from 'date-fns';
import { MapPin, User, Truck, Calendar, Clock, Filter, Search, Navigation } from 'lucide-react';
import LoadingOverlay from '../../components/LoadingOverlay';

// Memoized Marker Components for performance
const ActiveDriverMarker = memo(({ id, driver }: any) => (
  <Marker position={[driver.location.lat, driver.location.lng]} icon={DriverIcon}>
    <Popup>
      <div className="p-2 space-y-2 min-w-[150px]">
        <div className="flex items-center gap-2 font-black text-moss-dark border-b border-moss/20 pb-1">
          <Navigation className="w-4 h-4 text-moss animate-pulse" />
          <span>ĐANG DI CHUYỂN</span>
        </div>
        <div className="space-y-1 text-sm">
          <p><strong>Tài xế:</strong> {driver.name}</p>
          <p className="text-[10px] text-moss-dark/50 italic">Cập nhật: {format(parseISO(driver.timestamp), 'HH:mm:ss')}</p>
        </div>
      </div>
    </Popup>
  </Marker>
));

const DriverReportMarker = memo(({ report }: any) => (
  <Marker position={[report.location_lat, report.location_lng]}>
    <Popup>
      <div className="p-2 space-y-2 min-w-[200px]">
        <div className="flex items-center gap-2 font-bold text-moss-dark border-b border-moss/20 pb-1">
          <Truck className="w-4 h-4" />
          <span>{report.agency_name}</span>
        </div>
        <div className="space-y-1 text-sm">
          <p className="flex items-center gap-2">
            <User className="w-3 h-3 text-moss" />
            <strong>Tài xế:</strong> {report.driver_name}
          </p>
          <p className="flex items-center gap-2">
            <Truck className="w-3 h-3 text-moss" />
            <strong>Số xe:</strong> {report.license_plate}
          </p>
          <p className="flex items-center gap-2">
            <Clock className="w-3 h-3 text-moss" />
            <strong>Thời gian:</strong> {format(parseISO(report.timestamp), 'dd/MM HH:mm')}
          </p>
          <p className="font-bold text-moss">
            Số tiền: {(!isNaN(parseFloat(report.money_amount)) && isFinite(report.money_amount as any))
              ? `VNĐ ${Number(report.money_amount).toLocaleString('vi-VN')}` 
              : report.money_amount}
          </p>
        </div>
        {report.photo_url && (
          <img src={report.photo_url} alt="Biên lai" className="w-full h-24 object-cover rounded-lg mt-2" />
        )}
      </div>
    </Popup>
  </Marker>
));

const SaleReportMarker = memo(({ report }: any) => (
  <Marker position={[report.check_in_lat, report.check_in_lng]}>
    <Popup>
      <div className="p-2 space-y-2 min-w-[200px]">
        <div className="flex items-center gap-2 font-bold text-amber-600 border-b border-amber-200 pb-1">
          <MapPin className="w-4 h-4" />
          <span>{report.agency_name} (Sale)</span>
        </div>
        <div className="space-y-1 text-sm">
          <p className="flex items-center gap-2">
            <User className="w-3 h-3 text-amber-600" />
            <strong>Nhân viên:</strong> {report.sale_name}
          </p>
          <p className="flex items-center gap-2">
            <Clock className="w-3 h-3 text-amber-600" />
            <strong>Check-in:</strong> {format(parseISO(report.check_in_time), 'dd/MM HH:mm')}
          </p>
          {report.check_out_time && (
            <p className="flex items-center gap-2">
              <Clock className="w-3 h-3 text-red-500" />
              <strong>Check-out:</strong> {format(parseISO(report.check_out_time), 'HH:mm')}
            </p>
          )}
        </div>
        {report.check_in_photo_url && (
          <img src={report.check_in_photo_url} alt="Check-in" className="w-full h-24 object-cover rounded-lg mt-2" />
        )}
      </div>
    </Popup>
  </Marker>
));

// Fix Leaflet icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

// Driver icon
const DriverIcon = L.divIcon({
  html: `<div class="p-2 bg-moss text-white rounded-full shadow-lg border-2 border-white animate-bounce"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.28a1 1 0 0 0-.684-.948l-1.923-.641a1 1 0 0 1-.684-.948V10a1 1 0 0 0-1-1h-3"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg></div>`,
  className: 'custom-div-icon',
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});

L.Marker.prototype.options.icon = DefaultIcon;

import { apiFetch, addWSListener } from '../../utils/api';

export default function AdminMapView() {
  const [allDriverReports, setAllDriverReports] = useState<any[]>([]);
  const [allSaleReports, setAllSaleReports] = useState<any[]>([]);
  const [activeDrivers, setActiveDrivers] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<WebSocket | null>(null);

  // Filter states
  const today = format(new Date(), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [showDrivers, setShowDrivers] = useState(true);
  const [showSales, setShowSales] = useState(true);
  const [showActive, setShowActive] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.append('startDate', startDate);
      if (endDate) queryParams.append('endDate', endDate);
      queryParams.append('limit', '10000'); // Fetch all for map
      
      const [dData, sData] = await Promise.all([
        apiFetch(`/api/driver-reports?${queryParams.toString()}`),
        apiFetch(`/api/sale-reports?${queryParams.toString()}`)
      ]);
      
      setAllDriverReports(dData.data || []);
      setAllSaleReports(sData.data || []);
    } catch (error) {
      console.error('Error fetching reports for map:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // WebSocket for real-time tracking
    const removeListener = addWSListener((data) => {
      if (data.type === 'location_update') {
        setActiveDrivers(prev => {
          const newMap = new Map(prev);
          newMap.set(data.userId, {
            name: data.name,
            location: data.location,
            timestamp: new Date().toISOString()
          });
          return newMap;
        });
      }
      
      if (data.type === 'locations') {
        setActiveDrivers(prev => {
          const newMap = new Map(prev);
          data.locations.forEach((loc: any) => {
            newMap.set(loc.userId, {
              name: loc.name,
              location: loc.location,
              timestamp: new Date().toISOString()
            });
          });
          return newMap;
        });
      }
    });

    return () => removeListener();
  }, []);

  const handleFilter = () => {
    fetchData();
  };

  const filteredDriverReports = useMemo(() => {
    if (!showDrivers) return [];
    return allDriverReports;
  }, [allDriverReports, showDrivers]);

  const filteredSaleReports = useMemo(() => {
    if (!showSales) return [];
    return allSaleReports;
  }, [allSaleReports, showSales]);

  const center: [number, number] = [10.59616, 107.24222]; // Công ty Út Nữ

  if (loading) {
    return (
      <div className="space-y-6 relative z-10">
        <LoadingOverlay isLoading={loading} message="Đang tải dữ liệu bản đồ..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 relative z-10">
      <LoadingOverlay isLoading={loading} message="Đang tải dữ liệu bản đồ..." />
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-extrabold text-gradient">Bản đồ trực quan</h1>
        <div className="text-sm font-bold text-moss-dark bg-white/40 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/50">
          Hiển thị: {filteredDriverReports.length + filteredSaleReports.length} điểm
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel p-6 rounded-3xl space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Filter className="w-5 h-5 text-moss-dark" />
          <h2 className="text-lg font-bold text-moss-dark">Bộ lọc bản đồ</h2>
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
          <div className="flex items-center gap-4 h-11">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                className="w-5 h-5 rounded border-moss text-moss focus:ring-moss"
                checked={showDrivers}
                onChange={(e) => setShowDrivers(e.target.checked)}
              />
              <span className="text-sm font-bold text-moss-dark group-hover:text-moss transition-colors">Tài xế</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                className="w-5 h-5 rounded border-amber-500 text-amber-500 focus:ring-amber-500"
                checked={showSales}
                onChange={(e) => setShowSales(e.target.checked)}
              />
              <span className="text-sm font-bold text-moss-dark group-hover:text-amber-600 transition-colors">Sale</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                className="w-5 h-5 rounded border-green-500 text-green-500 focus:ring-green-500"
                checked={showActive}
                onChange={(e) => setShowActive(e.target.checked)}
              />
              <span className="text-sm font-bold text-moss-dark group-hover:text-green-600 transition-colors">Đang hoạt động</span>
            </label>
          </div>
          <div className="lg:col-span-2">
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

      <div className="glass-panel rounded-3xl overflow-hidden h-[70vh] border-2 border-white/50 shadow-2xl">
        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* Active Driver Markers */}
          {showActive && Array.from(activeDrivers.entries()).map(([id, driver]) => (
            <ActiveDriverMarker key={`active-${id}`} id={id} driver={driver} />
          ))}

          {/* Driver Markers */}
          {filteredDriverReports.map((report) => (
            report.location_lat && report.location_lng && (
              <DriverReportMarker key={`driver-${report.id}`} report={report} />
            )
          ))}

          {/* Sale Markers */}
          {filteredSaleReports.map((report) => (
            report.check_in_lat && report.check_in_lng && (
              <SaleReportMarker key={`sale-${report.id}`} report={report} />
            )
          ))}
        </MapContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-panel p-4 rounded-2xl flex items-center gap-4">
          <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
          <p className="text-sm font-bold text-moss-dark">Điểm giao hàng (Tài xế)</p>
        </div>
        <div className="glass-panel p-4 rounded-2xl flex items-center gap-4">
          <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
          <p className="text-sm font-bold text-moss-dark">Điểm chăm sóc (Sale)</p>
        </div>
      </div>
    </div>
  );
}
