'use client'

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useEditorStore } from '@/store/editorStore';

interface HistoryLog {
  id: string;
  action_type: string;
  action_details: any;
  created_at: string;
}

export default function HistoryViewer() {
  const [logs, setLogs] = useState<HistoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { tabs, activeTabId } = useEditorStore();
  const currentTab = tabs.find(t => t.id === activeTabId);
  const mapId = currentTab?.mapId;

  useEffect(() => {
    toast.success("작업 내역을 불러왔습니다.", { duration: 3000, position: 'bottom-right' });
    
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
      .order('created_at', { ascending: false })
      .limit(50);
      
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

  const formatAction = (action: string, details: any) => {
    switch (action) {
      case 'ADD_ITEM': return `기물 추가 (${details?.type || '알 수 없음'})`;
      case 'REMOVE_ITEM': return `기물 삭제`;
      case 'UPDATE_ITEM': return `기물 속성 변경`;
      case 'SAVE_MAP': return `맵 저장`;
      case 'UNDO': return `실행 취소`;
      case 'REDO': return `다시 실행`;
      default: return action;
    }
  }

  return (
    <div className="w-full h-full bg-[#111] p-8 text-white overflow-y-auto pt-20">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold mb-6 text-purple-400">작업 내역 (타임라인)</h2>
        
        {!mapId && (
          <div className="text-gray-500 bg-[#1a1a1a] p-4 rounded-lg border border-[#333]">
            저장되지 않은 새 맵이므로 기록된 작업 내역이 없습니다. 맵을 먼저 저장해주세요.
          </div>
        )}
        
        {loading && mapId && (
          <div className="text-gray-400 animate-pulse">로딩중...</div>
        )}
        
        {!loading && mapId && logs.length === 0 && (
          <div className="text-gray-500 bg-[#1a1a1a] p-4 rounded-lg border border-[#333]">
            이 맵에 기록된 작업 내역이 없습니다. (Supabase 마이그레이션이 적용되지 않았거나 기록이 없습니다)
          </div>
        )}

        <div className="relative border-l border-[#333] ml-4 mt-8">
          {logs.map((log) => (
            <div key={log.id} className="mb-8 ml-6 group">
              <span className="absolute flex items-center justify-center w-6 h-6 bg-[#222] rounded-full -left-3 ring-4 ring-[#111] border border-purple-500/50 group-hover:border-purple-400 transition-colors">
                <div className="w-2 h-2 bg-purple-500 rounded-full group-hover:scale-125 transition-transform" />
              </span>
              <h3 className="flex items-center mb-1 text-lg font-semibold text-gray-200">
                {formatAction(log.action_type, log.action_details)}
              </h3>
              <time className="block mb-2 text-sm font-normal leading-none text-gray-500">
                {formatTime(log.created_at)}
              </time>
              <div className="text-sm text-gray-400 bg-[#1a1a1a] p-3 rounded-lg border border-[#222] overflow-x-auto">
                <pre className="whitespace-pre-wrap font-mono text-xs text-gray-500">
                  {JSON.stringify(log.action_details, null, 2)}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
