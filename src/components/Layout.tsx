import React, { useState, useEffect, useMemo, memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, LogOut, LayoutDashboard, Users, Truck, FileText, ClipboardList, Bell, Map, Moon, Sun, Database, CheckCircle2, XCircle, Trophy, Receipt, PackageMinus, MapPin, ShoppingCart } from 'lucide-react';
import { clsx } from 'clsx';
import ProfileModal from './ProfileModal';
import Logo from './Logo';
import AIChat from './AIChat';
import RolexClock from './RolexClock';

import { apiFetch, connectWebSocket, addWSListener, sendWSMessage } from '../utils/api';

export default function Layout({ children, user, onLogout, onUpdateUser }: { children: React.ReactNode, user: any, onLogout: () => void, onUpdateUser: (user: any) => void }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved === 'true' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  const location = useLocation();

  useEffect(() => {
    const init = async () => {
      await checkDbStatus();
      if (user.role === 'admin' || user.role === 'manager') {
        await new Promise(resolve => setTimeout(resolve, 200));
        await fetchNotifications();
      }
      
      // Connect WebSocket
      connectWebSocket(user.id, user);
      
      // Listen for real-time notifications
      const removeListener = addWSListener((data) => {
        if (data.type === 'notification') {
          setNotifications(prev => [{
            id: Date.now(),
            message: data.message,
            created_at: data.timestamp,
            is_read: 0
          }, ...prev]);
          
          // Browser notification if supported
          if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === "granted") {
            new window.Notification("ÚT NỮ's Future", { body: data.message });
          }
        }
        
        if (data.type === 'help_needed') {
          alert(`CẦN GIÚP ĐỠ: ${data.driverName} đang cần giúp đỡ tại vị trí của họ!`);
        }
      });

      // Request notification permission
      if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === "default") {
        window.Notification.requestPermission();
      }

      // Start location tracking for drivers
      let locationInterval: any;
      if (user.role === 'driver' || user.role === 'sale_driver') {
        const updateLocation = () => {
          if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition((position) => {
              sendWSMessage('location_update', {
                location: {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude
                }
              });
            });
          }
        };
        updateLocation();
        locationInterval = setInterval(updateLocation, 30000); // Every 30s
      }

      return () => {
        removeListener();
        if (locationInterval) clearInterval(locationInterval);
      };
    };
    init();
    
    const dbInterval = setInterval(checkDbStatus, 300000); // Check every 5 mins
    
    return () => {
      clearInterval(dbInterval);
    };
  }, [user.id, user.role]);

  const checkDbStatus = async () => {
    try {
      const data = await apiFetch('/api/db-status');
      setDbStatus(data.status === 'connected' ? 'connected' : 'error');
    } catch (error) {
      setDbStatus('error');
    }
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', isDarkMode.toString());
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  const fetchNotifications = async () => {
    try {
      const data = await apiFetch('/api/notifications');
      setNotifications(data);
    } catch (error) {
      console.error(error);
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' });
      fetchNotifications();
    } catch (error) {
      console.error(error);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showNotifications && !(event.target as Element).closest('.notification-container')) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  const NotificationList = memo(({ notifications, unreadCount, markAsRead, showNotifications }: any) => {
    if (!showNotifications) return null;
    
    return (
      <div className="absolute right-0 mt-2 w-80 glass-panel rounded-2xl shadow-2xl overflow-hidden border border-white/40 z-[100]">
        <div className="p-4 border-b border-white/20 bg-white/30 backdrop-blur-md flex justify-between items-center">
          <h3 className="font-bold text-moss-dark">Thông báo</h3>
          <span className="text-xs font-medium bg-moss/20 text-moss-dark px-2 py-1 rounded-lg">{unreadCount} mới</span>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-moss-dark/60">Không có thông báo nào</div>
          ) : (
            <ul className="divide-y divide-white/20">
              {notifications.map((notif: any) => (
                <li 
                  key={notif.id} 
                  className={clsx(
                    "p-4 hover:bg-white/20 transition-colors cursor-pointer",
                    !notif.is_read ? "bg-white/10" : "opacity-70"
                  )}
                  onClick={() => !notif.is_read && markAsRead(notif.id)}
                >
                  <p className={clsx("text-sm", !notif.is_read ? "font-bold text-moss-dark" : "text-moss-dark/80")}>
                    {notif.message}
                  </p>
                  <p className="text-xs text-moss-dark/50 mt-1">
                    {new Date(notif.created_at).toLocaleString('vi-VN')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  });

  const navigation = useMemo(() => {
    const adminNavigation = [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      { name: 'Quản lý Nhân sự', href: '/users', icon: Users },
      { name: 'Quản lý Đại lý', href: '/agencies', icon: MapPin },
      { name: 'Báo cáo Đại lý mới', href: '/new-agency-reports', icon: ShoppingCart },
      { name: 'Quản lý Đội xe', href: '/vehicles', icon: Truck },
      { name: 'Báo cáo Tài xế', href: '/driver-reports', icon: FileText },
      { name: 'Báo cáo Sale', href: '/sale-reports', icon: ClipboardList },
      { name: 'Báo cáo Hàng trả về', href: '/return-goods', icon: PackageMinus },
      { name: 'Chi phí phát sinh', href: '/expenses', icon: Receipt },
      { name: 'Bản đồ trực quan', href: '/map', icon: Map },
      { name: 'Bảng xếp hạng KPI', href: '/kpi', icon: Trophy },
    ];

    const driverNavigation = [
      { name: 'Giao hàng & Báo cáo', href: '/', icon: Truck },
    ];

    const saleNavigation = [
      { name: 'Chăm sóc Khách hàng', href: '/', icon: Users },
    ];

    const saleDriverNavigation = [
      { name: 'Giao hàng & Báo cáo', href: '/', icon: Truck },
      { name: 'Chăm sóc Khách hàng', href: '/sale-dashboard', icon: Users },
    ];

    const managerNavigation = [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      { name: 'Quản lý Đại lý', href: '/agencies', icon: MapPin },
      { name: 'Báo cáo Đại lý mới', href: '/new-agency-reports', icon: ShoppingCart },
      { name: 'Quản lý Đội xe', href: '/vehicles', icon: Truck },
      { name: 'Báo cáo Tài xế', href: '/driver-reports', icon: FileText },
      { name: 'Báo cáo Sale', href: '/sale-reports', icon: ClipboardList },
      { name: 'Báo cáo Hàng trả về', href: '/return-goods', icon: PackageMinus },
      { name: 'Chi phí phát sinh', href: '/expenses', icon: Receipt },
      { name: 'Bản đồ trực quan', href: '/map', icon: Map },
      { name: 'Bảng xếp hạng KPI', href: '/kpi', icon: Trophy },
    ];

    if (user.role === 'admin') return adminNavigation;
    if (user.role === 'manager') return managerNavigation;
    if (user.role === 'driver') return driverNavigation;
    if (user.role === 'sale') return saleNavigation;
    return saleDriverNavigation;
  }, [user.role]);

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="fixed top-[-10%] left-[-10%] w-96 h-96 bg-moss/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 pointer-events-none"></div>
      <div className="fixed top-[20%] right-[-10%] w-96 h-96 bg-sand/40 rounded-full mix-blend-multiply filter blur-3xl opacity-70 pointer-events-none"></div>
      <div className="fixed bottom-[-20%] left-[20%] w-96 h-96 bg-moss-light/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 pointer-events-none"></div>

      {/* Mobile sidebar */}
      <div className={clsx("fixed inset-0 z-50 lg:hidden", sidebarOpen ? "block" : "hidden")}>
        <div className="fixed inset-0 bg-moss-dark/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 w-64 glass-panel flex flex-col border-r border-white/30">
          <div className="flex items-center justify-between h-16 px-4 border-b border-white/20">
            <div className="flex items-center gap-2">
              <Logo className="w-10 h-10" />
              <span className="text-xl font-bold text-gradient">ÚT NỮ's Future</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="p-2 text-moss-dark hover:bg-white/20 rounded-xl transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={clsx(
                    "flex items-center px-3 py-3 text-sm font-medium rounded-xl transition-all duration-300 active:scale-95",
                    isActive ? "bg-moss/20 text-moss-dark shadow-sm border border-white/40" : "text-moss-dark/70 hover:bg-white/30 hover:text-moss-dark"
                  )}
                >
                  <item.icon className={clsx("mr-3 w-5 h-5", isActive ? "text-moss-dark" : "text-moss-dark/50")} />
                  {item.name}
                </Link>
              );
            })}
            <div className="pt-4 mt-4 border-t border-white/10">
              <div className="mb-6 flex justify-center scale-90">
                <RolexClock />
              </div>
              <div className={`flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-bold border ${
                dbStatus === 'connected' 
                  ? 'bg-emerald-100/50 text-emerald-700 border-emerald-200/50' 
                  : dbStatus === 'error'
                    ? 'bg-red-100/50 text-red-700 border-red-200/50'
                    : 'bg-gray-100/50 text-gray-700 border-gray-200/50'
              }`}>
                {dbStatus === 'connected' ? (
                  <><CheckCircle2 className="w-4 h-4" /> Tình trạng thiết bị: OK</>
                ) : dbStatus === 'error' ? (
                  <><XCircle className="w-4 h-4" /> Tình trạng thiết bị: Lỗi</>
                ) : (
                  <><Database className="w-4 h-4 animate-pulse" /> Đang kiểm tra...</>
                )}
              </div>
            </div>
          </nav>
          <div className="p-4 border-t border-white/20 bg-white/10">
            <div 
              className="flex items-center mb-4 cursor-pointer hover:bg-white/10 p-2 rounded-xl transition-colors"
              onClick={() => setIsProfileOpen(true)}
            >
              <div className="w-10 h-10 rounded-full bg-moss/20 flex items-center justify-center text-moss-dark font-bold border border-white/40 shadow-sm overflow-hidden">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  user.name.charAt(0)
                )}
              </div>
              <div className="ml-3">
                <p className="text-sm font-bold text-moss-dark">{user.name}</p>
                <p className="text-xs text-moss-dark/70 capitalize font-medium">{user.role}</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center justify-center w-full px-4 py-2 text-sm font-bold text-red-700 bg-red-500/10 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-all duration-300 active:scale-95"
            >
              <LogOut className="mr-2 w-4 h-4" />
              Đăng xuất
            </button>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col glass-panel border-r border-white/30 z-20 m-4 rounded-3xl h-[calc(100vh-2rem)]">
        <div className="flex items-center h-20 px-6 border-b border-white/20">
          <div className="flex items-center gap-3">
            <Logo className="w-12 h-12" />
            <span className="text-xl font-extrabold text-gradient tracking-tight">ÚT NỮ's Future</span>
          </div>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={clsx(
                  "flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 active:scale-95",
                  isActive ? "bg-moss/20 text-moss-dark shadow-sm border border-white/40 backdrop-blur-md" : "text-moss-dark/70 hover:bg-white/40 hover:text-moss-dark"
                )}
              >
                <item.icon className={clsx("mr-3 w-5 h-5", isActive ? "text-moss-dark" : "text-moss-dark/50")} />
                {item.name}
              </Link>
            );
          })}

          <div className="pt-4 mt-4 border-t border-white/10">
            <div className="mb-6 flex justify-center">
              <RolexClock />
            </div>
            <div className={`flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-bold border ${
              dbStatus === 'connected' 
                ? 'bg-emerald-100/50 text-emerald-700 border-emerald-200/50' 
                : dbStatus === 'error'
                  ? 'bg-red-100/50 text-red-700 border-red-200/50'
                  : 'bg-gray-100/50 text-gray-700 border-gray-200/50'
            }`}>
              {dbStatus === 'connected' ? (
                <><CheckCircle2 className="w-4 h-4" /> Tình trạng thiết bị: OK</>
              ) : dbStatus === 'error' ? (
                <><XCircle className="w-4 h-4" /> Tình trạng thiết bị: Lỗi</>
              ) : (
                <><Database className="w-4 h-4 animate-pulse" /> Đang kiểm tra...</>
              )}
            </div>
          </div>
        </nav>
        <div className="p-6 border-t border-white/20 bg-white/10 rounded-b-3xl">
          <div 
            className="flex items-center mb-6 cursor-pointer hover:bg-white/10 p-2 rounded-xl transition-colors"
            onClick={() => setIsProfileOpen(true)}
          >
            <div className="w-12 h-12 rounded-full bg-moss/20 flex items-center justify-center text-moss-dark font-bold text-lg border border-white/40 shadow-sm overflow-hidden">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                user.name.charAt(0)
              )}
            </div>
            <div className="ml-4">
              <p className="text-sm font-bold text-moss-dark">{user.name}</p>
              <p className="text-xs text-moss-dark/70 capitalize font-medium">{user.role}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center justify-center w-full px-4 py-3 text-sm font-bold text-red-700 bg-red-500/10 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-all duration-300 active:scale-95"
          >
            <LogOut className="mr-2 w-4 h-4" />
            Đăng xuất
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen lg:pl-[19.5rem] relative z-10">
        <div className="sticky top-0 z-20 flex items-center justify-between h-16 px-4 glass-panel border-b border-white/20 lg:hidden rounded-b-2xl mx-2 mt-2">
          <div className="flex items-center">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 text-moss-dark rounded-xl hover:bg-white/30 transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="ml-4 flex items-center gap-2">
              <Logo className="w-10 h-10" />
              <span className="text-lg font-extrabold text-gradient">ÚT NỮ's Future</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={toggleDarkMode}
              className="p-2 text-moss-dark rounded-xl hover:bg-white/30 transition-colors"
              title={isDarkMode ? "Chế độ sáng" : "Chế độ tối"}
            >
              {isDarkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
            </button>

            {(user.role === 'admin' || user.role === 'manager') && (
              <div className="relative notification-container">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 text-moss-dark rounded-xl hover:bg-white/30 transition-colors relative"
                >
                  <Bell className="w-6 h-6" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
                  )}
                </button>
                <NotificationList 
                  notifications={notifications} 
                  unreadCount={unreadCount} 
                  markAsRead={markAsRead} 
                  showNotifications={showNotifications} 
                />
              </div>
            )}
          </div>
        </div>

        {/* Desktop Header for Notifications & Theme Toggle */}
        <div className="hidden lg:flex items-center justify-end p-4 gap-4">
          <button
            onClick={toggleDarkMode}
            className="p-3 glass-panel rounded-xl text-moss-dark hover:bg-white/50 transition-colors"
            title={isDarkMode ? "Chế độ sáng" : "Chế độ tối"}
          >
            {isDarkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
          </button>

          {(user.role === 'admin' || user.role === 'manager') && (
            <div className="relative z-50 notification-container">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-3 glass-panel rounded-xl text-moss-dark hover:bg-white/50 transition-colors relative"
              >
                <Bell className="w-6 h-6" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
                )}
              </button>

              <NotificationList 
                notifications={notifications} 
                unreadCount={unreadCount} 
                markAsRead={markAsRead} 
                showNotifications={showNotifications} 
              />
            </div>
          )}
        </div>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 lg:pt-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      <AIChat user={user} />

      <ProfileModal 
        user={user} 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
        onUpdateUser={onUpdateUser}
      />
    </div>
  );
}
