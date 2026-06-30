'use client'

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useEditorStore } from '@/store/editorStore';
import { useGameStore } from '@/store/gameStore';
import { X, Clock } from 'lucide-react';

interface HistoryLog {
  id: string;
  action_type: string;
  action_details: any;
  created_at: string;
}

interface HistoryTimelineModalProps {
  mapId: string | null;
  mapTitle: string;
  onClose: () => void;
}

import FloatingPanel from './FloatingPanel';

export default function HistoryTimelinePanel({ mapId, mapTitle, onClose }: HistoryTimelineModalProps) {
  const [logs, setLogs] = useState<HistoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { addTab } = useEditorStore();
  const { mapDataCache, setMapDataCache } = useGameStore();

  useEffect(() => {
    if (mapId) {
      fetchLogs();
    } else {
      setLoading(false);
    }
  }, [mapId]);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('map_edit_history')
      .select('*')
      .eq('map_id', mapId)
      .eq('action_type', 'SAVE_MAP') // 저장 기록만 표시
      .order('created_at', { ascending: false })
      .limit(30);
      
    if (error) {
      if (error.code === '42P01') {
        // relation does not exist yet (migration not applied)
        setLogs([]);
      } else {
        toast.error('작업 내역을 불러오는데 실패했습니다: ' + error.message);
      }
    } else {
      setLogs(data || []);
    }
    setLoading(false);
  }

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
  }

  const handleRestoreSnapshot = (log: HistoryLog) => {
    if (!log.action_details?.snapshot) {
      toast.error('이 저장 기록에는 맵 스냅샷 데이터가 포함되어 있지 않습니다. (과거 버전)');
      return;
    }

    const snapshot = log.action_details.snapshot;
    
    // 타임스탬프로 임시 ID 생성
    const d = new Date(log.created_at);
    const timeString = `${d.getFullYear()}${(d.getMonth()+1).toString().padStart(2,'0')}${d.getDate().toString().padStart(2,'0')}_${d.getHours().toString().padStart(2,'0')}${d.getMinutes().toString().padStart(2,'0')}`;
    const tempMapId = `${mapId}_history_${timeString}`;
    const newTitle = `[과거 복원] ${mapTitle} - ${timeString}`;

    // 캐시에 스냅샷 데이터 임시 저장
    setMapDataCache({
      ...(mapDataCache || {}),
      [tempMapId]: {
        name: newTitle,
        items: snapshot.items || [],
        worldHeight: snapshot.worldHeight || 3300,
        layoutConfig: snapshot.layoutConfig || { startLineY: 100, endMarginPercent: 0.02, spawnGap: 50 },
        wallStyle: snapshot.wallStyle || 'straight',
        bgImage: snapshot.bgImage || null,
        isOfficial: false,
        description: '과거 작업 내역에서 복원된 맵입니다.',
        lengthType: 'medium',
        complexity: 3
      }
    });

    // 새 탭으로 열기
    addTab(tempMapId, 'map', newTitle);
    toast.success('과거 저장 시점을 새 탭으로 불러왔습니다.');
    onClose();
  }

  return (
    <FloatingPanel 
      title="작업 내역 타임라인" 
      icon={<Clock className="w-4 h-4" />} 
      onClose={onClose}
      width="w-[400px]"
      style={{ top: '80px', left: '20px' }}
      panelId="history"
    >
      <div className="p-6 bg-[#111] border-t border-white/10">
          <div className="mb-6">
            <div className="text-sm text-gray-400">현재 맵</div>
            <div className="text-lg font-bold text-gray-200">{mapTitle || '새 맵'}</div>
          </div>
          
          {!mapId && (
            <div className="text-gray-500 bg-[#1a1a1a] p-4 rounded-lg border border-[#333] text-center">
              저장되지 않은 새 맵이므로 기록된 작업 내역이 없습니다.
            </div>
          )}
          
          {loading && mapId && (
            <div className="flex justify-center items-center py-10">
              <div className="text-purple-400 animate-pulse font-bold tracking-wider">LOADING HISTORY...</div>
            </div>
          )}
          
          {!loading && mapId && logs.length === 0 && (
            <div className="text-gray-500 bg-[#1a1a1a] p-4 rounded-lg border border-[#333] text-center">
              이 맵에 기록된 저장 내역이 없습니다.
            </div>
          )}

          <div className="relative border-l border-[#333] ml-4 mt-4">
            {logs.map((log) => {
              const hasSnapshot = !!log.action_details?.snapshot;
              const itemCount = log.action_details?.itemsCount || 0;
              
              return (
                <div key={log.id} className="mb-8 ml-6 relative group">
                  <span className="absolute flex items-center justify-center w-6 h-6 bg-[#222] rounded-full -left-9 ring-4 ring-[#111] border border-purple-500/50 group-hover:border-purple-400 transition-colors">
                    <div className="w-2 h-2 bg-purple-500 rounded-full group-hover:scale-125 transition-transform" />
                  </span>
                  
                  <div className="flex flex-col gap-1">
                    <time className="block text-sm font-bold text-gray-300">
                      {formatTime(log.created_at)}
                    </time>
                    <div className="text-sm text-gray-500">
                      맵 저장 (기물: {itemCount}개)
                    </div>
                    
                    <button 
                      onClick={() => handleRestoreSnapshot(log)}
                      disabled={!hasSnapshot}
                      className={`mt-2 py-2 px-4 rounded text-sm font-bold transition-all border ${
                        hasSnapshot 
                          ? 'bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20' 
                          : 'bg-[#222] text-gray-500 border-[#333] cursor-not-allowed'
                      }`}
                    >
                      {hasSnapshot ? '스냅샷 새 탭으로 불러오기' : '스냅샷 데이터 없음 (과거 기록)'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
      </div>
    </FloatingPanel>
  );
}
