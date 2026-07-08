'use client' // Error components must be Client Components

import { useEffect } from 'react'
import { Terminal, AlertTriangle, RefreshCw } from 'lucide-react'
import Link from 'next/link'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('[Admin Panel Error]:', error)
  }, [error])

  return (
    <div className="h-full w-full flex items-center justify-center font-rajdhani p-10">
      <div className="max-w-2xl w-full glass-panel border border-red-900/50 rounded-sm overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-red-500 shadow-[0_0_10px_#ef4444]"></div>
        
        <div className="p-6 border-b border-red-900/30 bg-black/40 flex items-center">
          <Terminal className="w-5 h-5 text-red-500 mr-3" />
          <h2 className="text-lg font-bold tracking-widest text-red-400 font-orbitron uppercase">
            System Failure Detected
          </h2>
        </div>
        
        <div className="p-8">
          <div className="flex items-start mb-6">
            <AlertTriangle className="w-8 h-8 text-yellow-500 mr-4 shrink-0 mt-1" />
            <div>
              <p className="text-xl font-bold text-slate-200 mb-2 uppercase tracking-wide">
                Critical Exception in Admin Module
              </p>
              <div className="bg-black/50 border border-red-900/30 rounded-sm p-4 text-red-300 font-mono text-sm overflow-x-auto">
                <code>{error.message || 'Unknown catastrophic error occurred.'}</code>
              </div>
            </div>
          </div>
          
          <p className="text-slate-400 text-sm mb-8 tracking-wide">
            The nexus command interface encountered an unrecoverable state. Please attempt to re-initialize the module or return to the main lobby.
          </p>
          
          <div className="flex space-x-4">
            <button
              onClick={() => reset()}
              className="px-6 py-3 bg-red-900/20 hover:bg-red-900/40 border border-red-500/50 text-red-400 font-bold uppercase tracking-widest text-sm transition-all rounded-sm flex items-center"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Re-initialize Module
            </button>
            <Link href="/">
              <button className="px-6 py-3 bg-black border border-slate-700 hover:border-slate-500 text-slate-300 font-bold uppercase tracking-widest text-sm transition-all rounded-sm">
                Return to Lobby
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
