import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export default function RolexClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatLunarDate = (date: Date) => {
    try {
      // Use Intl with Chinese calendar as a close approximation for Lunar calendar
      const formatter = new Intl.DateTimeFormat('vi-VN-u-ca-chinese', {
        day: 'numeric',
        month: 'numeric',
      });
      const parts = formatter.formatToParts(date);
      const day = parts.find(p => p.type === 'day')?.value;
      const month = parts.find(p => p.type === 'month')?.value;
      return `Âm lịch: Ngày ${day} tháng ${month}`;
    } catch (e) {
      return "";
    }
  };

  return (
    <div className="relative group">
      {/* Outer Glow */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-[#C5A059] to-[#8E6E3A] rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
      
      <div className="relative flex flex-col items-center justify-center p-4 rounded-2xl bg-gradient-to-b from-[#004d2e] to-[#002b1a] border border-[#C5A059]/30 shadow-2xl overflow-hidden">
        {/* Rolex-style subtle texture/gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(197,160,89,0.1),transparent_70%)] pointer-events-none"></div>
        
        {/* Crown Icon Placeholder (using a stylized Clock or custom SVG) */}
        <div className="mb-1 flex flex-col items-center">
          <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#C5A059] drop-shadow-[0_0_8px_rgba(197,160,89,0.5)]" fill="currentColor">
            <path d="M5,16L3,5L8.5,10L12,4L15.5,10L21,5L19,16H5M19,19A1,1 0 0,1 18,20H6A1,1 0 0,1 5,19V18H19V19Z" />
          </svg>
          <span className="text-[8px] uppercase tracking-[0.3em] font-bold text-[#C5A059]/80 mt-0.5">ÚT NỮ PRECISION</span>
        </div>

        {/* Digital Time */}
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-[#F9F6F0] via-[#E6D5B8] to-[#C5A059] drop-shadow-sm font-mono">
            {formatTime(time)}
          </span>
        </div>

        {/* Date */}
        <div className="mt-1 text-[10px] uppercase tracking-widest font-bold text-[#C5A059]/60">
          {formatDate(time)}
        </div>

        {/* Lunar Date */}
        <div className="mt-0.5 text-[9px] font-medium text-[#C5A059]/50 italic">
          {formatLunarDate(time)}
        </div>

        {/* Bottom Decorative Line */}
        <div className="mt-3 w-12 h-0.5 bg-gradient-to-r from-transparent via-[#C5A059]/40 to-transparent"></div>
      </div>
    </div>
  );
}
