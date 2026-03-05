import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
}

export default function LoadingOverlay({ isLoading, message = 'Đang xử lý...' }: LoadingOverlayProps) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isLoading) {
      setVisible(true);
      setProgress(0);
      
      // Simulate progress
      interval = setInterval(() => {
        setProgress(prev => {
          // Slow down as it gets closer to 90%
          const increment = prev < 50 ? 15 : prev < 80 ? 5 : prev < 90 ? 1 : 0;
          return Math.min(prev + increment, 90);
        });
      }, 500);
    } else if (visible) {
      // Complete the progress
      setProgress(100);
      
      // Hide after a short delay to show 100%
      const timeout = setTimeout(() => {
        setVisible(false);
      }, 500);
      
      return () => clearTimeout(timeout);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading, visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <div className="bg-white/90 dark:bg-moss-dark/90 p-8 rounded-3xl shadow-2xl max-w-sm w-full mx-4 border border-white/20 flex flex-col items-center">
            <div className="relative w-24 h-24 mb-6">
              {/* Circular Progress */}
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  className="text-gray-200 dark:text-gray-700 stroke-current"
                  strokeWidth="8"
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                ></circle>
                <circle
                  className="text-moss dark:text-amber-400 stroke-current transition-all duration-300 ease-out"
                  strokeWidth="8"
                  strokeLinecap="round"
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  strokeDasharray={`${2 * Math.PI * 40}`}
                  strokeDashoffset={`${2 * Math.PI * 40 * (1 - progress / 100)}`}
                ></circle>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold text-moss-dark dark:text-amber-400">
                  {progress}%
                </span>
              </div>
            </div>
            
            <h3 className="text-lg font-bold text-moss-dark dark:text-amber-400 mb-2 text-center">
              {message}
            </h3>
            <p className="text-sm text-moss-dark/60 dark:text-amber-400/60 text-center">
              Vui lòng không đóng trình duyệt
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
