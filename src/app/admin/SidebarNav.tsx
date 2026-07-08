'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, Map as MapIcon, Activity } from 'lucide-react'

export default function SidebarNav() {
  const pathname = usePathname()

  const links = [
    { href: '/admin', label: '유저 관리 (USER DIRECTORY)', icon: Users, exact: true },
    { href: '/admin/maps', label: '맵 관리 (TOPOLOGY)', icon: MapIcon, exact: false },
    { href: '/admin/economy', label: '경제 로그 (ECONOMY)', icon: Activity, exact: false },
  ]

  return (
    <nav className="p-6 space-y-4">
      <div className="text-xs text-cyan-700 tracking-[0.2em] font-bold mb-2">시스템 모듈</div>
      {links.map((link) => {
        const isActive = link.exact ? pathname === link.href : pathname.startsWith(link.href)
        
        return (
          <Link 
            key={link.href} 
            href={link.href} 
            className={`group flex items-center px-4 py-3 rounded relative overflow-hidden transition-all duration-300 ${
              isActive 
                ? 'bg-cyan-900/40 text-cyan-300 border border-cyan-500/50' 
                : 'text-slate-400 hover:text-cyan-200 hover:bg-cyan-900/20 border border-transparent'
            }`}
          >
            {isActive && <div className="absolute left-0 top-0 h-full w-1 bg-cyan-400 shadow-[0_0_10px_#0ff]"></div>}
            <link.icon className={`w-5 h-5 mr-4 transition-all ${isActive ? 'opacity-100 text-cyan-400' : 'opacity-60 group-hover:opacity-100 group-hover:text-cyan-400'}`} />
            <span className={`font-semibold tracking-wide text-sm ${isActive ? 'text-cyan-100' : ''}`}>{link.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
