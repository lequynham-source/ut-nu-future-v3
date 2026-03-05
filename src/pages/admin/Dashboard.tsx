import { useState, useEffect, useMemo, memo } from 'react';
import { AlertTriangle, Users, Truck, FileText, ClipboardList, TrendingUp, Database, CheckCircle2, XCircle } from 'lucide-react';
import { isBefore, addDays, parseISO, differenceInDays, format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../utils/api';
import LoadingOverlay from '../../components/LoadingOverlay';

// Memoized Stat Card for performance
const StatCard = memo(({ title, value, icon: Icon, onClick, isPrimary = false }: any) => (
  <button 
    onClick={onClick}
    className={`${isPrimary ? 'glass-panel p-8 rounded-3xl' : 'glass-panel p-5 rounded-2xl'} overflow-hidden text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl group active:scale-95 w-full`}
  >
    <div className="flex items-center justify-between">
      <div className="flex-1 min-w-0">
        <p className={`${isPrimary ? 'text-lg text-moss-dark/70' : 'text-sm text-moss-dark/70'} font-bold mb-1 truncate`}>{title}</p>
        <h2 className={`${isPrimary ? 'text-6xl' : 'text-2xl'} font-black text-moss-dark group-hover:text-moss transition-colors`}>
          {value}
        </h2>
        {isPrimary && (
          <p className="mt-4 text-sm font-bold text-moss flex items-center gap-1">
            Xem chi tiết báo cáo <TrendingUp className="w-4 h-4" />
          </p>
        )}
      </div>
      <div className={`${isPrimary ? 'bg-moss/20 p-6 rounded-2xl' : 'bg-moss/20 p-3 rounded-xl'} group-hover:bg-moss/30 transition-colors flex-shrink-0 ml-4`}>
        <Icon className={`${isPrimary ? 'h-12 w-12' : 'h-6 w-6'} text-moss-dark`} />
      </div>
    </div>
  </button>
));

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [stats, setStats] = useState({ 
    users: 0, 
    vehicles: 0, 
    reports: 0,
    todayDeliveries: 0,
    todaySales: 0
  });

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchData(), checkDbStatus()]);
      setLoading(false);
    };
    init();
  }, []);

  const checkDbStatus = async () => {
    try {
      const data = await apiFetch('/api/db-status');
      setDbStatus(data.status === 'connected' ? 'connected' : 'error');
    } catch (error) {
      setDbStatus('error');
    }
  };

  const fetchData = async () => {
    try {
      const [vData, statsData] = await Promise.all([
        apiFetch('/api/vehicles'),
        apiFetch('/api/dashboard-stats')
      ]);
      setVehicles(vData);
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching data', error);
    }
  };

  const checkExpiring = (dateString: string) => {
    if (!dateString) return false;
    const date = parseISO(dateString);
    const warningDate = addDays(new Date(), 30);
    return isBefore(date, warningDate);
  };

  const getExpiryInfo = (dateString: string) => {
    if (!dateString) return 'Chưa có';
    const expiryDate = parseISO(dateString);
    const today = new Date();
    const daysLeft = differenceInDays(expiryDate, today);
    const formattedDate = format(expiryDate, 'dd/MM/yy');
    
    if (daysLeft < 0) {
      return (
        <span className="text-red-600 font-black animate-pulse bg-red-100 px-2 py-1 rounded-lg">
          {formattedDate} (Quá hạn {Math.abs(daysLeft)} ngày - NGUY HIỂM)
        </span>
      );
    }
    if (daysLeft <= 7) {
      return (
        <span className="text-orange-600 font-black bg-orange-100 px-2 py-1 rounded-lg">
          {formattedDate} (Sắp hết hạn: {daysLeft} ngày)
        </span>
      );
    }
    return `${formattedDate} (Còn ${daysLeft} ngày)`;
  };

  // Optimize heavy filtering with useMemo
  const expiringVehicles = useMemo(() => 
    vehicles.filter(v => checkExpiring(v.insurance_expiry) || checkExpiring(v.registration_expiry)),
    [vehicles]
  );

  const goToTodayDriverReports = () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    navigate(`/driver-reports?startDate=${todayStr}&endDate=${todayStr}`);
  };

  const goToTodaySaleReports = () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    navigate(`/sale-reports?startDate=${todayStr}&endDate=${todayStr}`);
  };

  return (
    <div className="space-y-6 relative z-10">
      <LoadingOverlay isLoading={loading} message="Đang tải dữ liệu tổng quan..." />
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-extrabold text-gradient">Tổng quan</h1>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${
            dbStatus === 'connected' 
              ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
              : dbStatus === 'error'
                ? 'bg-red-100 text-red-700 border-red-200'
                : 'bg-gray-100 text-gray-700 border-gray-200'
          }`}>
            {dbStatus === 'connected' ? (
              <><CheckCircle2 className="w-3 h-3" /> Tình trạng thiết bị: OK</>
            ) : dbStatus === 'error' ? (
              <><XCircle className="w-3 h-3" /> Tình trạng thiết bị: Lỗi</>
            ) : (
              <><Database className="w-3 h-3 animate-pulse" /> Đang kiểm tra...</>
            )}
          </div>
        </div>
        <div className="text-sm font-bold text-moss-dark bg-white/40 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/50">
          Hôm nay: {format(new Date(), 'dd/MM/yyyy')}
        </div>
      </div>
      
      {/* Primary Stats for Today */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StatCard 
          title="Đơn Đã Giao (Hôm nay)"
          value={stats.todayDeliveries}
          icon={Truck}
          onClick={goToTodayDriverReports}
          isPrimary
        />
        <StatCard 
          title="Điểm KPI Sale (Hôm nay)"
          value={stats.todaySales}
          icon={ClipboardList}
          onClick={goToTodaySaleReports}
          isPrimary
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatCard 
          title="Tổng nhân sự"
          value={stats.users}
          icon={Users}
          onClick={() => navigate('/users')}
        />
        <StatCard 
          title="Tổng xe"
          value={stats.vehicles}
          icon={Truck}
          onClick={() => navigate('/vehicles')}
        />
        <StatCard 
          title="Tổng đơn (Lịch sử)"
          value={stats.reports}
          icon={FileText}
          onClick={() => navigate('/driver-reports')}
        />
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-white/20 bg-white/10">
          <h3 className="text-lg leading-6 font-bold text-moss-dark flex items-center">
            <AlertTriangle className="mr-2 h-5 w-5 text-amber-600" />
            Cảnh báo hạn đăng kiểm / bảo hiểm (Sắp hết hạn trong 30 ngày)
          </h3>
        </div>
        <div className="px-4 py-5 sm:p-0">
          {expiringVehicles.length === 0 ? (
            <p className="p-6 text-sm font-medium text-moss-dark/70 text-center">Không có xe nào sắp hết hạn.</p>
          ) : (
            <ul className="divide-y divide-white/20">
              {expiringVehicles.map((vehicle) => (
                <li key={vehicle.id} className="py-4 px-4 sm:px-6 flex items-center justify-between hover:bg-white/10 transition-colors">
                  <div className="flex items-center">
                    <p className="text-sm font-bold text-moss-dark truncate">{vehicle.license_plate}</p>
                  </div>
                  <div className="ml-2 flex-shrink-0 flex flex-col items-end text-sm text-moss-dark/70">
                    <p className={checkExpiring(vehicle.insurance_expiry) ? "text-red-600 font-bold" : "font-medium"}>
                      Bảo hiểm: {getExpiryInfo(vehicle.insurance_expiry)}
                    </p>
                    <p className={checkExpiring(vehicle.registration_expiry) ? "text-red-600 font-bold" : "font-medium"}>
                      Đăng kiểm: {getExpiryInfo(vehicle.registration_expiry)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
