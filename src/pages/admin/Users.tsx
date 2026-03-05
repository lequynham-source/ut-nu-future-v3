import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { apiFetch } from '../../utils/api';

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ username: '', password: '', role: 'driver', name: '' });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await apiFetch('/api/users');
      if (Array.isArray(data)) {
        setUsers(data);
      } else {
        console.error('API returned non-array data for users:', data);
        setUsers([]);
      }
    } catch (error) {
      console.error(error);
      setUsers([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await apiFetch(`/api/users/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      } else {
        await apiFetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      }
      resetForm();
      fetchUsers();
    } catch (error: any) {
      alert(error.message || 'Lỗi khi thao tác với người dùng.');
    }
  };

  const resetForm = () => {
    setFormData({ username: '', password: '', role: 'driver', name: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (user: any) => {
    if (user.username === 'admin') {
      alert('Không thể chỉnh sửa tài khoản quản trị viên hệ thống.');
      return;
    }
    setFormData({
      username: user.username,
      password: '', // Don't show password, only update if provided
      role: user.role,
      name: user.name
    });
    setEditingId(user.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number, username: string) => {
    if (username === 'admin') {
      alert('Không thể xóa tài khoản quản trị viên hệ thống.');
      return;
    }
    if (confirm(`Bạn có chắc chắn muốn xóa người dùng ${username}?`)) {
      try {
        await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
        fetchUsers();
      } catch (error: any) {
        alert(error.message);
      }
    }
  };

  return (
    <div className="space-y-6 relative z-10">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-extrabold text-gradient">Quản lý Nhân sự</h1>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold glass-button"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5" />
          {editingId ? 'Đang chỉnh sửa' : 'Thêm mới'}
        </button>
      </div>

      {showForm && (
        <div className="glass-panel rounded-3xl p-6 sm:p-8 animate-scale-in">
          <h2 className="text-xl font-bold text-moss-dark mb-4">
            {editingId ? `Chỉnh sửa: ${formData.username}` : 'Thêm người dùng mới'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-bold text-moss-dark mb-1">Họ và tên</label>
                <input
                  type="text"
                  required
                  className="glass-input block w-full rounded-xl sm:text-sm p-3 placeholder-moss-dark/40"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-moss-dark mb-1">Tên đăng nhập</label>
                <input
                  type="text"
                  required
                  className="glass-input block w-full rounded-xl sm:text-sm p-3 placeholder-moss-dark/40"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-moss-dark mb-1">
                  Mật khẩu {editingId && '(Để trống nếu không đổi)'}
                </label>
                <input
                  type="password"
                  required={!editingId}
                  className="glass-input block w-full rounded-xl sm:text-sm p-3 placeholder-moss-dark/40"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-moss-dark mb-1">Vai trò</label>
                <select
                  className="glass-input block w-full rounded-xl sm:text-sm p-3"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="driver">Tài xế</option>
                  <option value="sale">Nhân viên Sale</option>
                  <option value="sale_driver">Sale & Tài xế</option>
                  <option value="manager">Người Quản Lý</option>
                  <option value="admin">Quản trị viên</option>
                </select>
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
                {editingId ? 'Cập nhật' : 'Lưu'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-panel overflow-hidden rounded-3xl">
        <ul className="divide-y divide-white/20">
          {users.map((user) => (
            <li key={user.id} className="px-4 py-4 sm:px-6 flex items-center justify-between hover:bg-white/10 transition-colors">
              <div className="flex items-center">
                <div className="flex-shrink-0 h-12 w-12 rounded-full bg-moss/20 flex items-center justify-center text-moss-dark font-bold text-lg border border-white/40 shadow-sm overflow-hidden">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    user.name.charAt(0)
                  )}
                </div>
                <div className="ml-4">
                  <div className="text-sm font-bold text-moss-dark">{user.name}</div>
                  <div className="text-sm font-medium text-moss-dark/70">
                    @{user.username} - {
                      user.role === 'admin' ? 'Quản trị viên' : 
                      user.role === 'manager' ? 'Người Quản Lý' :
                      user.role === 'driver' ? 'Tài xế' : 
                      user.role === 'sale' ? 'Sale' : 'Sale & Tài xế'
                    }
                  </div>
                </div>
              </div>
              <div className="flex space-x-2">
                {user.username !== 'admin' && (
                  <>
                    <button
                      onClick={() => handleEdit(user)}
                      className="text-moss hover:text-moss-dark p-2 bg-moss/10 hover:bg-moss/20 rounded-xl transition-all duration-300 active:scale-95"
                      title="Chỉnh sửa"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(user.id, user.username)}
                      className="text-red-500 hover:text-red-700 p-2 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-all duration-300 active:scale-95"
                      title="Xóa"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
