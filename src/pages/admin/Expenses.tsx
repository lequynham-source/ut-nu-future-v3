import { useState, useEffect } from 'react';
import { Calendar, Filter, Image as ImageIcon, Download, Search, Receipt, Truck, User } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import ImageModal from '../../components/ImageModal';
import LoadingOverlay from '../../components/LoadingOverlay';
import * as XLSX from 'xlsx';

import { apiFetch } from '../../utils/api';

export default function AdminExpenses() {
  const [searchParams] = useSearchParams();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [selectedImage, setSelectedImage] = useState<{ src: string, alt: string } | null>(null);

  const today = format(new Date(), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(searchParams.get('startDate') || today);
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || today);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDrivers();
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchDrivers = async () => {
    try {
      const data = await apiFetch('/api/users');
      if (Array.isArray(data)) {
        setDrivers(data.filter((u: any) => u.role === 'driver' || u.role === 'sale_driver'));
      } else {
        console.error('API returned non-array data for users:', data);
        setDrivers([]);
      }
    } catch (error) {
      console.error(error);
      setDrivers([]);
    }
  };

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/driver-expenses');
      setExpenses(res || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    fetchExpenses();
  };

  const filteredExpenses = expenses.filter(expense => {
    let match = true;
    
    if (startDate && endDate) {
      const expenseDate = parseISO(expense.timestamp);
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      end.setHours(23, 59, 59, 999);
      if (expenseDate < start || expenseDate > end) match = false;
    }

    if (selectedDriver && expense.driver_id !== parseInt(selectedDriver)) {
      match = false;
    }

    return match;
  });

  const exportToExcel = () => {
    try {
      const dataToExport = filteredExpenses.map((expense: any) => ({
        'Ngày': format(parseISO(expense.timestamp), 'dd/MM/yyyy HH:mm'),
        'Tài xế': expense.driver_name,
        'Biển số xe': expense.license_plate,
        'Mô tả': expense.description,
        'Số tiền (VNĐ)': expense.amount,
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Chi phí phát sinh");
      XLSX.writeFile(wb, `Chi_phi_phat_sinh_${format(new Date(), 'ddMMyyyy_HHmm')}.xlsx`);
    } catch (error) {
      console.error(error);
      alert('Lỗi khi xuất Excel');
    }
  };

  const totalAmount = filteredExpenses.reduce((sum, exp) => {
    const amount = parseFloat(exp.amount.replace(/,/g, '')) || 0;
    return sum + amount;
  }, 0);

  return (
    <div className="space-y-6 relative z-10">
      <LoadingOverlay isLoading={loading} message="Đang tải dữ liệu..." />
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-extrabold text-gradient">Quản lý Chi phí phát sinh</h1>
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

      <div className="glass-panel p-6 rounded-3xl flex items-center justify-between bg-amber-500/10 border border-amber-500/20">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-amber-500/20 rounded-2xl">
            <Receipt className="w-8 h-8 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-moss-dark/70">Tổng chi phí (Theo bộ lọc)</p>
            <p className="text-3xl font-black text-amber-600">{totalAmount.toLocaleString('vi-VN')} VNĐ</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-moss-dark/70">Số lượng khoản chi</p>
          <p className="text-2xl font-bold text-moss-dark">{filteredExpenses.length} khoản</p>
        </div>
      </div>

      <div className="glass-panel overflow-hidden rounded-3xl">
        {filteredExpenses.length === 0 ? (
          <p className="p-8 text-center text-moss-dark/70 font-medium">Không tìm thấy chi phí nào phù hợp.</p>
        ) : (
          <ul className="divide-y divide-white/20">
            {filteredExpenses.map((expense) => (
              <li key={expense.id} className="p-4 sm:px-6 hover:bg-white/10 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-lg font-bold text-moss-dark">
                        {expense.description}
                      </p>
                      <div className="flex items-center text-sm font-medium text-moss-dark/70 bg-white/30 px-3 py-1 rounded-lg backdrop-blur-sm">
                        <Calendar className="flex-shrink-0 mr-1.5 h-4 w-4 text-moss" />
                        <p>{format(parseISO(expense.timestamp), 'dd/MM/yyyy HH:mm')}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-moss-dark/80">
                      <p className="bg-white/20 px-3 py-2 rounded-xl backdrop-blur-sm border border-white/30 flex items-center gap-2">
                        <User className="w-4 h-4 text-moss" />
                        <strong>Tài xế:</strong> {expense.driver_name}
                      </p>
                      <p className="bg-white/20 px-3 py-2 rounded-xl backdrop-blur-sm border border-white/30 flex items-center gap-2">
                        <Truck className="w-4 h-4 text-moss" />
                        <strong>Biển số:</strong> {expense.license_plate}
                      </p>
                    </div>

                    <div className="inline-block bg-amber-500/10 px-4 py-2 rounded-xl border border-amber-500/20">
                      <p className="text-lg font-black text-amber-600">
                        {expense.amount} VNĐ
                      </p>
                    </div>
                  </div>

                  {expense.photo_url && (
                    <div 
                      className="relative group cursor-pointer overflow-hidden rounded-xl border border-white/40 shadow-inner w-full md:w-48 h-32 flex-shrink-0"
                      onClick={() => setSelectedImage({ src: expense.photo_url, alt: `Hóa đơn: ${expense.description}` })}
                    >
                      <img 
                        src={expense.photo_url} 
                        alt="Hóa đơn" 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
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
