'use client';
import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';

// AudioEngine을 정적 임포트하지 않는다: 모듈 로드 시점에 싱글턴이 생성되어
// howler + SFX 8종 프리로드가 초기 번들·첫 페인트 경로에 끌려 들어오기 때문.
// 마운트 후 동적 임포트로 초기화하고(코드베이스의 기존 import('@/engine/AudioEngine') 패턴과 동일),
// 그 전에 도착한 상호작용은 다음 제스처에서 Howler autoUnlock이 자체 복구한다.
type SoundManagerLike = {
  setVolumes: (master: number, bgm: number, sfx: number) => void;
  unlockAudio: () => void;
};

export default function GlobalAudioUnlocker({ children }: { children: React.ReactNode }) {
  const { bgmVolume, sfxVolume } = useGameStore();
  const smRef = useRef<SoundManagerLike | null>(null);

  // 스토어의 볼륨 설정(0~100)을 오디오 엔진에 0.0~1.0 배율(Scale)로 동기화
  useEffect(() => {
    let cancelled = false;
    import('@/engine/AudioEngine').then(({ soundManager }) => {
      if (cancelled) return;
      smRef.current = soundManager;
      soundManager.setVolumes(1.0, bgmVolume / 100, sfxVolume / 100);
    });
    return () => { cancelled = true; };
  }, [bgmVolume, sfxVolume]);

  useEffect(() => {
    const handleFirstInteraction = () => {
      // 사용자의 첫 번째 상호작용 시 오디오 엔진 잠금 해제 강제 호출
      if (smRef.current) {
        smRef.current.unlockAudio();
      } else {
        import('@/engine/AudioEngine').then(({ soundManager }) => soundManager.unlockAudio());
      }

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
