import React, { useState, useEffect, useRef } from 'react';
import { Camera, MapPin, Clock, CheckCircle, Flame, Trophy, FileText, ShoppingCart, History, Pencil, X, Loader2, Upload } from 'lucide-react';
import { differenceInMinutes, isSameDay, parseISO, differenceInHours, format } from 'date-fns';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';
import SuccessModal from '../../components/SuccessModal';
import LoadingOverlay from '../../components/LoadingOverlay';
import { apiFetch } from '../../utils/api';
import { compressImage } from '../../utils/imageCompression';
import { saveOfflineReport, setCache, getCache } from '../../utils/db';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { findNearestAgency } from '../../utils/location';

export default function SaleDashboard({ user }: { user: any }) {
  const { isOnline, pendingCount, isSyncing, syncReports, updatePendingCount } = useOfflineSync();
  const [activeSession, setActiveSession] = useState<any>(null);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [agencyName, setAgencyName] = useState('');
  const [showAgencyDropdown, setShowAgencyDropdown] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [todayReports, setTodayReports] = useState<any[]>([]);
  const [surplus, setSurplus] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [notes, setNotes] = useState('');
  const [hasOrder, setHasOrder] = useState(false);
  const [orderDetails, setOrderDetails] = useState('');
  const [isSendingOrder, setIsSendingOrder] = useState(false);
  const [editingReport, setEditingReport] = useState<any>(null);
  const [showNewAgencyModal, setShowNewAgencyModal] = useState(false);
  const [newAgencyForm, setNewAgencyForm] = useState({
    name: '',
    address: '',
    phone: '',
    notes: '',
    photo: null as string | null
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const newAgencyPhotoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check if there's an active session in local storage
    const storedSession = localStorage.getItem('activeSaleSession');
    if (storedSession) {
      const session = JSON.parse(storedSession);
      setActiveSession(session);
      // Restore state from session if available
      if (session.has_order) setHasOrder(true);
      if (session.order_details) setOrderDetails(session.order_details);
      if (session.notes) setNotes(session.notes);
    }
    getLocation();
    fetchTodayReports();
    fetchAgencies();

    const handleVoiceReport = () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('voice_report_delivered', handleVoiceReport);
    return () => window.removeEventListener('voice_report_delivered', handleVoiceReport);
  }, []);

  // Suggest nearest agency based on location
  useEffect(() => {
    if (location && agencies.length > 0 && !activeSession && !agencyName) {
      const nearest = findNearestAgency(location, agencies, 500); // 500m threshold
      if (nearest) {
        setAgencyName(nearest.name);
      }
    }
  }, [location, agencies, activeSession]);

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

  // Sync session state to localStorage for persistence
  useEffect(() => {
    if (activeSession) {
      const updatedSession = {
        ...activeSession,
        notes,
        has_order: hasOrder,
        order_details: orderDetails
      };
      localStorage.setItem('activeSaleSession', JSON.stringify(updatedSession));
    }
  }, [notes, hasOrder, orderDetails, activeSession]);

  const fetchTodayReports = async () => {
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      if (!isOnline) {
        const cached = await getCache('saleTodayReports');
        if (cached) setTodayReports(cached);
        const cachedSurplus = await getCache('saleSurplus');
        if (cachedSurplus !== undefined) setSurplus(cachedSurplus);
        return;
      }
      const [data, stats] = await Promise.all([
        apiFetch(`/api/sale-reports?startDate=${todayStr}&endDate=${todayStr}`),
        apiFetch(`/api/dashboard-stats?userId=${user.id}`)
      ]);
      
      const today = new Date();
      const userTodayReports = (data && data.data ? data.data : []).filter((r: any) => 
        r.sale_id === user.id && 
        isSameDay(parseISO(r.check_in_time), today) &&
        r.duration_minutes !== null
      );
      setTodayReports(userTodayReports);
      setSurplus(stats?.saleSurplus || 0);
      
      await setCache('saleTodayReports', userTodayReports);
      await setCache('saleSurplus', stats?.saleSurplus || 0);
    } catch (error) {
      console.error(error);
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
        // Fallback to original if compression fails
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

  const handleCheckIn = async () => {
    if (!agencyName) {
      alert('Vui lòng nhập tên đại lý.');
      return;
    }
    if (!photo) {
      alert('Vui lòng chụp ảnh check-in.');
      return;
    }
    if (!location) {
      alert('Đang lấy vị trí, vui lòng thử lại.');
      getLocation();
      return;
    }

    setLoading(true);
    const checkInTime = new Date().toISOString();
    
    try {
      if (!isOnline) {
        // For check-in, we need an ID. In offline mode, we'll generate a temporary one.
        const tempId = Date.now();
        const sessionData = {
          id: tempId,
          agency_name: agencyName,
          check_in_time: checkInTime,
          isOffline: true,
          check_in_photo_url: photo,
          check_in_lat: location.lat,
          check_in_lng: location.lng,
        };
        setActiveSession(sessionData);
        localStorage.setItem('activeSaleSession', JSON.stringify(sessionData));
        setPhoto(null);
        setSuccessMessage('Check-in ngoại tuyến thành công. Dữ liệu sẽ đồng bộ khi hoàn tất check-out và có mạng.');
        setShowSuccess(true);
      } else {
        const data = await apiFetch('/api/sale-reports/check-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sale_id: user.id,
            agency_name: agencyName,
            check_in_photo_url: photo,
            check_in_lat: location.lat,
            check_in_lng: location.lng,
            check_in_time: checkInTime,
          }),
        });

        if (data && data.success) {
          const sessionData = {
            id: data.id,
            agency_name: agencyName,
            check_in_time: checkInTime,
          };
          setActiveSession(sessionData);
          localStorage.setItem('activeSaleSession', JSON.stringify(sessionData));
          setPhoto(null);
          setSuccessMessage('Check-in thành công. Dữ liệu đã được ghi vào hệ thống.');
          setShowSuccess(true);
        }
      }
    } catch (error) {
      alert('Lỗi khi check-in hoặc kết nối.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOrder = async () => {
    if (!hasOrder || !orderDetails) {
      alert('Vui lòng nhập chi tiết đơn hàng trước khi gửi.');
      return;
    }

    setIsSendingOrder(true);
    try {
      // Update local session to persist across reloads
      const updatedSession = { 
        ...activeSession, 
        has_order: true, 
        order_details: orderDetails,
        notes: notes // Also persist notes
      };
      setActiveSession(updatedSession);
      localStorage.setItem('activeSaleSession', JSON.stringify(updatedSession));

      if (isOnline && !activeSession.isOffline) {
        await apiFetch('/api/sale-reports/update-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: activeSession.id,
            has_order: true,
            order_details: orderDetails
          }),
        });
        setSuccessMessage('Đơn hàng đã được gửi thành công!');
        setShowSuccess(true);
      } else {
        setSuccessMessage('Đã ghi nhận đơn hàng (Ngoại tuyến). Dữ liệu sẽ đồng bộ khi check-out.');
        setShowSuccess(true);
      }
    } catch (error) {
      alert('Lỗi khi gửi đơn hàng.');
    } finally {
      setIsSendingOrder(false);
    }
  };

  const handleCheckOut = async () => {
    if (!photo) {
      alert('Vui lòng chụp ảnh check-out.');
      return;
    }

    setLoading(true);
    const checkOutTime = new Date();
    const checkInTime = new Date(activeSession.check_in_time);
    const duration = differenceInMinutes(checkOutTime, checkInTime);
    const checkOutData = {
      id: activeSession.id,
      check_out_photo_url: photo,
      check_out_time: checkOutTime.toISOString(),
      duration_minutes: duration,
      notes: notes,
      has_order: hasOrder,
      order_details: orderDetails
    };

    try {
      if (activeSession.isOffline || !isOnline) {
        // If it was an offline check-in, we save the whole thing as one report to sync later
        // We need to combine check-in and check-out data
        const fullReportData = {
          sale_id: user.id,
          agency_name: activeSession.agency_name,
          check_in_photo_url: activeSession.check_in_photo_url,
          check_in_lat: activeSession.check_in_lat,
          check_in_lng: activeSession.check_in_lng,
          check_in_time: activeSession.check_in_time,
          ...checkOutData
        };
        
        await saveOfflineReport({
          type: 'sale',
          data: fullReportData,
          timestamp: checkOutData.check_out_time,
        });
        await updatePendingCount();
        setSuccessMessage(`Check-out ngoại tuyến thành công! Dữ liệu sẽ được đồng bộ khi có mạng.`);
      } else {
        await apiFetch('/api/sale-reports/check-out', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(checkOutData),
        });
        setSuccessMessage(`Check-out thành công! Thời gian làm việc: ${duration} phút.`);
      }

      setActiveSession(null);
      localStorage.removeItem('activeSaleSession');
      setAgencyName('');
      setPhoto(null);
      setNotes('');
      setHasOrder(false);
      setOrderDetails('');
      setShowSuccess(true);
      
      // Refresh reports to update progress bar
      await fetchTodayReports();
      
      // Trigger confetti if they just hit the target
      const currentPoints = todayReports.reduce((acc, r) => acc + (r.has_order ? 1 : 0) + (r.duration_minutes >= 30 ? 1 : 0), 0) + surplus;
      const newPoints = currentPoints + (hasOrder ? 1 : 0) + (duration >= 30 ? 1 : 0);
      
      if (newPoints >= 5 && currentPoints < 5) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 }
        });
      } else if (newPoints > 5) {
        confetti({
          particleCount: 50,
          spread: 40,
          origin: { y: 0.6 },
          colors: ['#ff4500', '#ffa500', '#ffd700']
        });
      }
    } catch (error) {
      alert('Lỗi khi check-out hoặc kết nối.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateReport = async () => {
    if (!editingReport) return;

    setLoading(true);
    try {
      await apiFetch(`/api/sale-reports/${editingReport.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agency_name: agencyName,
          notes: notes,
          has_order: hasOrder,
          order_details: orderDetails,
          check_in_photo_url: editingReport.check_in_photo_url, // Keep original or allow edit? Assuming keep for now unless we add photo edit
          check_out_photo_url: photo || editingReport.check_out_photo_url // Allow updating checkout photo
        }),
      });

      alert('Cập nhật báo cáo thành công!');
      setEditingReport(null);
      setAgencyName('');
      setNotes('');
      setHasOrder(false);
      setOrderDetails('');
      setPhoto(null);
      fetchTodayReports();
    } catch (error) {
      alert('Lỗi khi cập nhật báo cáo.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (report: any) => {
    setEditingReport(report);
    setAgencyName(report.agency_name);
    setNotes(report.notes || '');
    setHasOrder(!!report.has_order);
    setOrderDetails(report.order_details || '');
    setPhoto(report.check_out_photo_url);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingReport(null);
    setAgencyName('');
    setNotes('');
    setHasOrder(false);
    setOrderDetails('');
    setPhoto(null);
  };

  const handleNewAgencyPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLoading(true);
      try {
        const compressed = await compressImage(file, 1280, 1280, 0.7);
        setNewAgencyForm(prev => ({ ...prev, photo: compressed }));
      } catch (error) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setNewAgencyForm(prev => ({ ...prev, photo: reader.result as string }));
        };
        reader.readAsDataURL(file);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleNewAgencySubmit = async () => {
    if (!newAgencyForm.name || !newAgencyForm.address || !newAgencyForm.photo) {
      alert('Vui lòng điền đầy đủ tên, địa chỉ và chụp ảnh đại lý mới.');
      return;
    }

    setLoading(true);
    try {
      await apiFetch('/api/new-agency-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sale_id: user.id,
          agency_name: newAgencyForm.name,
          address: newAgencyForm.address,
          phone: newAgencyForm.phone,
          lat: location?.lat,
          lng: location?.lng,
          photo_url: newAgencyForm.photo,
          notes: newAgencyForm.notes
        })
      });

      setSuccessMessage('Báo cáo mở đại lý mới thành công! Quản lý sẽ sớm nhận được thông tin.');
      setShowSuccess(true);
      setShowNewAgencyModal(false);
      setNewAgencyForm({ name: '', address: '', phone: '', notes: '', photo: null });
    } catch (error) {
      alert('Lỗi khi gửi báo cáo đại lý mới.');
    } finally {
      setLoading(false);
    }
  };

  const todayPoints = todayReports.reduce((acc, r) => acc + (r.has_order ? 1 : 0) + (r.duration_minutes >= 30 ? 1 : 0), 0);
  const totalPoints = todayPoints + surplus;
  const progress = Math.min((totalPoints / 5) * 100, 100);
  const isStreak = totalPoints > 5;

  return (
    <div className="max-w-2xl mx-auto space-y-6 relative z-10">
      {/* New Agency Modal */}
      <AnimatePresence>
        {showNewAgencyModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-amber-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500 text-white rounded-xl">
                    <ShoppingCart className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Mở Đại lý mới</h3>
                    <p className="text-xs text-amber-700 font-medium">Báo cáo chỉ tiêu KPI mở mới</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowNewAgencyModal(false)}
                  className="p-2 hover:bg-white/50 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1">Tên Đại lý *</label>
                  <input
                    type="text"
                    value={newAgencyForm.name}
                    onChange={(e) => setNewAgencyForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nhập tên đại lý mới..."
                    className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-amber-500 focus:bg-white rounded-2xl outline-none transition-all font-medium"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1">Địa chỉ *</label>
                  <textarea
                    value={newAgencyForm.address}
                    onChange={(e) => setNewAgencyForm(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Địa chỉ chi tiết..."
                    rows={2}
                    className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-amber-500 focus:bg-white rounded-2xl outline-none transition-all font-medium resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1">Số điện thoại</label>
                    <input
                      type="tel"
                      value={newAgencyForm.phone}
                      onChange={(e) => setNewAgencyForm(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="09xxx..."
                      className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-amber-500 focus:bg-white rounded-2xl outline-none transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1">Ảnh đại lý *</label>
                    <button
                      onClick={() => newAgencyPhotoRef.current?.click()}
                      className={`w-full p-4 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-1 ${
                        newAgencyForm.photo 
                          ? 'border-green-500 bg-green-50 text-green-600' 
                          : 'border-gray-300 bg-gray-50 text-gray-500 hover:border-amber-500 hover:text-amber-500'
                      }`}
                    >
                      {newAgencyForm.photo ? (
                        <>
                          <CheckCircle className="w-6 h-6" />
                          <span className="text-xs font-bold">Đã chụp ảnh</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-6 h-6" />
                          <span className="text-xs font-bold">Chụp ảnh</span>
                        </>
                      )}
                    </button>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      ref={newAgencyPhotoRef}
                      onChange={handleNewAgencyPhoto}
                      className="hidden"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1">Ghi chú thêm</label>
                  <textarea
                    value={newAgencyForm.notes}
                    onChange={(e) => setNewAgencyForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Thông tin thêm về đại lý..."
                    rows={2}
                    className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-amber-500 focus:bg-white rounded-2xl outline-none transition-all font-medium resize-none"
                  />
                </div>

                {newAgencyForm.photo && (
                  <div className="relative rounded-2xl overflow-hidden border-2 border-gray-100">
                    <img src={newAgencyForm.photo} alt="Preview" className="w-full h-40 object-cover" />
                    <button
                      onClick={() => setNewAgencyForm(prev => ({ ...prev, photo: null }))}
                      className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="p-6 bg-gray-50 flex gap-3">
                <button
                  onClick={() => setShowNewAgencyModal(false)}
                  className="flex-1 py-4 px-6 bg-white border-2 border-gray-200 text-gray-600 rounded-2xl font-bold hover:bg-gray-100 transition-all"
                >
                  Hủy
                </button>
                <button
                  onClick={handleNewAgencySubmit}
                  disabled={loading}
                  className="flex-[2] py-4 px-6 bg-amber-500 text-white rounded-2xl font-bold shadow-lg shadow-amber-500/30 hover:bg-amber-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                  Gửi báo cáo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <LoadingOverlay isLoading={loading} message="Đang tải dữ liệu lên hệ thống..." />
      <SuccessModal 
        isOpen={showSuccess} 
        onClose={() => setShowSuccess(false)} 
        message={successMessage}
      />

      <h1 className="text-3xl font-extrabold text-gradient">Chăm sóc Khách hàng</h1>
      
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => setShowNewAgencyModal(true)}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-3 bg-amber-500 text-white rounded-2xl font-bold shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all active:scale-95"
        >
          <ShoppingCart className="w-5 h-5" />
          Mở Đại lý mới
        </button>
      </div>

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
      
      {/* Progress Bar Section */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-moss-dark flex items-center">
            <Trophy className="w-6 h-6 mr-2 text-amber-500" />
            Chỉ tiêu ngày
          </h2>
          <div className="flex items-center space-x-3">
            <div className="flex flex-col items-end">
              <span className="text-sm font-bold text-moss-dark/80 bg-white/30 px-3 py-1 rounded-lg backdrop-blur-sm">
                {totalPoints} / 5 điểm
              </span>
              {surplus > 0 && (
                <span className="text-[10px] font-black text-moss-dark/40 uppercase tracking-wider mt-1">
                  Bao gồm {surplus} điểm dư từ hôm trước
                </span>
              )}
            </div>
            <AnimatePresence>
              {isStreak && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="flex items-center bg-amber-500/20 text-amber-700 px-3 py-1 rounded-lg text-xs font-bold border border-amber-500/30 backdrop-blur-sm"
                >
                  <Flame className="w-4 h-4 mr-1" />
                  DƯ {totalPoints - 5}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        
        <div className="w-full bg-white/30 rounded-full h-4 mb-2 overflow-hidden shadow-inner backdrop-blur-sm border border-white/20">
          <motion.div 
            className={`h-4 rounded-full ${isStreak ? 'bg-gradient-to-r from-amber-400 to-amber-600' : 'bg-moss'}`}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <p className="text-[10px] font-medium text-moss-dark/60">
            *Đơn hàng: +1 điểm | Chăm sóc {'>'}30p: +1 điểm
          </p>
          <p className="text-[10px] font-medium text-moss-dark/60">
            Điểm dư được cộng dồn cho ngày mai
          </p>
        </div>
      </div>

      <div className="glass-panel rounded-3xl p-6 sm:p-8">
        {editingReport ? (
          <div className="space-y-6">
            <div className="mb-4 p-3 bg-amber-100 text-amber-800 rounded-xl flex items-center justify-between">
              <span className="font-bold flex items-center">
                <Pencil className="w-4 h-4 mr-2" />
                Đang chỉnh sửa báo cáo: {editingReport.agency_name}
              </span>
              <button onClick={cancelEdit} className="p-1 hover:bg-amber-200 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-sm font-bold text-moss-dark mb-1">Tên Đại lý</label>
              <input
                type="text"
                required
                className="glass-input block w-full rounded-xl sm:text-sm p-3 placeholder-moss-dark/40"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-moss-dark mb-1 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Ghi chú chăm sóc
              </label>
              <textarea
                className="glass-input block w-full rounded-xl sm:text-sm p-3 placeholder-moss-dark/40"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="bg-white/30 p-4 rounded-xl border border-white/40 backdrop-blur-sm">
              <label className="flex items-center cursor-pointer mb-3">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-moss text-moss focus:ring-moss"
                  checked={hasOrder}
                  onChange={(e) => setHasOrder(e.target.checked)}
                />
                <span className="ml-2 text-sm font-bold text-moss-dark flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" />
                  Có phát sinh đơn hàng
                </span>
              </label>
              
              {hasOrder && (
                <div className="mt-2">
                  <textarea
                    className="glass-input block w-full rounded-xl sm:text-sm p-3 placeholder-moss-dark/40"
                    placeholder="Nhập chi tiết đơn hàng..."
                    rows={3}
                    value={orderDetails}
                    onChange={(e) => setOrderDetails(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-moss-dark mb-2">Ảnh Check-out (Cập nhật nếu cần)</label>
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
                        Tải ảnh mới
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
                ref={fileInputRef}
                onChange={handlePhotoCapture}
              />
            </div>

            <button
              onClick={handleUpdateReport}
              disabled={loading}
              className="w-full flex justify-center py-4 px-4 rounded-xl text-sm font-bold glass-button mt-4"
            >
              {loading ? 'Đang cập nhật...' : 'Lưu Thay Đổi'}
            </button>
          </div>
        ) : activeSession ? (
          <div className="space-y-6">
            <div className="bg-moss/10 border border-moss/20 rounded-2xl p-5 flex items-start backdrop-blur-sm">
              <CheckCircle className="h-7 w-7 text-moss mt-0.5 mr-4" />
              <div>
                <h3 className="text-lg font-bold text-moss-dark">Đang chăm sóc: {activeSession.agency_name}</h3>
                <p className="mt-2 text-sm font-medium text-moss-dark/80 flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  Bắt đầu lúc: {new Date(activeSession.check_in_time).toLocaleTimeString('vi-VN')}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-moss-dark mb-1 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Ghi chú chăm sóc
              </label>
              <textarea
                className="glass-input block w-full rounded-xl sm:text-sm p-3 placeholder-moss-dark/40"
                placeholder="Nhập ghi chú về tình hình đại lý, phản hồi khách hàng..."
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="bg-white/30 p-4 rounded-xl border border-white/40 backdrop-blur-sm">
              <label className="flex items-center cursor-pointer mb-3">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-moss text-moss focus:ring-moss"
                  checked={hasOrder}
                  onChange={(e) => setHasOrder(e.target.checked)}
                />
                <span className="ml-2 text-sm font-bold text-moss-dark flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" />
                  Có phát sinh đơn hàng
                </span>
              </label>
              
              {hasOrder && (
                <div className="mt-2 space-y-3">
                  <textarea
                    className="glass-input block w-full rounded-xl sm:text-sm p-3 placeholder-moss-dark/40"
                    placeholder="Nhập chi tiết đơn hàng (Sản phẩm, số lượng, giá...)"
                    rows={3}
                    value={orderDetails}
                    onChange={(e) => setOrderDetails(e.target.value)}
                  />
                  <button
                    onClick={handleSendOrder}
                    disabled={isSendingOrder || !orderDetails}
                    className="w-full flex justify-center items-center py-2 px-4 rounded-xl text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isSendingOrder ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShoppingCart className="w-4 h-4 mr-2" />}
                    Gửi đơn hàng ngay (Không cần check-out)
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-moss-dark mb-2">Chụp ảnh Check-out</label>
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
                        Chụp ảnh Check-out
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
                ref={fileInputRef}
                onChange={handlePhotoCapture}
              />
            </div>

            <button
              onClick={handleCheckOut}
              disabled={loading || !photo}
              className="w-full flex justify-center py-4 px-4 rounded-xl text-sm font-bold bg-red-500/80 hover:bg-red-600 text-white backdrop-blur-sm border border-red-500/50 shadow-md transition-all duration-300 active:scale-95 disabled:opacity-50 mt-4"
            >
              {loading ? 'Đang xử lý...' : 'Hoàn thành (Check-out)'}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="relative">
              <label className="block text-sm font-bold text-moss-dark mb-1">Tên Đại lý</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  className="glass-input block w-full rounded-xl sm:text-sm p-3 placeholder-moss-dark/40"
                  placeholder="Nhập hoặc chọn tên đại lý đang chăm sóc"
                  value={agencyName}
                  onChange={(e) => {
                    setAgencyName(e.target.value);
                    setShowAgencyDropdown(true);
                  }}
                  onFocus={() => setShowAgencyDropdown(true)}
                />
                {showAgencyDropdown && agencies.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-2 max-h-60 overflow-y-auto glass-panel rounded-2xl shadow-2xl border border-white/40 py-2">
                    {agencies
                      .filter(a => a.name.toLowerCase().includes(agencyName.toLowerCase()))
                      .map((agency) => (
                        <button
                          key={agency.id}
                          className="w-full text-left px-5 py-3 hover:bg-moss/10 transition-colors font-bold text-moss-dark border-b border-white/10 last:border-0"
                          onClick={() => {
                            setAgencyName(agency.name);
                            setShowAgencyDropdown(false);
                          }}
                        >
                          <div className="flex flex-col">
                            <span>{agency.name}</span>
                            {agency.address && <span className="text-xs font-medium text-moss-dark/50 truncate">{agency.address}</span>}
                          </div>
                        </button>
                      ))}
                    {agencies.filter(a => a.name.toLowerCase().includes(agencyName.toLowerCase())).length === 0 && (
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
              <label className="block text-sm font-bold text-moss-dark mb-2">Chụp ảnh Check-in</label>
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
                        Chụp ảnh Check-in
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
                ref={fileInputRef}
                onChange={handlePhotoCapture}
              />
            </div>

            <div className="flex items-center text-sm font-medium text-moss-dark/80 bg-white/30 p-4 rounded-xl backdrop-blur-sm border border-white/40">
              <MapPin className="mr-3 h-5 w-5 text-moss" />
              {location ? `Đã lấy vị trí (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})` : 'Đang lấy vị trí...'}
            </div>

            <button
              onClick={handleCheckIn}
              disabled={loading || !location || !photo || !agencyName}
              className="w-full flex justify-center py-4 px-4 rounded-xl text-sm font-bold glass-button mt-4"
            >
              {loading ? 'Đang xử lý...' : 'Bắt đầu (Check-in)'}
            </button>
          </div>
        )}
      </div>

      {/* List of Today's Reports */}
      {!activeSession && !editingReport && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-moss-dark flex items-center">
            <History className="w-5 h-5 mr-2" />
            Lịch sử hôm nay ({todayReports.length})
          </h2>
          
          {todayReports.length === 0 ? (
            <div className="glass-panel p-6 rounded-2xl text-center text-moss-dark/60 italic">
              Chưa có lượt chăm sóc nào hoàn thành trong hôm nay
            </div>
          ) : (
            <div className="space-y-3">
              {todayReports.map((report) => {
                const isEditable = differenceInHours(new Date(), parseISO(report.check_in_time)) < 24;
                return (
                  <div key={report.id} className="glass-panel p-4 rounded-2xl flex justify-between items-center">
                    <div>
                      <div className="font-bold text-moss-dark">{report.agency_name}</div>
                      <div className="text-sm text-moss-dark/70 flex items-center gap-2">
                        <span className="bg-white/40 px-2 py-0.5 rounded text-xs font-mono">
                          {report.duration_minutes} phút
                        </span>
                        {report.has_order === 1 && (
                          <span className="text-amber-600 font-bold flex items-center text-xs">
                            <ShoppingCart className="w-3 h-3 mr-1" /> Có đơn
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-moss-dark/50 mt-1 flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {format(parseISO(report.check_in_time), 'HH:mm')} - {format(parseISO(report.check_out_time), 'HH:mm')}
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
      )}
    </div>
  );
}
