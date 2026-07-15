import React, { useEffect, useRef, useState } from 'react';
import { Store, X, Loader2, CheckCircle2, XCircle, Coins, FlaskConical } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { runValidationAsync } from '@/lib/editor/validationClient';
import type { ValidationResult } from '@/lib/editor/validationTypes';
import { publishUserMapAction } from '@/presentation/actions/userMapActions';
import { MAP_DOWNLOAD_COST } from '@/core/entities/UserMap';
import { stampService } from '@/lib/stampService';
import { toast } from 'sonner';

/** 배포 검증에 사용할 레이스 수 — PublishUserMapUseCase 의 최소 요구치와 일치 */
const PUBLISH_VALIDATION_RACES = 8;

type PublishStep = 'confirm' | 'validating' | 'publishing' | 'failed';

interface PublishMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 저장된 user_maps 의 id (저장 전이면 열리지 않아야 함) */
  mapId: string;
  mapName: string;
  isRepublish: boolean;
  onPublished: () => void | Promise<void>;
}

export default function PublishMapModal({
  isOpen,
  onClose,
  mapId,
  mapName,
  isRepublish,
  onPublished,
}: PublishMapModalProps) {
  const [step, setStep] = useState<PublishStep>('confirm');
  const [progress, setProgress] = useState(0);
  const [progressRace, setProgressRace] = useState<[number, number]>([0, PUBLISH_VALIDATION_RACES]);
  const [failedChecks, setFailedChecks] = useState<{ label: string; value: string; target: string }[]>([]);
  const [failMessage, setFailMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** 미통과여도 강제 배포할 수 있도록 마지막 검증 결과 보관 */
  const lastResultRef = useRef<ValidationResult | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep('confirm');
      setProgress(0);
      setFailedChecks([]);
      setFailMessage(null);
      lastResultRef.current = null;
    }
    return () => abortRef.current?.abort();
  }, [isOpen]);

  if (!isOpen) return null;

  const runPublish = async () => {
    const st = useEditorStore.getState();
    const gimmicks = st.items.filter((it) => it.type !== 'startline' && it.type !== 'endline');
    if (gimmicks.length === 0) {
      setFailMessage('배치된 기물이 없습니다. 맵을 구성한 뒤 배포해 주세요.');
      setStep('failed');
      return;
    }

    // 1) 헤드리스 시뮬 검증 (ValidationPanel 과 동일 경로)
    setStep('validating');
    setProgress(0);
    setProgressRace([0, PUBLISH_VALIDATION_RACES]);
    const ac = new AbortController();
    abortRef.current = ac;

    let result: ValidationResult;
    try {
      result = await runValidationAsync(
        {
          items: st.items,
          worldHeight: st.worldHeight,
          wallStyle: st.wallStyle,
          layoutConfig: st.layoutConfig,
          races: PUBLISH_VALIDATION_RACES,
          chips: st.previewChipCount,
        },
        {
          signal: ac.signal,
          onProgress: (pct, race, total) => {
            setProgress(pct);
            setProgressRace([race, total]);
          },
        }
      );
    } catch (e: any) {
      if (e?.name === 'AbortError') return; // 사용자 취소
      setFailMessage('검증 실행 중 오류: ' + (e?.message || e));
      setStep('failed');
      return;
    } finally {
      abortRef.current = null;
    }

    lastResultRef.current = result;
    const failed = result.checks.filter((c) => !c.ok);
    if (failed.length > 0) {
      // 미통과여도 배포는 가능 — 결과를 보여주고 사용자가 강제 배포를 선택할 수 있게 한다.
      setFailedChecks(failed.map((c) => ({ label: c.label, value: c.value, target: c.target })));
      setFailMessage(null);
      setStep('failed');
      return;
    }

    await publishNow(result);
  };

  // 2) 서버 배포 (검증 통과 직후 또는 미통과 강제 배포)
  const publishNow = async (result: ValidationResult) => {
    setStep('publishing');
    const res = await publishUserMapAction(mapId, result);
    if (res.success) {
      toast.success(isRepublish ? '스토어에 업데이트 배포되었습니다!' : '커스텀 맵 스토어에 배포되었습니다!');
      stampService.trackEvent('publish_map', 1);
      stampService.flushPlayEvents();
      await onPublished();
      onClose();
    } else {
      setFailMessage(res.error);
      setStep('failed');
    }
  };

  const cancelValidation = () => {
    abortRef.current?.abort();
    setStep('confirm');
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-[#1a1a1a] border border-[#333] rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#333] bg-[#222]">
          <div className="flex items-center gap-2 text-emerald-400">
            <Store className="w-5 h-5" />
            <h3 className="font-semibold text-lg">{isRepublish ? '업데이트 배포' : '맵 스토어에 배포'}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 text-gray-300">
          {step === 'confirm' && (
            <>
              <p className="text-sm">
                <strong className="text-white">'{mapName}'</strong> 맵을 커스텀 맵 스토어에 {isRepublish ? '다시 ' : ''}배포합니다.
                배포 전에 헤드리스 시뮬레이션 검증({PUBLISH_VALIDATION_RACES}회)이 실행되며, 미통과 항목이 있어도 확인 후 배포할 수 있습니다.
              </p>
              <div className="flex items-start gap-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded px-3 py-2.5">
                <Coins className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  배포된 맵을 다른 유저가 다운로드하면 <strong>1회당 {MAP_DOWNLOAD_COST}칩이 지급</strong>됩니다.
                  (다운로더가 {MAP_DOWNLOAD_COST}칩을 지불하며 전액 제작자에게 이전 · 유저당 최초 1회 · 본인 다운로드 제외)
                </span>
              </div>
              {isRepublish && (
                <p className="text-xs text-gray-500">
                  이미 다운로드한 유저는 이전 버전 스냅샷을 유지하며, 새로 다운로드하는 유저부터 이번 버전을 받습니다.
                </p>
              )}
            </>
          )}

          {step === 'validating' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-[#00ffcc]">
                <FlaskConical className="w-4 h-4" /> 맵 검증 중…
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-[#252525] rounded overflow-hidden">
                  <div
                    className="h-full bg-[#00ffcc] transition-[width] duration-150"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
                <button
                  onClick={cancelValidation}
                  className="text-[10px] text-red-400 hover:text-red-300 font-bold px-2 py-0.5 border border-red-400/40 rounded"
                >
                  취소
                </button>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-gray-400">
                <Loader2 className="w-3 h-3 animate-spin" /> 레이스 {progressRace[0]}/{progressRace[1]} · {Math.round(progress * 100)}%
              </div>
            </div>
          )}

          {step === 'publishing' && (
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <Loader2 className="w-4 h-4 animate-spin" /> 검증 통과! 스토어에 배포 중…
            </div>
          )}

          {step === 'failed' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-400">
                <XCircle className="w-4 h-4" />
                {failedChecks.length > 0 ? '검증 미통과 항목이 있습니다' : '배포에 실패했습니다'}
              </div>
              {failMessage && <p className="text-xs text-red-300">{failMessage}</p>}
              {failedChecks.length > 0 && (
                <div className="space-y-1 bg-[#111] border border-[#333] rounded p-3">
                  {failedChecks.map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">{c.label}</span>
                      <span className="font-mono text-amber-400">
                        ✗ {c.value} <span className="text-gray-600">({c.target})</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {failedChecks.length > 0 && (
                <p className="text-[11px] text-gray-500">
                  미통과 항목이 있어도 그대로 배포할 수 있습니다. 맵 검증 패널의 히트맵과 지표 툴팁을 참고해
                  개선한 뒤 다시 검증하는 것을 권장합니다.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#111] border-t border-[#333] flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded text-sm text-gray-400 hover:text-white hover:bg-[#333] transition-colors"
          >
            닫기
          </button>
          {step === 'failed' && failedChecks.length > 0 && lastResultRef.current && (
            <button
              onClick={() => publishNow(lastResultRef.current!)}
              className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold text-black bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 transition-colors"
            >
              <Store className="w-4 h-4" /> 그래도 배포
            </button>
          )}
          {(step === 'confirm' || step === 'failed') && (
            <button
              onClick={runPublish}
              className="flex items-center gap-2 px-4 py-2 rounded text-sm text-black font-semibold bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)]"
            >
              {step === 'failed' ? (
                <>다시 검증 후 배포</>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> 검증 후 배포
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
