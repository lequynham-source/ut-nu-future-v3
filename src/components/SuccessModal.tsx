import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle } from 'lucide-react';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
}

export default function SuccessModal({ isOpen, onClose, message = "Dữ liệu đã được ghi vào hệ thống thành công." }: SuccessModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.4, duration: 0.6 }}
            className="bg-white/80 backdrop-blur-xl border border-white/50 shadow-2xl rounded-3xl p-8 flex flex-col items-center max-w-sm w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", bounce: 0.5 }}
              className="w-20 h-20 bg-moss/20 rounded-full flex items-center justify-center mb-6 shadow-inner border border-moss/30"
            >
              <CheckCircle className="w-12 h-12 text-moss" />
            </motion.div>
            <h2 className="text-2xl font-extrabold text-moss-dark mb-2">Hoàn Thành Nhiệm Vụ</h2>
            <p className="text-moss-dark/70 font-medium mb-8">
              {message}
            </p>
            <button
              onClick={onClose}
              className="w-full py-3 px-6 rounded-xl font-bold text-sand-light bg-moss/80 hover:bg-moss shadow-lg shadow-moss/30 transition-all active:scale-95 border border-white/20"
            >
              Tiếp tục
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
