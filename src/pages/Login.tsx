import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { apiFetch } from '../utils/api';
import LoadingOverlay from '../components/LoadingOverlay';
import Logo from '../components/Logo';

export default function Login({ onLogin }: { onLogin: (user: any) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [user, setUser] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await apiFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      
      if (data.success) {
        setUser(data.user);
        setShowWelcome(true);
        setTimeout(() => {
          onLogin(data.user);
        }, 3000);
      } else {
        setError(data.message || 'Đăng nhập thất bại');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối đến máy chủ');
    } finally {
      setLoading(false);
    }
  };

  if (showWelcome) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-white to-moss/10">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-moss/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
          <div className="absolute top-[20%] right-[-10%] w-96 h-96 bg-sand/50 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-moss-light/40 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>
        
        <div className="relative z-10 flex flex-col items-center animate-scale-in">
          <div className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center mb-6 shadow-lg shadow-green-500/50 animate-bounce-custom">
            <Check className="w-12 h-12 text-white stroke-[3]" />
          </div>
          <h1 className="text-4xl font-extrabold text-moss-dark mb-2 text-center">
            Xin chào, <span className="text-gradient">{user?.name}</span>!
          </h1>
          <p className="text-moss-dark/70 text-lg font-medium">Đăng nhập thành công</p>
          <div className="mt-8 flex gap-2">
            <div className="w-2 h-2 rounded-full bg-moss animate-pulse"></div>
            <div className="w-2 h-2 rounded-full bg-moss animate-pulse delay-100"></div>
            <div className="w-2 h-2 rounded-full bg-moss animate-pulse delay-200"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      <LoadingOverlay isLoading={loading} message="Đang đăng nhập..." />
      {/* Decorative background elements for glassmorphism */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-moss/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
      <div className="absolute top-[20%] right-[-10%] w-96 h-96 bg-sand/50 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-moss-light/40 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>

      <div className="max-w-md w-full space-y-8 glass-panel p-10 rounded-3xl relative z-10">
        <div className="flex flex-col items-center">
          <Logo className="h-24 w-24 mb-4" />
          <h2 className="mt-2 text-center text-4xl font-extrabold text-gradient tracking-tight">
            ÚT NỮ's Future
          </h2>
          <p className="mt-2 text-center text-sm text-moss-dark/80 font-medium">
            Hệ thống quản lý tương lai
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-700 px-4 py-3 rounded-xl text-sm backdrop-blur-sm">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-moss-dark mb-1">Tên đăng nhập</label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="glass-input block w-full px-4 py-3 rounded-xl text-moss-dark placeholder-moss-dark/50 sm:text-sm"
                placeholder="Nhập tên đăng nhập"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-moss-dark mb-1">Mật khẩu</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="glass-input block w-full px-4 py-3 rounded-xl text-moss-dark placeholder-moss-dark/50 sm:text-sm"
                placeholder="Nhập mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 rounded-xl text-sm font-bold glass-button active:scale-95"
            >
              {loading ? 'Đang xử lý...' : 'Đăng nhập'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
