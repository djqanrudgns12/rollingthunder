'use client'

import { useState, useEffect } from 'react'
import { X, Trash2, Save, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Participant } from '@/store/gameStore'

interface ListManagerModalProps {
  isOpen: boolean
  onClose: () => void
  currentParticipants: Participant[]
  onLoadList: (names: string) => void
}

export interface SavedList {
  id: string
  title: string
  names: string
  createdAt: number
}

export default function ListManagerModal({ isOpen, onClose, currentParticipants, onLoadList }: ListManagerModalProps) {
  const [savedLists, setSavedLists] = useState<SavedList[]>([])
  const [newTitle, setNewTitle] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadFromStorage()
    }
  }, [isOpen])

  const loadFromStorage = () => {
    try {
      const data = localStorage.getItem('rt-saved-lists-v2')
      if (data) {
        setSavedLists(JSON.parse(data))
      }
    } catch (e) {
      console.error('Failed to parse saved lists', e)
    }
  }

  const saveToStorage = (lists: SavedList[]) => {
    localStorage.setItem('rt-saved-lists-v2', JSON.stringify(lists))
    setSavedLists(lists)
  }

  const handleSaveCurrent = () => {
    if (currentParticipants.length === 0) {
      toast.error('저장할 참가자가 없습니다.')
      return
    }
    const finalTitle = newTitle.trim() || `명단 ${new Date().toLocaleDateString()}`
    const names = currentParticipants.map(p => p.name).join(', ')
    
    const newList: SavedList = {
      id: crypto.randomUUID(),
      title: finalTitle,
      names,
      createdAt: Date.now()
    }
    
    saveToStorage([...savedLists, newList])
    setNewTitle('')
    toast.success('현재 참가자 명단이 저장되었습니다.')
  }

  const handleDelete = (id: string) => {
    if (window.confirm('정말 이 명단을 삭제하시겠습니까?')) {
      saveToStorage(savedLists.filter(list => list.id !== id))
      toast.success('명단이 삭제되었습니다.')
    }
  }

  const handleLoad = (names: string) => {
    onLoadList(names)
    // Removed the toast here because we can handle it inside Dashboard if needed, or leave it. 
    // Leaving it is fine.
    toast.success('명단을 불러왔습니다. 추가 버튼을 눌러주세요.')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg shadow-[0_0_50px_rgba(0,0,0,1)] flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            명단 관리
          </h2>
          <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
          
          {/* Save Current List */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-3">
            <h3 className="text-sm font-bold text-white/70">현재 명단 저장하기</h3>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="저장할 명단 이름 (예: A팀)" 
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveCurrent()
                  }
                }}
                className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[var(--accent-primary)] transition-colors text-sm"
              />
              <button 
                onClick={handleSaveCurrent}
                className="bg-[var(--accent-primary)] text-black font-bold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1 text-sm shrink-0"
              >
                <Save className="w-4 h-4" />
                저장
              </button>
            </div>
            <p className="text-xs text-white/40">
              현재 등록된 참가자 {currentParticipants.length}명이 저장됩니다.
            </p>
          </div>

          {/* Saved Lists */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-bold text-white/70">저장된 명단</h3>
            
            {savedLists.length === 0 ? (
              <div className="text-center py-8 text-white/30 text-sm bg-black/30 rounded-xl border border-white/5">
                저장된 명단이 없습니다.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {savedLists.sort((a, b) => b.createdAt - a.createdAt).map(list => (
                  <div key={list.id} className="bg-black/50 border border-white/5 rounded-xl p-3 flex items-center justify-between group hover:border-[var(--accent-secondary)] transition-colors">
                    <div className="flex flex-col overflow-hidden mr-4">
                      <span className="text-white font-bold text-sm truncate">{list.title}</span>
                      <span className="text-white/40 text-xs truncate mt-0.5">{list.names}</span>
                    </div>
                    
                    <div className="flex gap-1 shrink-0">
                      <button 
                        onClick={() => handleLoad(list.names)}
                        className="p-2 bg-white/5 hover:bg-[var(--accent-secondary)] hover:text-black text-white/70 rounded-lg transition-colors flex items-center gap-1"
                        title="불러오기"
                      >
                        <Download className="w-4 h-4" />
                        <span className="text-[10px] font-bold hidden sm:inline">호출</span>
                      </button>
                      <button 
                        onClick={() => handleDelete(list.id)}
                        className="p-2 bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-white/70 rounded-lg transition-colors"
                        title="삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
