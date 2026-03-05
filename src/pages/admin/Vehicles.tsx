import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { apiFetch } from '../../utils/api';
import LoadingOverlay from '../../components/LoadingOverlay';

export default function AdminVehicles() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ license_plate: '', insurance_expiry: '', registration_expiry: '' });

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await apiFetch(`/api/vehicles/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        resetForm();
        fetchVehicles();
      } else {
        await apiFetch('/api/vehicles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        resetForm();
        fetchVehicles();
      }
    } catch (error: any) {
      alert(error.message || 'Lỗi khi thao tác với dữ liệu xe.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ license_plate: '', insurance_expiry: '', registration_expiry: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (vehicle: any) => {
    setFormData({
      license_plate: vehicle.license_plate,
      insurance_expiry: vehicle.insurance_expiry || '',
      registration_expiry: vehicle.registration_expiry || ''
    });
    setEditingId(vehicle.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Bạn có chắc chắn muốn xóa xe này?')) {
      setLoading(true);
      try {
        await apiFetch(`/api/vehicles/${id}`, { method: 'DELETE' });
        fetchVehicles();
      } catch (error: any) {
        alert(error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="space-y-6 relative z-10">
      <LoadingOverlay isLoading={loading} message="Đang xử lý dữ liệu..." />
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-extrabold text-gradient">Quản lý Đội xe</h1>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold glass-button"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5" />
          Thêm xe mới
        </button>
      </div>

      {showForm && (
        <div className="glass-panel rounded-3xl p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-bold text-moss-dark mb-1">Biển số xe</label>
                <input
                  type="text"
                  required
                  disabled={!!editingId}
                  className="glass-input block w-full rounded-xl sm:text-sm p-3 disabled:bg-white/20 disabled:text-moss-dark/50"
                  value={formData.license_plate}
                  onChange={(e) => setFormData({ ...formData, license_plate: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-moss-dark mb-1">Ngày hết hạn Bảo hiểm</label>
                <input
                  type="date"
                  className="glass-input block w-full rounded-xl sm:text-sm p-3"
                  value={formData.insurance_expiry}
                  onChange={(e) => setFormData({ ...formData, insurance_expiry: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-moss-dark mb-1">Ngày hết hạn Đăng kiểm</label>
                <input
                  type="date"
                  className="glass-input block w-full rounded-xl sm:text-sm p-3"
                  value={formData.registration_expiry}
                  onChange={(e) => setFormData({ ...formData, registration_expiry: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 rounded-xl text-sm font-bold text-moss-dark bg-white/40 hover:bg-white/60 border border-white/50 backdrop-blur-sm transition-all duration-300 active:scale-95"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-sm font-bold glass-button"
              >
                Lưu
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-panel overflow-hidden rounded-3xl">
        <ul className="divide-y divide-white/20">
          {vehicles.map((vehicle) => (
            <li key={vehicle.id} className="px-4 py-4 sm:px-6 flex items-center justify-between hover:bg-white/10 transition-colors">
              <div className="flex items-center">
                <div className="ml-4">
                  <div className="text-lg font-bold text-moss-dark">{vehicle.license_plate}</div>
                  <div className="text-sm font-medium text-moss-dark/70 mt-1">
                    Bảo hiểm: {getExpiryInfo(vehicle.insurance_expiry)} | 
                    Đăng kiểm: {getExpiryInfo(vehicle.registration_expiry)}
                  </div>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEdit(vehicle)}
                  className="text-moss hover:text-moss-dark p-2 bg-moss/10 hover:bg-moss/20 rounded-xl transition-all duration-300 active:scale-95"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleDelete(vehicle.id)}
                  className="text-red-500 hover:text-red-700 p-2 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-all duration-300 active:scale-95"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
