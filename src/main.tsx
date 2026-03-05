import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  registerSW({
    onNeedRefresh() {
      if (confirm('Ứng dụng đã có bản cập nhật mới. Anh/chị muốn tải lại không?')) {
        window.location.reload();
      }
    },
    onOfflineReady() {
      console.log('Ứng dụng đã sẵn sàng hoạt động ngoại tuyến!');
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
