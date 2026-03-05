import { useState, useEffect } from 'react';
import { MapPin, Plus, Trash2, Search, Upload, FileDown, CheckCircle2, XCircle } from 'lucide-react';
import { apiFetch } from '../../utils/api';
import LoadingOverlay from '../../components/LoadingOverlay';

export default function AdminAgencies() {
  const [agencies, setAgencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAgency, setNewAgency] = useState({ name: '', address: '', phone: '', lat: '', lng: '' });
  const [importStatus, setImportStatus] = useState<{ success?: string, error?: string } | null>(null);

  useEffect(() => {
    fetchAgencies();
  }, []);

  const fetchAgencies = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/agencies');
      setAgencies(data);
    } catch (error) {
      console.error('Error fetching agencies', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAgency = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/agencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newAgency,
          lat: parseFloat(newAgency.lat) || null,
          lng: parseFloat(newAgency.lng) || null
        }),
      });
      setShowAddModal(false);
      setNewAgency({ name: '', address: '', phone: '', lat: '', lng: '' });
      fetchAgencies();
    } catch (error) {
      alert('Lỗi khi thêm đại lý');
    }
  };

  const handleDeleteAgency = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa đại lý này?')) return;
    try {
      await apiFetch(`/api/agencies/${id}`, { method: 'DELETE' });
      fetchAgencies();
    } catch (error) {
      alert('Lỗi khi xóa đại lý');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const importedAgencies = lines.slice(1).filter(line => line.trim()).map(line => {
        const values = line.split(',').map(v => v.trim());
        const agency: any = {};
        headers.forEach((header, index) => {
          if (header === 'tên' || header === 'name') agency.name = values[index];
          if (header === 'địa chỉ' || header === 'address') agency.address = values[index];
          if (header === 'sđt' || header === 'phone') agency.phone = values[index];
          if (header === 'lat') agency.lat = parseFloat(values[index]) || null;
          if (header === 'lng') agency.lng = parseFloat(values[index]) || null;
        });
        return agency;
      }).filter(a => a.name);

      if (importedAgencies.length === 0) {
        setImportStatus({ error: 'Không tìm thấy dữ liệu hợp lệ trong file CSV.' });
        return;
      }

      try {
        setLoading(true);
        await apiFetch('/api/agencies/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agencies: importedAgencies }),
        });
        setImportStatus({ success: `Đã nhập thành công ${importedAgencies.length} đại lý.` });
        fetchAgencies();
      } catch (error) {
        setImportStatus({ error: 'Lỗi khi nhập dữ liệu hàng loạt.' });
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const filteredAgencies = agencies.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 relative z-10">
      <LoadingOverlay isLoading={loading} message="Đang xử lý dữ liệu đại lý..." />
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-extrabold text-gradient">Danh sách Đại lý</h1>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 px-4 py-2 bg-moss/20 text-moss-dark rounded-xl font-bold cursor-pointer hover:bg-moss/30 transition-all active:scale-95 border border-moss/30">
            <Upload className="w-4 h-4" />
            Nhập CSV
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          </label>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-moss text-sand-light rounded-xl font-bold hover:bg-moss-dark transition-all shadow-lg shadow-moss/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Thêm Đại lý
          </button>
        </div>
      </div>

      {importStatus && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 border ${
          importStatus.success ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'
        }`}>
          {importStatus.success ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          <p className="font-bold">{importStatus.success || importStatus.error}</p>
          <button onClick={() => setImportStatus(null)} className="ml-auto font-black">×</button>
        </div>
      )}

      <div className="glass-panel rounded-3xl p-6">
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-moss-dark/40 w-5 h-5" />
          <input
            type="text"
            placeholder="Tìm kiếm đại lý theo tên hoặc địa chỉ..."
            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white/50 border border-white/40 focus:outline-none focus:ring-2 focus:ring-moss/50 transition-all font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-y-2">
            <thead>
              <tr className="text-moss-dark/50 text-sm font-bold uppercase tracking-wider">
                <th className="px-6 py-3">Đại lý</th>
                <th className="px-6 py-3">Địa chỉ</th>
                <th className="px-6 py-3">Số điện thoại</th>
                <th className="px-6 py-3">Tọa độ</th>
                <th className="px-6 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredAgencies.map((agency) => (
                <tr key={agency.id} className="bg-white/40 backdrop-blur-sm hover:bg-white/60 transition-colors group rounded-2xl overflow-hidden">
                  <td className="px-6 py-4 rounded-l-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-moss/20 flex items-center justify-center text-moss-dark font-bold border border-moss/10">
                        {agency.name.charAt(0)}
                      </div>
                      <span className="font-bold text-moss-dark">{agency.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-moss-dark/70 max-w-xs truncate">
                    {agency.address || '---'}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-moss-dark">
                    {agency.phone || '---'}
                  </td>
                  <td className="px-6 py-4 text-xs font-mono text-moss-dark/50">
                    {agency.lat && agency.lng ? `${agency.lat.toFixed(4)}, ${agency.lng.toFixed(4)}` : '---'}
                  </td>
                  <td className="px-6 py-4 text-right rounded-r-2xl">
                    <button
                      onClick={() => handleDeleteAgency(agency.id)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredAgencies.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-moss-dark/40 font-bold">
                    Không tìm thấy đại lý nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-8 w-full max-w-md border border-white/50 shadow-2xl">
            <h2 className="text-2xl font-black text-moss-dark mb-6">Thêm Đại lý mới</h2>
            <form onSubmit={handleAddAgency} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-moss-dark mb-1">Tên đại lý *</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 rounded-xl bg-white border border-moss/20 focus:ring-2 focus:ring-moss/50 outline-none"
                  value={newAgency.name}
                  onChange={(e) => setNewAgency({ ...newAgency, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-moss-dark mb-1">Địa chỉ</label>
                <textarea
                  className="w-full px-4 py-2 rounded-xl bg-white border border-moss/20 focus:ring-2 focus:ring-moss/50 outline-none"
                  rows={2}
                  value={newAgency.address}
                  onChange={(e) => setNewAgency({ ...newAgency, address: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-moss-dark mb-1">Số điện thoại</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 rounded-xl bg-white border border-moss/20 focus:ring-2 focus:ring-moss/50 outline-none"
                  value={newAgency.phone}
                  onChange={(e) => setNewAgency({ ...newAgency, phone: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-moss-dark mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    className="w-full px-4 py-2 rounded-xl bg-white border border-moss/20 focus:ring-2 focus:ring-moss/50 outline-none"
                    value={newAgency.lat}
                    onChange={(e) => setNewAgency({ ...newAgency, lat: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-moss-dark mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    className="w-full px-4 py-2 rounded-xl bg-white border border-moss/20 focus:ring-2 focus:ring-moss/50 outline-none"
                    value={newAgency.lng}
                    onChange={(e) => setNewAgency({ ...newAgency, lng: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-moss-dark bg-gray-100 hover:bg-gray-200 transition-all"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-sand-light bg-moss hover:bg-moss-dark transition-all shadow-lg shadow-moss/20"
                >
                  Lưu đại lý
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
