'use client';
import { useEffect } from 'react';
import { soundManager } from '@/engine/AudioEngine';

export default function GlobalAudioUnlocker({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handleFirstInteraction = () => {
      // 사용자의 첫 번째 상호작용 시 오디오 엔진 잠금 해제 강제 호출
      soundManager.unlockAudio();
      
      // 한 번 해제되면 리스너 제거
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };

    window.addEventListener('click', handleFirstInteraction, { once: true });
    window.addEventListener('touchstart', handleFirstInteraction, { once: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true });

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, []);

  return <>{children}</>;
}
