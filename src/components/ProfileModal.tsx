import React, { useState, useRef } from 'react';
import { X, Camera, Lock, User, Bell } from 'lucide-react';
import { apiFetch } from '../utils/api';
import LoadingOverlay from './LoadingOverlay';

interface ProfileModalProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
  onUpdateUser: (updatedUser: any) => void;
}

export default function ProfileModal({ user, isOpen, onClose, onUpdateUser }: ProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'avatar' | 'password' | 'notifications'>('avatar');
  const [passwordData, setPasswordData] = useState({ newPassword: '', confirmPassword: '' });
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    (typeof window !== 'undefined' && typeof window.Notification !== 'undefined') ? window.Notification.permission : 'denied'
  );
  const [avatar, setAvatar] = useState<string | null>(user.avatar_url || null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveAvatar = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/users/${user.id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: avatar }),
      });
      if (data.success) {
        onUpdateUser(data.user);
        alert('Cập nhật ảnh đại diện thành công!');
        onClose();
      } else {
        alert(data.message || 'Lỗi cập nhật');
      }
    } catch (error: any) {
      alert(error.message || 'Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('Mật khẩu xác nhận không khớp');
      return;
    }
    
    setLoading(true);
    try {
      const data = await apiFetch(`/api/users/${user.id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordData.newPassword }),
      });
      if (data.success) {
        alert('Đổi mật khẩu thành công!');
        setPasswordData({ newPassword: '', confirmPassword: '' });
        onClose();
      } else {
        alert(data.message || 'Lỗi cập nhật');
      }
    } catch (error: any) {
      alert(error.message || 'Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  };

  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || typeof window.Notification === 'undefined') {
      alert("Trình duyệt này không hỗ trợ thông báo.");
      return;
    }
    const permission = await window.Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === 'granted') {
      new window.Notification("ÚT NỮ's Future", { body: "Thông báo đã được bật thành công!" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <LoadingOverlay isLoading={loading} message="Đang lưu thay đổi..." />
      <div className="glass-panel w-full max-w-md rounded-3xl overflow-hidden relative animate-scale-in">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-moss-dark hover:bg-white/20 rounded-full transition-colors z-10"
        >
          <X className="w-6 h-6" />
        </button>
        
        <div className="p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-gradient mb-6 text-center">Cài đặt tài khoản</h2>
          
          <div className="flex p-1 space-x-1 bg-white/40 rounded-xl backdrop-blur-sm border border-white/50 mb-6">
            <button
              onClick={() => setActiveTab('avatar')}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 ${
                activeTab === 'avatar'
                  ? 'bg-moss text-white shadow-md'
                  : 'text-moss-dark/70 hover:bg-white/50 hover:text-moss-dark'
              }`}
            >
              <User className="w-4 h-4" />
              Ảnh đại diện
            </button>
            <button
              onClick={() => setActiveTab('password')}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 ${
                activeTab === 'password'
                  ? 'bg-moss text-white shadow-md'
                  : 'text-moss-dark/70 hover:bg-white/50 hover:text-moss-dark'
              }`}
            >
              <Lock className="w-4 h-4" />
              Bảo mật
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 ${
                activeTab === 'notifications'
                  ? 'bg-moss text-white shadow-md'
                  : 'text-moss-dark/70 hover:bg-white/50 hover:text-moss-dark'
              }`}
            >
              <Bell className="w-4 h-4" />
              Thông báo
            </button>
          </div>

          {activeTab === 'avatar' ? (
            <div className="space-y-6 flex flex-col items-center">
              <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white/50 shadow-xl bg-white/20">
                  {avatar ? (
                    <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-moss-dark/40 font-bold text-4xl bg-moss/10">
                      {user.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <Camera className="w-8 h-8 text-white" />
                </div>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleAvatarChange}
              />
              <p className="text-sm text-moss-dark/60 text-center">
                Nhấn vào ảnh để thay đổi avatar
              </p>
              <button
                onClick={handleSaveAvatar}
                disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-bold glass-button mt-4"
              >
                {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          ) : activeTab === 'password' ? (
            <form onSubmit={handleSavePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-moss-dark mb-1">Mật khẩu mới</label>
                <input
                  type="password"
                  required
                  className="glass-input block w-full rounded-xl sm:text-sm p-3"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-moss-dark mb-1">Xác nhận mật khẩu</label>
                <input
                  type="password"
                  required
                  className="glass-input block w-full rounded-xl sm:text-sm p-3"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-bold glass-button mt-6"
              >
                {loading ? 'Đang lưu...' : 'Đổi mật khẩu'}
              </button>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="p-4 bg-white/30 rounded-2xl border border-white/40 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${notificationPermission === 'granted' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-moss-dark">Thông báo đẩy</p>
                      <p className="text-xs text-moss-dark/60">
                        {notificationPermission === 'granted' ? 'Đã bật' : 
                         notificationPermission === 'denied' ? 'Đã chặn' : 'Chưa bật'}
                      </p>
                    </div>
                  </div>
                </div>
                
                {notificationPermission !== 'granted' ? (
                  <button
                    onClick={requestNotificationPermission}
                    className="w-full py-3 rounded-xl text-sm font-bold glass-button"
                  >
                    Bật thông báo ngay
                  </button>
                ) : (
                  <div className="p-3 bg-green-500/10 text-green-700 rounded-xl text-xs font-medium border border-green-500/20 text-center">
                    Anh/chị sẽ nhận được thông báo trực tiếp trên điện thoại khi có tin nhắn mới hoặc lệnh điều động.
                  </div>
                )}
              </div>
              
              <div className="p-4 bg-white/10 rounded-2xl border border-white/20">
                <p className="text-[10px] text-moss-dark/50 italic text-center">
                  *Lưu ý: Để nhận thông báo khi không mở ứng dụng, anh/chị hãy cài đặt ứng dụng vào màn hình chính (Add to Home Screen).
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
