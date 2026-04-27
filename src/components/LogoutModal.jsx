import React, { useEffect } from 'react';

export default function LogoutModal({ open, onConfirm, onCancel }) {
  // กด ESC เพื่อปิด modal
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    if (open) {
      window.addEventListener('keydown', handleEsc);
    }

    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50"
      onClick={onCancel} // คลิก backdrop = ปิด
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()} // กัน click ทะลุ
      >
        <h2 className="text-lg font-semibold text-gray-800 font-['Sarabun']">
          ยืนยันออกจากระบบ
        </h2>

        <p className="text-sm text-gray-500 mt-2 font-['Sarabun']">
          คุณต้องการออกจากระบบใช่หรือไม่?
        </p>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-xl border border-gray-300 hover:bg-gray-100 transition"
          >
            ยกเลิก
          </button>

          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600 transition"
          >
            ออกจากระบบ
          </button>
        </div>
      </div>
    </div>
  );
}