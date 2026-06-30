import React from 'react';
import { Save, AlertTriangle, X } from 'lucide-react';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  tabTitle: string;
  onClose: () => void;
  onSaveAndClose: () => void;
  onCloseWithoutSaving: () => void;
}

export default function UnsavedChangesModal({ 
  isOpen, 
  tabTitle, 
  onClose, 
  onSaveAndClose, 
  onCloseWithoutSaving 
}: UnsavedChangesModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-[#1a1a1a] border border-[#333] rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#333] bg-[#222]">
          <div className="flex items-center gap-2 text-orange-400">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-semibold text-lg">저장하지 않은 변경 사항</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Body */}
        <div className="px-6 py-6 text-gray-300">
          <p>
            <strong className="text-white">'{tabTitle}'</strong> 맵에 저장되지 않은 변경 사항이 있습니다.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            저장하지 않고 닫으면 수정한 내용이 모두 사라집니다.
          </p>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 bg-[#111] border-t border-[#333] flex items-center justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded text-sm text-gray-400 hover:text-white hover:bg-[#333] transition-colors"
          >
            취소
          </button>
          <button 
            onClick={onCloseWithoutSaving}
            className="px-4 py-2 rounded text-sm text-red-400 hover:text-white hover:bg-red-500/20 border border-red-500/30 transition-colors"
          >
            저장하지 않고 닫기
          </button>
          <button 
            onClick={onSaveAndClose}
            className="flex items-center gap-2 px-4 py-2 rounded text-sm text-black font-semibold bg-blue-500 hover:bg-blue-400 transition-colors shadow-[0_0_15px_rgba(59,130,246,0.3)]"
          >
            <Save className="w-4 h-4" />
            저장 후 닫기
          </button>
        </div>

      </div>
    </div>
  );
}
