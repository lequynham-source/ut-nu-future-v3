import { useState, useEffect, memo, useCallback } from 'react';
import { Trophy, Calendar, Search } from 'lucide-react';
import { apiFetch } from '../../utils/api';
import LoadingOverlay from '../../components/LoadingOverlay';

// Memoized Row for performance
const KPIRow = memo(({ item, index, type }: any) => {
  const renderRankIcon = (idx: number) => {
    if (idx === 0) return <Trophy className="w-6 h-6 text-yellow-500" />;
    if (idx === 1) return <Trophy className="w-6 h-6 text-gray-400" />;
    if (idx === 2) return <Trophy className="w-6 h-6 text-amber-700" />;
    return <span className="w-6 h-6 flex items-center justify-center font-bold text-moss-dark/50">{idx + 1}</span>;
  };

  const isSale = type === 'sale';
  const score = isSale ? (item.total_points || 0) : item.total_deliveries;
  const unit = isSale ? 'điểm' : 'đơn';
  const scoreColor = isSale ? 'text-amber-600' : 'text-moss';
  const avatarBg = isSale ? 'bg-amber-500/20' : 'bg-moss/20';
  const avatarText = isSale ? 'text-amber-700' : 'text-moss-dark';

  return (
    <li className="py-4 flex items-center justify-between hover:bg-white/10 transition-colors px-2 rounded-xl">
      <div className="flex items-center gap-4">
        <div className="w-8 flex justify-center">{renderRankIcon(index)}</div>
        <div className={`w-10 h-10 rounded-full ${avatarBg} flex items-center justify-center overflow-hidden border border-white/40`}>
          {item.avatar_url ? (
            <img src={item.avatar_url} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <span className={`font-bold ${avatarText}`}>{item.name.charAt(0)}</span>
          )}
        </div>
        <span className="font-bold text-moss-dark text-lg">{item.name}</span>
      </div>
      <div className="text-right">
        <span className={`text-2xl font-black ${scoreColor}`}>{score}</span>
        <span className="text-sm text-moss-dark/70 ml-1">{unit}</span>
      </div>
    </li>
  );
});

export default function AdminKPI() {
  const [loading, setLoading] = useState(true);
  const [driverKpi, setDriverKpi] = useState<any[]>([]);
  const [saleKpi, setSaleKpi] = useState<any[]>([]);
  
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());

  const fetchKpi = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/kpi?month=${month}&year=${year}`);
      if (data && typeof data === 'object') {
        setDriverKpi(Array.isArray(data.driverKpi) ? data.driverKpi : []);
        setSaleKpi(Array.isArray(data.saleKpi) ? data.saleKpi : []);
      } else {
        setDriverKpi([]);
        setSaleKpi([]);
      }
    } catch (error) {
      console.error('Error fetching KPI:', error);
      setDriverKpi([]);
      setSaleKpi([]);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    fetchKpi();
  }, [fetchKpi]);

  return (
    <div className="space-y-6 relative z-10">
      <LoadingOverlay isLoading={loading} message="Đang tải bảng xếp hạng..." />
      
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-extrabold text-gradient">Bảng xếp hạng KPI</h1>
      </div>

      <div className="glass-panel p-6 rounded-3xl flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-bold text-moss-dark mb-1">Tháng</label>
          <select 
            className="glass-input block w-full rounded-xl sm:text-sm p-2.5"
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>Tháng {m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold text-moss-dark mb-1">Năm</label>
          <select 
            className="glass-input block w-full rounded-xl sm:text-sm p-2.5"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
          >
            {Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i).map(y => (
              <option key={y} value={y}>Năm {y}</option>
            ))}
          </select>
        </div>
        <button
          onClick={fetchKpi}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-moss text-white rounded-xl font-bold hover:bg-moss-dark transition-all shadow-md active:scale-95"
        >
          <Search className="w-5 h-5" />
          Xem KPI
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Driver KPI */}
        <div className="glass-panel rounded-3xl overflow-hidden">
          <div className="bg-moss/10 p-4 border-b border-white/20">
            <h2 className="text-xl font-bold text-moss-dark flex items-center gap-2">
              <Trophy className="text-yellow-500" />
              Top Tài xế (Số đơn giao)
            </h2>
          </div>
          <div className="p-4">
            {driverKpi.length === 0 ? (
              <p className="text-center text-moss-dark/60 py-4">Chưa có dữ liệu trong tháng này</p>
            ) : (
              <ul className="divide-y divide-white/20">
                {driverKpi.map((driver, index) => (
                  <KPIRow key={driver.id} item={driver} index={index} type="driver" />
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Sale KPI */}
        <div className="glass-panel rounded-3xl overflow-hidden">
          <div className="bg-amber-500/10 p-4 border-b border-white/20">
            <h2 className="text-xl font-bold text-amber-700 flex items-center gap-2">
              <Trophy className="text-yellow-500" />
              Top Nhân viên Sale (Tổng điểm KPI)
            </h2>
          </div>
          <div className="p-4">
            {saleKpi.length === 0 ? (
              <p className="text-center text-moss-dark/60 py-4">Chưa có dữ liệu trong tháng này</p>
            ) : (
              <ul className="divide-y divide-white/20">
                {saleKpi.map((sale, index) => (
                  <KPIRow key={sale.id} item={sale} index={index} type="sale" />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
