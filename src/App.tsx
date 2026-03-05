/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, lazy, Suspense } from 'react';
import Login from './pages/Login';
import Layout from './components/Layout';

// Lazy load pages for better performance on older devices
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminUsers = lazy(() => import('./pages/admin/Users'));
const AdminVehicles = lazy(() => import('./pages/admin/Vehicles'));
const AdminDriverReports = lazy(() => import('./pages/admin/DriverReports'));
const AdminSaleReports = lazy(() => import('./pages/admin/SaleReports'));
const AdminMapView = lazy(() => import('./pages/admin/MapView'));
const AdminKPI = lazy(() => import('./pages/admin/KPI'));
const AdminExpenses = lazy(() => import('./pages/admin/Expenses'));
const AdminReturnGoodsReports = lazy(() => import('./pages/admin/ReturnGoodsReports'));
const AdminAgencies = lazy(() => import('./pages/admin/Agencies'));
const AdminNewAgencyReports = lazy(() => import('./pages/admin/NewAgencyReports'));
const DriverDashboard = lazy(() => import('./pages/driver/Dashboard'));
const SaleDashboard = lazy(() => import('./pages/sale/Dashboard'));

// Simple loading fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
  </div>
);

export default function App() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogin = (userData: any) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const handleUpdateUser = (updatedUser: any) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
      <Layout user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {(user.role === 'admin' || user.role === 'manager') && (
              <>
                <Route path="/" element={<AdminDashboard />} />
                {user.role === 'admin' && <Route path="/users" element={<AdminUsers />} />}
                <Route path="/agencies" element={<AdminAgencies />} />
                <Route path="/new-agency-reports" element={<AdminNewAgencyReports />} />
                <Route path="/vehicles" element={<AdminVehicles />} />
                <Route path="/driver-reports" element={<AdminDriverReports />} />
                <Route path="/sale-reports" element={<AdminSaleReports />} />
                <Route path="/map" element={<AdminMapView />} />
                <Route path="/kpi" element={<AdminKPI />} />
                <Route path="/expenses" element={<AdminExpenses />} />
                <Route path="/return-goods" element={<AdminReturnGoodsReports />} />
              </>
            )}
            {user.role === 'driver' && (
              <>
                <Route path="/" element={<DriverDashboard user={user} />} />
              </>
            )}
            {user.role === 'sale' && (
              <>
                <Route path="/" element={<SaleDashboard user={user} />} />
              </>
            )}
            {user.role === 'sale_driver' && (
              <>
                <Route path="/" element={<DriverDashboard user={user} />} />
                <Route path="/sale-dashboard" element={<SaleDashboard user={user} />} />
              </>
            )}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Layout>
    </Router>
  );
}
