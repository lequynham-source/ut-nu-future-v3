import React, { useState, useEffect, useRef } from 'react';
import { Camera, MapPin, Upload, Info, Receipt, Pencil, X, Clock, History, PackageMinus, ScanLine, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { format, parseISO, differenceInDays, differenceInHours } from 'date-fns';
import SuccessModal from '../../components/SuccessModal';
import LoadingOverlay from '../../components/LoadingOverlay';
import { apiFetch, sendWSMessage } from '../../utils/api';
import { compressImage } from '../../utils/imageCompression';
import { saveOfflineReport, setCache, getCache } from '../../utils/db';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { findNearestAgency } from '../../utils/location';

export default function DriverDashboard({ user }: { user: any }) {
  const { isOnline, pendingCount, isSyncing, syncReports, updatePendingCount } = useOfflineSync();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [showAgencyDropdown, setShowAgencyDropdown] = useState(false);
  const [showReturnAgencyDropdown, setShowReturnAgencyDropdown] = useState(false);
  const [formData, setFormData] = useState({
    vehicle_id: '',
    agency_name: '',
    money_amount: '',
  });
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'none'>('cash');
  const [photo, setPhoto] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'report' | 'expiry' | 'expense' | 'return'>('report');
  const [expiryFormData, setExpiryFormData] = useState({
    vehicle_id: '',
    insurance_expiry: '',
    registration_expiry: '',
  });
  const [expiryLoading, setExpiryLoading] = useState(false);
  const [todayReports, setTodayReports] = useState<any[]>([]);
  const [editingReport, setEditingReport] = useState<any>(null);

  const [expenseFormData, setExpenseFormData] = useState({
    vehicle_id: '',
    amount: '',
    description: '',
  });
  const [expensePhoto, setExpensePhoto] = useState<string | null>(null);
  const expenseFileInputRef = useRef<HTMLInputElement>(null);

  const [returnFormData, setReturnFormData] = useState({
    agency_name: '',
    product_name: '',
    quantity: '',
    reason: '',
  });
  const [returnPhoto, setReturnPhoto] = useState<string | null>(null);
  const returnFileInputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    fetchVehicles();
    getLocation();
    fetchTodayReports();
    fetchAgencies();

    const handleVoiceReport = () => {
      setActiveTab('report');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('voice_report_delivered', handleVoiceReport);
    return () => window.removeEventListener('voice_report_delivered', handleVoiceReport);
  }, []);

  // Suggest nearest agency based on location
  useEffect(() => {
    if (location && agencies.length > 0) {
      const nearest = findNearestAgency(location, agencies, 500); // 500m threshold
      if (nearest) {
        if (!formData.agency_name) {
          setFormData(prev => ({ ...prev, agency_name: nearest.name }));
        }
        if (!returnFormData.agency_name) {
          setReturnFormData(prev => ({ ...prev, agency_name: nearest.name }));
        }
      }
    }
  }, [location, agencies]);

  const fetchAgencies = async () => {
    try {
      const data = await apiFetch('/api/agencies');
      setAgencies(data);
      await setCache('agenciesList', data);
    } catch (error) {
      const cached = await getCache('agenciesList');
      if (cached) setAgencies(cached);
    }
  };

  const fetchTodayReports = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      if (!isOnline) {
        const cached = await getCache('todayReports');
        if (cached) setTodayReports(cached);
        return;
      }
      // Fetch enough reports to cover the day
      const data = await apiFetch(`/api/driver-reports?startDate=${today}&endDate=${today}&limit=100`);
      if (data && data.data) {
        // Filter for current user
        const myReports = data.data.filter((r: any) => r.driver_id === user.id);
        setTodayReports(myReports);
        await setCache('todayReports', myReports);
      }
    } catch (error) {
      console.error('Error fetching today reports:', error);
    }
  };

  const fetchVehicles = async () => {
    try {
      if (!isOnline) {
        const cached = await getCache('vehicles');
        if (cached) setVehicles(cached);
        return;
      }
      const data = await apiFetch('/api/vehicles');
      if (Array.isArray(data)) {
        setVehicles(data);
        await setCache('vehicles', data);
      } else {
        console.error('API returned non-array data for vehicles:', data);
        setVehicles([]);
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      const cached = await getCache('vehicles');
      if (cached) setVehicles(cached);
      else setVehicles([]);
    }
  };

  const handleVehicleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const vehicleId = e.target.value;
    setFormData({ ...formData, vehicle_id: vehicleId });
    
    // Save to local storage with timestamp
    if (vehicleId) {
      localStorage.setItem('defaultVehicle', JSON.stringify({
        id: vehicleId,
        timestamp: new Date().getTime()
      }));
      
      // Also update other forms for convenience
      setExpenseFormData(prev => ({ ...prev, vehicle_id: vehicleId }));
      setExpiryFormData(prev => ({ ...prev, vehicle_id: vehicleId }));
    }
  };

  const handleExpirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expiryFormData.vehicle_id) {
      alert('Vui lòng chọn xe.');
      return;
    }

    setExpiryLoading(true);
    try {
      await apiFetch(`/api/vehicles/${expiryFormData.vehicle_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insurance_expiry: expiryFormData.insurance_expiry,
          registration_expiry: expiryFormData.registration_expiry,
        }),
      });

      alert('Cập nhật hạn đăng kiểm/bảo hiểm thành công!');
      fetchVehicles();
      setExpiryFormData({ vehicle_id: '', insurance_expiry: '', registration_expiry: '' });
      setActiveTab('report');
    } catch (error) {
      alert('Lỗi khi cập nhật hoặc kết nối.');
    } finally {
      setExpiryLoading(false);
    }
  };

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Error getting location", error);
          alert("Không thể lấy vị trí. Vui lòng bật định vị.");
        }
      );
    }
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLoading(true);
      try {
        const compressed = await compressImage(file, 1280, 1280, 0.7);
        setPhoto(compressed);
      } catch (error) {
        console.error("Error compressing image", error);
        const reader = new FileReader();
        reader.onloadend = () => {
          setPhoto(reader.result as string);
        };
        reader.readAsDataURL(file);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleMoneyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove non-digit characters
    const value = e.target.value.replace(/\D/g, '');
    if (value === '') {
      setFormData({ ...formData, money_amount: '' });
      return;
    }
    // Format with commas
    const formattedValue = parseInt(value, 10).toLocaleString('en-US');
    setFormData({ ...formData, money_amount: formattedValue });
  };

  const scanReceipt = async () => {
    if (!photo) {
      alert('Vui lòng chụp ảnh tiền hoặc biên lai trước khi quét.');
      return;
    }

    setIsScanning(true);
    try {
      const data = await apiFetch('/api/ai/extract-money', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: photo })
      });

      if (data.success && data.amount && data.amount !== '0') {
        const formatted = parseInt(data.amount, 10).toLocaleString('en-US');
        setFormData(prev => ({ ...prev, money_amount: formatted }));
      } else {
        alert('Không tìm thấy số tiền trong ảnh. Anh/chị vui lòng tự điền nhé!');
      }
    } catch (error) {
      console.error('Vision error:', error);
      alert('Lỗi khi phân tích ảnh. Anh/chị vui lòng tự điền nhé!');
    } finally {
      setIsScanning(false);
    }
  };

  const requestHelp = () => {
    if (!location) {
      alert('Chưa có vị trí, không thể gửi yêu cầu giúp đỡ.');
      return;
    }
    sendWSMessage('help_request', {
      location,
      message: 'Tôi đang gặp sự cố trên đường, cần anh em hỗ trợ!'
    });
    alert('Đã gửi yêu cầu giúp đỡ đến các tài xế khác!');
  };

  const getExpiryInfo = (dateString: string) => {
    if (!dateString) return 'Chưa cập nhật';
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

  const selectedVehicle = vehicles.find(v => v.id.toString() === formData.vehicle_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Photo is mandatory for cash, optional for transfer and none
    if (paymentMethod === 'cash' && !photo) {
      alert('Vui lòng chụp ảnh số tiền thu được.');
      return;
    }
    
    if (!location && !editingReport) {
      alert('Đang lấy vị trí, vui lòng thử lại sau vài giây.');
      getLocation();
      return;
    }

    setLoading(true);
    let finalMoneyAmount: string | number = formData.money_amount.replace(/,/g, '');
    
    if (paymentMethod === 'transfer') {
      finalMoneyAmount = 'Chuyển Khoản Ngân Hàng';
    } else if (paymentMethod === 'none') {
      finalMoneyAmount = 'Không Trả Tiền';
    } else {
      finalMoneyAmount = parseFloat(finalMoneyAmount as string);
    }

    try {
      if (editingReport) {
        if (!isOnline) {
          alert('Chỉ có thể chỉnh sửa báo cáo khi có mạng.');
          return;
        }
        await apiFetch(`/api/driver-reports/${editingReport.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vehicle_id: formData.vehicle_id,
            agency_name: formData.agency_name,
            money_amount: finalMoneyAmount,
            photo_url: photo,
          }),
        });
        alert('Cập nhật báo cáo thành công!');
        setEditingReport(null);
      } else {
        const reportData = {
          driver_id: user.id,
          vehicle_id: formData.vehicle_id,
          agency_name: formData.agency_name,
          money_amount: finalMoneyAmount,
          photo_url: photo,
          location_lat: location?.lat || 0,
          location_lng: location?.lng || 0,
          timestamp: new Date().toISOString(),
        };

        if (!isOnline) {
          await saveOfflineReport({
            type: 'driver',
            data: reportData,
            timestamp: reportData.timestamp,
          });
          await updatePendingCount();
          alert('Đã lưu báo cáo ngoại tuyến. Dữ liệu sẽ được đồng bộ khi có mạng.');
        } else {
          await apiFetch('/api/driver-reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reportData),
          });
          setShowSuccess(true);
        }
      }

      setFormData({ vehicle_id: formData.vehicle_id, agency_name: '', money_amount: '' }); // Keep vehicle_id
      setPaymentMethod('cash');
      setPhoto(null);
      fetchTodayReports();
    } catch (error) {
      alert('Lỗi khi gửi báo cáo hoặc kết nối.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (report: any) => {
    setEditingReport(report);
    setFormData({
      vehicle_id: report.vehicle_id.toString(),
      agency_name: report.agency_name,
      money_amount: report.money_amount === 'Chuyển Khoản Ngân Hàng' ? '' : 
                    report.money_amount === 'Không Trả Tiền' ? '' : 
                    parseInt(report.money_amount.replace(/\D/g, '')).toLocaleString('en-US')
    });
    
    if (report.money_amount === 'Chuyển Khoản Ngân Hàng') setPaymentMethod('transfer');
    else if (report.money_amount === 'Không Trả Tiền') setPaymentMethod('none');
    else setPaymentMethod('cash');
    
    setPhoto(report.photo_url);
    setActiveTab('report');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingReport(null);
    setFormData({ vehicle_id: formData.vehicle_id, agency_name: '', money_amount: '' });
    setPaymentMethod('cash');
    setPhoto(null);
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseFormData.vehicle_id) {
      alert('Vui lòng chọn xe.');
      return;
    }
    if (!expensePhoto) {
      alert('Vui lòng chụp ảnh hóa đơn/chứng từ.');
      return;
    }

    setLoading(true);
    const expenseData = {
      driver_id: user.id,
      vehicle_id: expenseFormData.vehicle_id,
      amount: expenseFormData.amount.replace(/,/g, ''),
      description: expenseFormData.description,
      photo_url: expensePhoto,
      timestamp: new Date().toISOString(),
    };

    try {
      if (!isOnline) {
        await saveOfflineReport({
          type: 'expense',
          data: expenseData,
          timestamp: expenseData.timestamp,
        });
        await updatePendingCount();
        alert('Đã lưu báo cáo chi phí ngoại tuyến. Dữ liệu sẽ được đồng bộ khi có mạng.');
      } else {
        await apiFetch('/api/driver-expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(expenseData),
        });
        setShowSuccess(true);
      }

      setExpenseFormData({ vehicle_id: '', amount: '', description: '' });
      setExpensePhoto(null);
    } catch (error) {
      alert('Lỗi khi gửi báo cáo chi phí hoặc kết nối.');
    } finally {
      setLoading(false);
    }
  };

  const handleExpensePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLoading(true);
      try {
        const compressed = await compressImage(file, 1280, 1280, 0.7);
        setExpensePhoto(compressed);
      } catch (error) {
        console.error("Error compressing expense image", error);
        const reader = new FileReader();
        reader.onloadend = () => {
          setExpensePhoto(reader.result as string);
        };
        reader.readAsDataURL(file);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleExpenseMoneyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value === '') {
      setExpenseFormData({ ...expenseFormData, amount: '' });
      return;
    }
    const formattedValue = parseInt(value, 10).toLocaleString('en-US');
    setExpenseFormData({ ...expenseFormData, amount: formattedValue });
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);
    const returnData = {
      driver_id: user.id,
      agency_name: returnFormData.agency_name,
      product_name: returnFormData.product_name,
      quantity: parseInt(returnFormData.quantity),
      reason: returnFormData.reason,
      photo_url: returnPhoto,
      timestamp: new Date().toISOString(),
    };

    try {
      if (!isOnline) {
        await saveOfflineReport({
          type: 'return',
          data: returnData,
          timestamp: returnData.timestamp,
        });
        await updatePendingCount();
        alert('Đã lưu báo cáo hàng trả về ngoại tuyến. Dữ liệu sẽ được đồng bộ khi có mạng.');
      } else {
        await apiFetch('/api/return-goods-reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(returnData),
        });
        setShowSuccess(true);
      }

      setReturnFormData({ agency_name: '', product_name: '', quantity: '', reason: '' });
      setReturnPhoto(null);
    } catch (error) {
      alert('Lỗi khi gửi báo cáo hàng trả về hoặc kết nối.');
    } finally {
      setLoading(false);
    }
  };

  const handleReturnPhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLoading(true);
      try {
        const compressed = await compressImage(file, 1280, 1280, 0.7);
        setReturnPhoto(compressed);
      } catch (error) {
        console.error("Error compressing return image", error);
        const reader = new FileReader();
        reader.onloadend = () => {
          setReturnPhoto(reader.result as string);
        };
        reader.readAsDataURL(file);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 relative z-10">
      <LoadingOverlay isLoading={loading || expiryLoading} message="Đang tải dữ liệu lên hệ thống..." />
      <SuccessModal 
        isOpen={showSuccess} 
        onClose={() => setShowSuccess(false)} 
        message="Báo cáo giao hàng đã được ghi nhận thành công."
      />
      
      <h1 className="text-3xl font-extrabold text-gradient">Báo cáo Giao hàng</h1>
      
      {/* Offline Status Indicator */}
      <div className="flex items-center justify-between p-4 glass-panel rounded-2xl border-2 border-white/50">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="font-bold text-sm">
            {isOnline ? 'Đang trực tuyến' : 'Đang ngoại tuyến'}
          </span>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-moss-dark bg-sand/50 px-3 py-1 rounded-full">
              {pendingCount} báo cáo chờ đồng bộ
            </span>
            {isOnline && (
              <button
                onClick={() => syncReports()}
                disabled={isSyncing}
                className="p-2 bg-moss text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-moss-dark transition-all disabled:opacity-50"
              >
                {isSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                Đồng bộ ngay
              </button>
            )}
          </div>
        )}
      </div>
      
      <div className="flex p-1 space-x-1 bg-white/40 rounded-2xl backdrop-blur-sm border border-white/50 mb-6 flex-wrap sm:flex-nowrap">
        <button
          onClick={() => setActiveTab('report')}
          className={`flex-1 py-3 px-2 text-sm font-bold rounded-xl transition-all duration-300 ${
            activeTab === 'report'
              ? 'bg-moss text-white shadow-lg'
              : 'text-moss-dark/70 hover:bg-white/50 hover:text-moss-dark'
          }`}
        >
          Báo cáo Giao hàng
        </button>
        <button
          onClick={() => setActiveTab('expense')}
          className={`flex-1 py-3 px-2 text-sm font-bold rounded-xl transition-all duration-300 ${
            activeTab === 'expense'
              ? 'bg-amber-500 text-white shadow-lg'
              : 'text-moss-dark/70 hover:bg-white/50 hover:text-moss-dark'
          }`}
        >
          Báo cáo Chi phí
        </button>
        <button
          onClick={() => setActiveTab('return')}
          className={`flex-1 py-3 px-2 text-sm font-bold rounded-xl transition-all duration-300 ${
            activeTab === 'return'
              ? 'bg-red-500 text-white shadow-lg'
              : 'text-moss-dark/70 hover:bg-white/50 hover:text-moss-dark'
          }`}
        >
          Hàng trả về
        </button>
        <button
          onClick={() => setActiveTab('expiry')}
          className={`flex-1 py-3 px-2 text-sm font-bold rounded-xl transition-all duration-300 ${
            activeTab === 'expiry'
              ? 'bg-moss text-white shadow-lg'
              : 'text-moss-dark/70 hover:bg-white/50 hover:text-moss-dark'
          }`}
        >
          Cập nhật Hạn xe
        </button>
      </div>

      {activeTab === 'report' ? (
        <>
          <div className="glass-panel rounded-3xl p-6 sm:p-8 mb-8">
            {editingReport && (
              <div className="mb-4 p-3 bg-amber-100 text-amber-800 rounded-xl flex items-center justify-between">
                <span className="font-bold flex items-center">
                  <Pencil className="w-4 h-4 mr-2" />
                  Đang chỉnh sửa báo cáo
                </span>
                <button onClick={cancelEdit} className="p-1 hover:bg-amber-200 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-moss-dark mb-1">Chọn xe</label>
              <select
                required
                className="glass-input block w-full rounded-xl sm:text-sm p-3"
                value={formData.vehicle_id}
                onChange={handleVehicleChange}
              >
                <option value="">-- Chọn biển số xe --</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.license_plate}</option>
                ))}
              </select>
              
              {selectedVehicle && (
                <div className="mt-3 p-3 bg-white/30 rounded-xl border border-white/40 backdrop-blur-sm space-y-1">
                  <div className="flex items-center gap-2 text-sm font-bold text-moss-dark">
                    <Info className="w-4 h-4 text-moss" />
                    Thông tin xe: {selectedVehicle.license_plate}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-medium text-moss-dark/80">
                    <div>
                      <span className="opacity-60">Bảo hiểm:</span> {getExpiryInfo(selectedVehicle.insurance_expiry)}
                    </div>
                    <div>
                      <span className="opacity-60">Đăng kiểm:</span> {getExpiryInfo(selectedVehicle.registration_expiry)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <label className="block text-sm font-bold text-moss-dark mb-1">Tên Đại lý</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  className="glass-input block w-full rounded-xl sm:text-sm p-3 placeholder-moss-dark/40"
                  placeholder="Nhập hoặc chọn tên đại lý giao hàng"
                  value={formData.agency_name}
                  onChange={(e) => {
                    setFormData({ ...formData, agency_name: e.target.value });
                    setShowAgencyDropdown(true);
                  }}
                  onFocus={() => setShowAgencyDropdown(true)}
                />
                {showAgencyDropdown && agencies.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-2 max-h-60 overflow-y-auto glass-panel rounded-2xl shadow-2xl border border-white/40 py-2">
                    {agencies
                      .filter(a => a.name.toLowerCase().includes(formData.agency_name.toLowerCase()))
                      .map((agency) => (
                        <button
                          key={agency.id}
                          type="button"
                          className="w-full text-left px-5 py-3 hover:bg-moss/10 transition-colors font-bold text-moss-dark border-b border-white/10 last:border-0"
                          onClick={() => {
                            setFormData({ ...formData, agency_name: agency.name });
                            setShowAgencyDropdown(false);
                          }}
                        >
                          <div className="flex flex-col">
                            <span>{agency.name}</span>
                            {agency.address && <span className="text-xs font-medium text-moss-dark/50 truncate">{agency.address}</span>}
                          </div>
                        </button>
                      ))}
                    {agencies.filter(a => a.name.toLowerCase().includes(formData.agency_name.toLowerCase())).length === 0 && (
                      <div className="px-5 py-3 text-sm font-medium text-moss-dark/50 italic">
                        Không tìm thấy đại lý trong danh sách. Bạn có thể nhập tên mới.
                      </div>
                    )}
                  </div>
                )}
              </div>
              {showAgencyDropdown && (
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowAgencyDropdown(false)}
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-moss-dark mb-2">Phương thức thanh toán</label>
              <div className="flex p-1 space-x-1 bg-white/40 rounded-xl backdrop-blur-sm border border-white/50">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 ${
                    paymentMethod === 'cash'
                      ? 'bg-moss text-white shadow-md'
                      : 'text-moss-dark/70 hover:bg-white/50 hover:text-moss-dark'
                  }`}
                >
                  Tiền mặt
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('transfer')}
                  className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 ${
                    paymentMethod === 'transfer'
                      ? 'bg-amber-500 text-white shadow-md'
                      : 'text-moss-dark/70 hover:bg-white/50 hover:text-moss-dark'
                  }`}
                >
                  Chuyển khoản
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('none')}
                  className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 ${
                    paymentMethod === 'none'
                      ? 'bg-red-500 text-white shadow-md'
                      : 'text-moss-dark/70 hover:bg-white/50 hover:text-moss-dark'
                  }`}
                >
                  Không trả tiền
                </button>
              </div>
            </div>

            {paymentMethod === 'cash' && (
              <div>
                <label className="block text-sm font-bold text-moss-dark mb-1">Số tiền thu (VNĐ)</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    className="glass-input block w-full rounded-xl sm:text-sm p-3 pr-24 placeholder-moss-dark/40"
                    placeholder="VD: 5,000,000"
                    value={formData.money_amount}
                    onChange={handleMoneyChange}
                  />
                  <button
                    type="button"
                    onClick={scanReceipt}
                    disabled={isScanning || !photo}
                    className="absolute right-2 top-1.5 px-3 py-1.5 bg-moss/10 text-moss rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-moss/20 transition-all disabled:opacity-50"
                  >
                    {isScanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <ScanLine className="w-3 h-3" />}
                    Quét ảnh
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-moss-dark mb-2">
                {paymentMethod === 'cash' ? 'Chụp ảnh tiền thu (Bắt buộc)' : 
                 paymentMethod === 'transfer' ? 'Chụp ảnh biên lai chuyển khoản (Không bắt buộc)' : 
                 'Chụp ảnh xác nhận (Không bắt buộc)'}
              </label>
              
              {photo ? (
                <div className="relative rounded-2xl overflow-hidden bg-white/30 h-64 border-2 border-dashed border-white/50 backdrop-blur-sm shadow-inner">
                  <img src={photo} alt="Preview" className="w-full h-full object-contain" />
                  <button
                    type="button"
                    onClick={() => setPhoto(null)}
                    className="absolute top-3 right-3 bg-red-500/80 backdrop-blur-md text-white px-4 py-2 rounded-xl shadow-md hover:bg-red-600 transition-all duration-300 active:scale-95 font-bold text-sm"
                  >
                    Xóa ảnh
                  </button>
                </div>
              ) : (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-white/50 border-dashed rounded-2xl cursor-pointer hover:bg-white/40 transition-all duration-300 active:scale-95 bg-white/20 backdrop-blur-sm"
                >
                  <div className="space-y-2 text-center">
                    <Camera className="mx-auto h-12 w-12 text-moss-dark/60" />
                    <div className="flex text-sm text-moss-dark justify-center">
                      <span className="relative rounded-md font-bold text-moss hover:text-moss-dark focus-within:outline-none">
                        Chụp ảnh hoặc tải lên
                      </span>
                    </div>
                    <p className="text-xs text-moss-dark/60 font-medium">PNG, JPG, GIF up to 10MB</p>
                  </div>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                ref={fileInputRef}
                onChange={handlePhotoCapture}
              />
            </div>

            <div className="flex items-center text-sm font-medium text-moss-dark/80 bg-white/30 p-4 rounded-xl backdrop-blur-sm border border-white/40">
              <MapPin className="mr-3 h-5 w-5 text-moss" />
              {location ? `Đã lấy vị trí (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})` : 'Đang lấy vị trí...'}
            </div>

            <button
              type="submit"
              disabled={loading || (!location && !editingReport)}
              className="w-full flex justify-center py-4 px-4 rounded-xl text-sm font-bold glass-button mt-4"
            >
              {loading ? 'Đang xử lý...' : editingReport ? 'Cập Nhật Báo Cáo' : 'Gửi Báo Cáo'}
            </button>

            <button
              type="button"
              onClick={requestHelp}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-bold bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-all mt-2"
            >
              <AlertCircle className="w-4 h-4" />
              Cần giúp đỡ khẩn cấp!
            </button>
          </form>
        </div>

        {/* List of Today's Reports */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-moss-dark flex items-center">
            <History className="w-5 h-5 mr-2" />
            Lịch sử hôm nay ({todayReports.length})
          </h2>
          
          {todayReports.length === 0 ? (
            <div className="glass-panel p-6 rounded-2xl text-center text-moss-dark/60 italic">
              Chưa có báo cáo nào trong hôm nay
            </div>
          ) : (
            <div className="space-y-3">
              {todayReports.map((report) => {
                const isEditable = differenceInHours(new Date(), parseISO(report.timestamp)) < 24;
                return (
                  <div key={report.id} className="glass-panel p-4 rounded-2xl flex justify-between items-center">
                    <div>
                      <div className="font-bold text-moss-dark">{report.agency_name}</div>
                      <div className="text-sm text-moss-dark/70 flex items-center gap-2">
                        <span className="bg-white/40 px-2 py-0.5 rounded text-xs font-mono">
                          {report.license_plate}
                        </span>
                        <span>•</span>
                        <span className="font-medium text-moss">
                          {report.money_amount}
                        </span>
                      </div>
                      <div className="text-xs text-moss-dark/50 mt-1 flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {format(parseISO(report.timestamp), 'HH:mm')}
                      </div>
                    </div>
                    
                    {isEditable && (
                      <button
                        onClick={() => handleEditClick(report)}
                        className="p-2 bg-white/40 hover:bg-white/60 text-moss-dark rounded-xl transition-colors"
                        title="Chỉnh sửa"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </>
      ) : activeTab === 'expense' ? (
        <div className="glass-panel rounded-3xl p-6 sm:p-8">
          <form onSubmit={handleExpenseSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-moss-dark mb-1">Chọn xe</label>
              <select
                required
                className="glass-input block w-full rounded-xl sm:text-sm p-3"
                value={expenseFormData.vehicle_id}
                onChange={(e) => {
                  const vehicleId = e.target.value;
                  setExpenseFormData({ ...expenseFormData, vehicle_id: vehicleId });
                  if (vehicleId) {
                    localStorage.setItem('defaultVehicle', JSON.stringify({
                      id: vehicleId,
                      timestamp: new Date().getTime()
                    }));
                    setFormData(prev => ({ ...prev, vehicle_id: vehicleId }));
                    setExpiryFormData(prev => ({ ...prev, vehicle_id: vehicleId }));
                  }
                }}
              >
                <option value="">-- Chọn biển số xe --</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.license_plate}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-moss-dark mb-1">Mô tả chi phí</label>
              <input
                type="text"
                required
                className="glass-input block w-full rounded-xl sm:text-sm p-3 placeholder-moss-dark/40"
                placeholder="VD: Đổ xăng, phí cầu đường, sửa lốp..."
                value={expenseFormData.description}
                onChange={(e) => setExpenseFormData({ ...expenseFormData, description: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-moss-dark mb-1">Số tiền (VNĐ)</label>
              <input
                type="text"
                required
                className="glass-input block w-full rounded-xl sm:text-sm p-3 placeholder-moss-dark/40"
                placeholder="VD: 500,000"
                value={expenseFormData.amount}
                onChange={handleExpenseMoneyChange}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-moss-dark mb-2">Chụp ảnh hóa đơn/chứng từ (Bắt buộc)</label>
              {expensePhoto ? (
                <div className="relative rounded-2xl overflow-hidden bg-white/30 h-64 border-2 border-dashed border-white/50 backdrop-blur-sm shadow-inner">
                  <img src={expensePhoto} alt="Preview" className="w-full h-full object-contain" />
                  <button
                    type="button"
                    onClick={() => setExpensePhoto(null)}
                    className="absolute top-3 right-3 bg-red-500/80 backdrop-blur-md text-white px-4 py-2 rounded-xl shadow-md hover:bg-red-600 transition-all duration-300 active:scale-95 font-bold text-sm"
                  >
                    Xóa ảnh
                  </button>
                </div>
              ) : (
                <div 
                  onClick={() => expenseFileInputRef.current?.click()}
                  className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-white/50 border-dashed rounded-2xl cursor-pointer hover:bg-white/40 transition-all duration-300 active:scale-95 bg-white/20 backdrop-blur-sm"
                >
                  <div className="space-y-2 text-center">
                    <Receipt className="mx-auto h-12 w-12 text-amber-500/60" />
                    <div className="flex text-sm text-moss-dark justify-center">
                      <span className="relative rounded-md font-bold text-amber-600 hover:text-amber-700 focus-within:outline-none">
                        Chụp ảnh hóa đơn
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                ref={expenseFileInputRef}
                onChange={handleExpensePhotoCapture}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-4 px-4 rounded-xl text-sm font-bold bg-amber-500 text-white hover:bg-amber-600 transition-all shadow-md active:scale-95 mt-4"
            >
              {loading ? 'Đang gửi...' : 'Gửi Báo Cáo Chi Phí'}
            </button>
          </form>
        </div>
      ) : activeTab === 'return' ? (
        <div className="glass-panel rounded-3xl p-6 sm:p-8">
          <form onSubmit={handleReturnSubmit} className="space-y-6">
            <div className="relative">
              <label className="block text-sm font-bold text-moss-dark mb-1">Tên Đại lý</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  className="glass-input block w-full rounded-xl sm:text-sm p-3 placeholder-moss-dark/40"
                  placeholder="Nhập hoặc chọn tên đại lý trả hàng"
                  value={returnFormData.agency_name}
                  onChange={(e) => {
                    setReturnFormData({ ...returnFormData, agency_name: e.target.value });
                    setShowReturnAgencyDropdown(true);
                  }}
                  onFocus={() => setShowReturnAgencyDropdown(true)}
                />
                {showReturnAgencyDropdown && agencies.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-2 max-h-60 overflow-y-auto glass-panel rounded-2xl shadow-2xl border border-white/40 py-2">
                    {agencies
                      .filter(a => a.name.toLowerCase().includes(returnFormData.agency_name.toLowerCase()))
                      .map((agency) => (
                        <button
                          key={agency.id}
                          type="button"
                          className="w-full text-left px-5 py-3 hover:bg-moss/10 transition-colors font-bold text-moss-dark border-b border-white/10 last:border-0"
                          onClick={() => {
                            setReturnFormData({ ...returnFormData, agency_name: agency.name });
                            setShowReturnAgencyDropdown(false);
                          }}
                        >
                          <div className="flex flex-col">
                            <span>{agency.name}</span>
                            {agency.address && <span className="text-xs font-medium text-moss-dark/50 truncate">{agency.address}</span>}
                          </div>
                        </button>
                      ))}
                    {agencies.filter(a => a.name.toLowerCase().includes(returnFormData.agency_name.toLowerCase())).length === 0 && (
                      <div className="px-5 py-3 text-sm font-medium text-moss-dark/50 italic">
                        Không tìm thấy đại lý trong danh sách. Bạn có thể nhập tên mới.
                      </div>
                    )}
                  </div>
                )}
              </div>
              {showReturnAgencyDropdown && (
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowReturnAgencyDropdown(false)}
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-moss-dark mb-1">Tên hàng hóa</label>
              <input
                type="text"
                required
                className="glass-input block w-full rounded-xl sm:text-sm p-3 placeholder-moss-dark/40"
                placeholder="VD: Nước yến, Sữa..."
                value={returnFormData.product_name}
                onChange={(e) => setReturnFormData({ ...returnFormData, product_name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-moss-dark mb-1">Số lượng</label>
              <input
                type="number"
                required
                className="glass-input block w-full rounded-xl sm:text-sm p-3 placeholder-moss-dark/40"
                placeholder="VD: 10"
                value={returnFormData.quantity}
                onChange={(e) => setReturnFormData({ ...returnFormData, quantity: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-moss-dark mb-1">Lý do trả về</label>
              <textarea
                required
                className="glass-input block w-full rounded-xl sm:text-sm p-3 placeholder-moss-dark/40"
                placeholder="VD: Hàng hỏng, Hết hạn, Đặt nhầm..."
                rows={3}
                value={returnFormData.reason}
                onChange={(e) => setReturnFormData({ ...returnFormData, reason: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-moss-dark mb-2">Chụp ảnh hàng trả về (Không bắt buộc)</label>
              {returnPhoto ? (
                <div className="relative rounded-2xl overflow-hidden bg-white/30 h-64 border-2 border-dashed border-white/50 backdrop-blur-sm shadow-inner">
                  <img src={returnPhoto} alt="Preview" className="w-full h-full object-contain" />
                  <button
                    type="button"
                    onClick={() => setReturnPhoto(null)}
                    className="absolute top-3 right-3 bg-red-500/80 backdrop-blur-md text-white px-4 py-2 rounded-xl shadow-md hover:bg-red-600 transition-all duration-300 active:scale-95 font-bold text-sm"
                  >
                    Xóa ảnh
                  </button>
                </div>
              ) : (
                <div 
                  onClick={() => returnFileInputRef.current?.click()}
                  className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-white/50 border-dashed rounded-2xl cursor-pointer hover:bg-white/40 transition-all duration-300 active:scale-95 bg-white/20 backdrop-blur-sm"
                >
                  <div className="space-y-2 text-center">
                    <PackageMinus className="mx-auto h-12 w-12 text-red-500/60" />
                    <div className="flex text-sm text-moss-dark justify-center">
                      <span className="relative rounded-md font-bold text-red-600 hover:text-red-700 focus-within:outline-none">
                        Chụp ảnh hàng hóa
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                ref={returnFileInputRef}
                onChange={handleReturnPhotoCapture}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-4 px-4 rounded-xl text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition-all shadow-md active:scale-95 mt-4"
            >
              {loading ? 'Đang gửi...' : 'Gửi Báo Cáo Hàng Trả Về'}
            </button>
          </form>
        </div>
      ) : (
        <div className="glass-panel rounded-3xl p-6 sm:p-8">
          <form onSubmit={handleExpirySubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-moss-dark mb-1">Chọn xe</label>
              <select
                required
                className="glass-input block w-full rounded-xl sm:text-sm p-3"
                value={expiryFormData.vehicle_id}
                onChange={(e) => {
                  const vehicleId = e.target.value;
                  const v = vehicles.find(v => v.id.toString() === vehicleId);
                  setExpiryFormData({ 
                    ...expiryFormData, 
                    vehicle_id: vehicleId,
                    insurance_expiry: v?.insurance_expiry || '',
                    registration_expiry: v?.registration_expiry || ''
                  });
                  
                  if (vehicleId) {
                    localStorage.setItem('defaultVehicle', JSON.stringify({
                      id: vehicleId,
                      timestamp: new Date().getTime()
                    }));
                    setFormData(prev => ({ ...prev, vehicle_id: vehicleId }));
                    setExpenseFormData(prev => ({ ...prev, vehicle_id: vehicleId }));
                  }
                }}
              >
                <option value="">-- Chọn biển số xe --</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.license_plate}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-moss-dark mb-1">Hạn Bảo hiểm mới</label>
                <input
                  type="date"
                  required
                  className="glass-input block w-full rounded-xl sm:text-sm p-3"
                  value={expiryFormData.insurance_expiry}
                  onChange={(e) => setExpiryFormData({ ...expiryFormData, insurance_expiry: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-moss-dark mb-1">Hạn Đăng kiểm mới</label>
                <input
                  type="date"
                  required
                  className="glass-input block w-full rounded-xl sm:text-sm p-3"
                  value={expiryFormData.registration_expiry}
                  onChange={(e) => setExpiryFormData({ ...expiryFormData, registration_expiry: e.target.value })}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={expiryLoading}
              className="w-full flex justify-center py-4 px-4 rounded-xl text-sm font-bold glass-button mt-4"
            >
              {expiryLoading ? 'Đang cập nhật...' : 'Cập nhật Hạn xe'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
