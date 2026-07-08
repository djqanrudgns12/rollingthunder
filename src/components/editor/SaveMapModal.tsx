import React, { useEffect, useState } from 'react';
import { Save, X, Loader2, AlertTriangle } from 'lucide-react';
import type { MapComplexity, MapLengthType } from '@/core/entities/Map';
import { USER_MAP_SLOT_LIMIT } from '@/core/entities/UserMap';

export interface SaveMapMeta {
  name: string;
  description: string;
  lengthType: MapLengthType;
  complexity: MapComplexity;
}

export type SaveTarget = 'official' | 'personal';

interface SaveMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMeta: SaveMapMeta;
  /** admin 전용: 공식맵(maps) / 내 커스텀 맵(user_maps) 저장 위치 선택 노출 */
  canChooseTarget: boolean;
  defaultTarget: SaveTarget;
  /** premium 신규 저장 시 슬롯 게이지 표시 (null 이면 미표시) */
  slotUsed: number | null;
  /** 배포된 맵 재저장 경고 */
  isPublished: boolean;
  isSaving: boolean;
  onSubmit: (meta: SaveMapMeta, target: SaveTarget) => void;
}

const LENGTH_OPTIONS: { value: MapLengthType; label: string }[] = [
  { value: 'Short', label: '숏 (Short) — 짧은 코스' },
  { value: 'Middle', label: '미들 (Middle) — 표준 코스' },
  { value: 'Long', label: '롱 (Long) — 긴 코스' },
];

const COMPLEXITY_OPTIONS: { value: MapComplexity; label: string }[] = [
  { value: 'Simple', label: '단순 (Simple) — 장애물 적음' },
  { value: 'Medium', label: '중간 (Medium) — 표준 밀도' },
  { value: 'Complex', label: '복잡 (Complex) — 장애물 많음' },
];

export default function SaveMapModal({
  isOpen,
  onClose,
  initialMeta,
  canChooseTarget,
  defaultTarget,
  slotUsed,
  isPublished,
  isSaving,
  onSubmit,
}: SaveMapModalProps) {
  const [name, setName] = useState(initialMeta.name);
  const [description, setDescription] = useState(initialMeta.description);
  const [lengthType, setLengthType] = useState<MapLengthType>(initialMeta.lengthType);
  const [complexity, setComplexity] = useState<MapComplexity>(initialMeta.complexity);
  const [target, setTarget] = useState<SaveTarget>(defaultTarget);

  // 모달을 열 때마다 현재 맵 메타로 리셋
  useEffect(() => {
    if (isOpen) {
      setName(initialMeta.name);
      setDescription(initialMeta.description);
      setLengthType(initialMeta.lengthType);
      setComplexity(initialMeta.complexity);
      setTarget(defaultTarget);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const trimmedName = name.trim();
  const showSlotGauge = slotUsed !== null && target === 'personal';
  const slotFull = showSlotGauge && slotUsed! >= USER_MAP_SLOT_LIMIT;

  return (
    <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-[#1a1a1a] border border-[#333] rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#333] bg-[#222]">
          <div className="flex items-center gap-2 text-blue-400">
            <Save className="w-5 h-5" />
            <h3 className="font-semibold text-lg">맵 저장</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 text-gray-300">
          {canChooseTarget && (
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">저장 위치</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTarget('official')}
                  className={`px-3 py-2 rounded text-sm border transition-colors ${
                    target === 'official'
                      ? 'bg-blue-500/20 border-blue-500/60 text-blue-300'
                      : 'bg-[#222] border-[#444] text-gray-400 hover:bg-[#2a2a2a]'
                  }`}
                >
                  공식 맵 카탈로그
                </button>
                <button
                  onClick={() => setTarget('personal')}
                  className={`px-3 py-2 rounded text-sm border transition-colors ${
                    target === 'personal'
                      ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                      : 'bg-[#222] border-[#444] text-gray-400 hover:bg-[#2a2a2a]'
                  }`}
                >
                  내 커스텀 맵
                </button>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                내 커스텀 맵으로 저장해야 맵 스토어에 배포할 수 있습니다.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              맵 이름 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              placeholder="맵 이름을 입력하세요"
              className="w-full bg-[#111] border border-[#444] rounded px-3 py-2 text-white text-sm outline-none focus:border-blue-500 transition-colors"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">설명</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              rows={3}
              placeholder="맵의 특징이나 공략 포인트를 소개해 주세요"
              className="w-full bg-[#111] border border-[#444] rounded px-3 py-2 text-white text-sm outline-none focus:border-blue-500 transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">길이</label>
              <select
                value={lengthType}
                onChange={(e) => setLengthType(e.target.value as MapLengthType)}
                className="w-full bg-[#111] border border-[#444] rounded px-2 py-2 text-white text-sm outline-none focus:border-blue-500 transition-colors"
              >
                {LENGTH_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">장애물 정도</label>
              <select
                value={complexity}
                onChange={(e) => setComplexity(e.target.value as MapComplexity)}
                className="w-full bg-[#111] border border-[#444] rounded px-2 py-2 text-white text-sm outline-none focus:border-blue-500 transition-colors"
              >
                {COMPLEXITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {showSlotGauge && (
            <div className="flex items-center gap-2 text-xs">
              <span className={slotFull ? 'text-red-400' : 'text-gray-400'}>
                맵 슬롯 {slotUsed}/{USER_MAP_SLOT_LIMIT}
              </span>
              <div className="flex-1 h-1.5 bg-[#252525] rounded overflow-hidden">
                <div
                  className={`h-full transition-all ${slotFull ? 'bg-red-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(100, (slotUsed! / USER_MAP_SLOT_LIMIT) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {isPublished && (
            <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>배포된 맵입니다. 저장하면 스토어에 노출되는 내용도 즉시 갱신됩니다. (이미 다운로드한 유저는 영향 없음)</span>
            </div>
          )}
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
            onClick={() => onSubmit({ name: trimmedName, description: description.trim(), lengthType, complexity }, target)}
            disabled={isSaving || !trimmedName}
            className="flex items-center gap-2 px-4 py-2 rounded text-sm text-black font-semibold bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-[0_0_15px_rgba(59,130,246,0.3)]"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? '저장 중' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
