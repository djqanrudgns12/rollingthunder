'use client'

import { useState, useEffect } from 'react'
import { X, Trash2, Save, Download, CloudUpload } from 'lucide-react'
import { toast } from 'sonner'
import { Participant } from '@/store/gameStore'
import { useUIStore } from '@/store/uiStore'
import { createClient } from '@/lib/supabase/client'

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
  const [localLists, setLocalLists] = useState<SavedList[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const { isLoggedIn } = useUIStore()
  const supabase = createClient()

  useEffect(() => {
    if (isOpen) {
      loadLists()
    }
  }, [isOpen, isLoggedIn])

  const loadLists = async () => {
    setIsLoading(true)
    // 1. 로컬 데이터는 항상 읽어둠 (병합 기능을 위해)
    let localData: SavedList[] = []
    try {
      const data = localStorage.getItem('rt-saved-lists-v2')
      if (data) {
        localData = JSON.parse(data)
        setLocalLists(localData)
      }
    } catch (e) {
      console.error('Failed to parse saved lists', e)
    }

    if (isLoggedIn) {
      // 2. 서버 데이터 우선 로드
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        if (sessionData.session?.user?.id) {
          const { data, error } = await supabase
            .from('participant_lists')
            .select('*')
            .eq('user_id', sessionData.session.user.id)
            .order('created_at', { ascending: false })
          
          if (!error && data) {
            const mappedLists: SavedList[] = data.map((row: any) => ({
              id: row.id,
              title: row.title,
              names: Array.isArray(row.participants) ? row.participants.map((p: any) => p.name).join(', ') : '',
              createdAt: new Date(row.created_at).getTime()
            }))
            setSavedLists(mappedLists)
          }
        }
      } catch (err) {
        console.error('Failed to load from server', err)
      }
    } else {
      // 3. 비로그인 시 로컬 데이터를 메인으로 사용
      setSavedLists(localData)
    }
    setIsLoading(false)
  }

  const handleSaveCurrent = async () => {
    if (currentParticipants.length === 0) {
      toast.error('저장할 참가자가 없습니다.')
      return
    }
    const finalTitle = newTitle.trim() || `명단 ${new Date().toLocaleDateString()}`
    const names = currentParticipants.map(p => p.name).join(', ')
    
    if (isLoggedIn) {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        if (!sessionData.session?.user?.id) throw new Error('Not authenticated')
        
        const { data, error } = await supabase.from('participant_lists').insert({
          user_id: sessionData.session.user.id,
          title: finalTitle,
          participants: currentParticipants
        }).select().single()

        if (error) throw error
        toast.success('서버에 명단이 저장되었습니다.')
        loadLists()
      } catch (error) {
        console.error('Save to server error', error)
        toast.error('서버 저장에 실패했습니다.')
      }
    } else {
      const newList: SavedList = {
        id: crypto.randomUUID(),
        title: finalTitle,
        names,
        createdAt: Date.now()
      }
      const updated = [...savedLists, newList]
      localStorage.setItem('rt-saved-lists-v2', JSON.stringify(updated))
      setSavedLists(updated)
      setLocalLists(updated)
      toast.success('로컬에 명단이 저장되었습니다.')
    }
    setNewTitle('')
  }

  const handleDelete = async (id: string) => {
    if (window.confirm('정말 이 명단을 삭제하시겠습니까?')) {
      if (isLoggedIn) {
        try {
          const { error } = await supabase.from('participant_lists').delete().eq('id', id)
          if (error) throw error
          toast.success('서버에서 명단이 삭제되었습니다.')
          loadLists()
        } catch (error) {
          console.error(error)
          toast.error('삭제 실패')
        }
      } else {
        const updated = savedLists.filter(list => list.id !== id)
        localStorage.setItem('rt-saved-lists-v2', JSON.stringify(updated))
        setSavedLists(updated)
        setLocalLists(updated)
        toast.success('명단이 삭제되었습니다.')
      }
    }
  }

  const handleMigrateLocalToServer = async () => {
    if (!isLoggedIn || localLists.length === 0) return
    if (!window.confirm('로컬에 있는 모든 명단을 서버로 복사하시겠습니까?\n(로컬 데이터는 안전하게 보존됩니다)')) return

    try {
      setIsLoading(true)
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session?.user?.id) return

      const inserts = localLists.map(local => {
        const parts = local.names.split(',').map(n => n.trim()).filter(n => n)
        return {
          user_id: sessionData.session.user.id,
          title: local.title,
          participants: parts.map(name => ({ name, color: '#FFFFFF', id: crypto.randomUUID() }))
        }
      })

      const { error } = await supabase.from('participant_lists').insert(inserts)
      if (error) throw error
      
      toast.success('로컬 명단이 서버로 복사되었습니다!')
      loadLists()
    } catch (e) {
      console.error(e)
      toast.error('로컬 명단 복사에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLoad = (names: string) => {
    onLoadList(names)
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
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white/70">
                {isLoggedIn ? '서버에 저장된 명단' : '저장된 명단 (로컬)'}
                {isLoading && <span className="ml-2 text-xs font-normal text-white/40">불러오는 중...</span>}
              </h3>
              {isLoggedIn && localLists.length > 0 && (
                <button
                  onClick={handleMigrateLocalToServer}
                  disabled={isLoading}
                  className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-xs text-white/70 hover:text-white transition-colors"
                >
                  <CloudUpload className="w-3 h-3" />
                  로컬 병합
                </button>
              )}
            </div>
            
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
