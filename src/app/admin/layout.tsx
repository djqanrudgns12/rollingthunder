import { Orbitron, Noto_Sans_KR } from 'next/font/google'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LogOut, Terminal } from 'lucide-react'
import SidebarNav from './SidebarNav'

const orbitron = Orbitron({ subsets: ['latin'], variable: '--font-orbitron' })
const notoSans = Noto_Sans_KR({ subsets: ['latin'], weight: ['400', '500', '700', '900'], variable: '--font-noto' })

export const metadata = {
  title: 'Rolling Thunder - Nexus Admin',
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // 1. 관리자 권한 확인 (서버 레벨)
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    redirect('/')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/')
  }

  // 2. 관리자 렌더링
  return (
    <div className={`h-screen w-full flex overflow-hidden bg-[#050505] text-slate-200 ${orbitron.variable} ${notoSans.variable} font-sans`}
      style={{
        backgroundImage: `linear-gradient(rgba(0, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 255, 0.03) 1px, transparent 1px)`,
        backgroundSize: '30px 30px'
      }}
    >
      <style dangerouslySetInnerHTML={{__html: `
        :root {
          --neon-cyan: #0ff;
          --neon-purple: #b026ff;
        }
        .font-orbitron { font-family: var(--font-orbitron), sans-serif; }
        .font-noto { font-family: var(--font-noto), sans-serif; }
        .text-glow { text-shadow: 0 0 10px var(--neon-cyan), 0 0 20px var(--neon-cyan); }
        .glass-panel { 
            background: rgba(10, 14, 23, 0.7); 
            backdrop-filter: blur(16px); 
            border: 1px solid rgba(0, 255, 255, 0.1); 
            box-shadow: inset 0 0 20px rgba(0, 255, 255, 0.02), 0 4px 30px rgba(0,0,0,0.5);
        }
        .cyber-button {
            position: relative; overflow: hidden;
            background: linear-gradient(90deg, rgba(0, 255, 255, 0.1), rgba(176, 38, 255, 0.1));
            border: 1px solid var(--neon-cyan); color: var(--neon-cyan);
            transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 2px;
        }
        .cyber-button:hover {
            background: rgba(0, 255, 255, 0.2); box-shadow: 0 0 15px rgba(0, 255, 255, 0.5);
            text-shadow: 0 0 5px var(--neon-cyan);
        }
        .cyber-input {
            background: rgba(0,0,0,0.5); border: 1px solid rgba(0, 255, 255, 0.3);
            color: var(--neon-cyan); font-family: var(--font-orbitron), monospace;
            transition: all 0.3s;
        }
        .cyber-input:focus {
            outline: none; border-color: var(--neon-cyan); box-shadow: 0 0 10px rgba(0, 255, 255, 0.3);
        }
        .scanlines::before {
            content: " "; display: block; position: absolute; top: 0; left: 0; bottom: 0; right: 0;
            background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
            z-index: 50; background-size: 100% 2px, 3px 100%; pointer-events: none; opacity: 0.3;
        }
        .data-row { transition: all 0.2s ease; border-bottom: 1px solid rgba(0,255,255,0.05); }
        .data-row:hover { background: rgba(0, 255, 255, 0.05); border-left: 2px solid var(--neon-cyan); transform: translateX(2px); }
      `}} />

      {/* Sidebar */}
      <aside className="w-72 glass-panel flex flex-col justify-between relative z-10 scanlines">
        <div className="absolute top-0 right-0 w-1 h-full bg-gradient-to-b from-cyan-500/0 via-cyan-500/50 to-purple-500/0"></div>
        <div>
          <div className="h-20 flex flex-col justify-center px-8 border-b border-cyan-900/50 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-50"></div>
            <span className="text-2xl font-black text-white tracking-widest font-orbitron">R-THUNDER</span>
            <span className="text-xs text-cyan-400 tracking-[0.3em] uppercase mt-1 text-glow">Nexus Command</span>
          </div>
          
          <SidebarNav />
        </div>
        
        <div className="p-6">
          <div className="mb-4 text-[10px] text-slate-500 tracking-widest uppercase flex justify-between">
            <span>System Status</span>
            <span className="text-green-400 flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-green-400 mr-2 animate-pulse"></span>ONLINE</span>
          </div>
          <Link href="/">
            <button className="w-full py-3 cyber-button text-xs font-bold flex items-center justify-center rounded-sm">
              <LogOut className="w-4 h-4 mr-2" />
              로비로 돌아가기
            </button>
          </Link>
        </div>
      </aside>

      {/* Main Content Shell */}
      <main className="flex-1 flex flex-col relative z-0 scanlines">
        <header className="h-20 flex items-center justify-between px-10 border-b border-cyan-900/30 bg-black/40 backdrop-blur-sm z-10">
          <div className="flex items-center space-x-3">
            <Terminal className="w-5 h-5 text-cyan-400" />
            <h1 className="text-xl font-bold tracking-widest text-slate-200 font-orbitron">SYSTEM_OVERRIDE <span className="text-cyan-500 font-light">// ROOT</span></h1>
          </div>
          
          <div className="flex items-center pl-6 border-l border-cyan-900/50">
            <div className="text-right mr-3">
              <p className="text-xs text-cyan-500 tracking-wide font-bold">운영자</p>
              <p className="text-sm font-bold text-white">{session.user.email}</p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-10 font-noto text-lg">
          {children}
        </div>
      </main>
    </div>
  )
}
