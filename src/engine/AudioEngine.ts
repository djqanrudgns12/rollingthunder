import { Howl, Howler } from 'howler';

const MAX_POLYPHONY = 6;
const THROTTLE_MS = 150;

// 기존 ZzFX 이름들을 새로운 MP3 파일 경로로 매핑
const sfxPathMap: Record<string, string> = {
  gimmick_funnel: '/sounds/sfx/gmk_warp.mp3',
  gimmick_pipe: '/sounds/sfx/gmk_warp.mp3',
  gimmick_domino: '/sounds/sfx/gmk_bumper.mp3',
  spinner_whoosh: '/sounds/sfx/gmk_flipper.mp3', 
  env_wormhole: '/sounds/sfx/gmk_warp.mp3',
  warp: '/sounds/sfx/gmk_warp.mp3',
  ui_click: '/sounds/ui/ui_click.mp3',
  ui_nudge: '/sounds/sfx/gmk_flipper.mp3',
  ui_door_slam: '/sounds/sfx/gmk_ice_break.mp3',
  ui_fanfare: '/sounds/ui/sys_finish.mp3',
  sys_start: '/sounds/ui/sys_start.mp3',
  sys_finish: '/sounds/ui/sys_finish.mp3'
};

const BASE_BGM_VOL = 0.5;
const BASE_SFX_VOL = 0.3;

class AudioEngine {
  private static instance: AudioEngine;
  
  // BGMs
  private standbyBgm: Howl;
  private playgameBgm: Howl;
  private mapeditorBgm: Howl;
  private currentBgm: Howl | null = null;
  
  // SFX Cache
  private sfxCache: Record<string, Howl> = {};

  // Throttling state
  private lastPlayed: Record<string, number> = {};
  
  // Polyphony state
  private activeCount: number = 0;
  private isMuted: boolean = false;
  
  // Volumes
  private masterVol: number = 1.0;
  private bgmVol: number = BASE_BGM_VOL;
  private sfxVol: number = BASE_SFX_VOL;

  private constructor() {
    Howler.volume(this.masterVol);

    this.standbyBgm = new Howl({ src: ['/sounds/bgm/Standby.mp3'], loop: true, volume: this.bgmVol, preload: true, html5: true });
    this.playgameBgm = new Howl({ src: ['/sounds/bgm/Playgame.mp3'], loop: true, volume: this.bgmVol, preload: true, html5: true });
    this.mapeditorBgm = new Howl({ src: ['/sounds/bgm/Mapeditor.mp3'], loop: true, volume: this.bgmVol, preload: true, html5: true });

    // SFX 프리로딩
    const uniquePaths = Array.from(new Set(Object.values(sfxPathMap)));
    uniquePaths.push('/sounds/skills/skill_cast.mp3'); // 스킬 사운드 추가

    uniquePaths.forEach(path => {
      this.sfxCache[path] = new Howl({
        src: [path],
        preload: true,
        volume: this.sfxVol
      });
    });
  }

  // 브라우저 락 해제 보장
  unlockAudio() {
    // 1. 동기적으로 즉시 play() 호출 (비동기 then 안으로 들어가면 HTML5 오디오 제스처 토큰이 날아감)
    if (this.currentBgm && !this.currentBgm.playing()) {
      this.currentBgm.volume(this.bgmVol);
      this.currentBgm.play();
    }
    
    // 2. Web Audio API 컨텍스트 리줌 (효과음 등을 위해 필요)
    if (Howler.ctx && Howler.ctx.state === 'suspended') {
      Howler.ctx.resume().catch(() => {});
    }
  }

  static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  // --- BGM Methods ---
  playStandbyBgm() {
    this.crossfadeBgm(this.standbyBgm);
  }

  playGameBgm() {
    this.crossfadeBgm(this.playgameBgm);
  }

  playMapEditorBgm() {
    this.crossfadeBgm(this.mapeditorBgm);
  }

  private crossfadeBgm(nextBgm: Howl) {
    if (this.currentBgm === nextBgm) return;
    
    const prevBgm = this.currentBgm;
    this.currentBgm = nextBgm;
    const fadeDuration = 1500;

    if (prevBgm) {
      prevBgm.fade(prevBgm.volume(), 0, fadeDuration);
      const timeoutId = setTimeout(() => prevBgm.pause(), fadeDuration);
      (prevBgm as any)._bgmFadeTimeout = timeoutId;
    }
    
    // 이전에 예약된 정지 타이머가 있다면 취소 (빠르게 복귀한 경우 대비)
    if ((nextBgm as any)._bgmFadeTimeout) {
      clearTimeout((nextBgm as any)._bgmFadeTimeout);
      (nextBgm as any)._bgmFadeTimeout = undefined;
    }
    
    if (Howler.ctx && Howler.ctx.state === 'suspended') {
      nextBgm.volume(this.bgmVol);
      // 브라우저 락 상태일 때는 play()를 호출하지 않고 대기합니다.
      // 이후 유저가 클릭하면 unlockAudio()에서 play()를 안전하게 호출합니다.
    } else {
      // ⚠️ html5: true 모드에서는 fade()가 즉시 중단되어 볼륨이 0에 머무는 버그가 자주 발생하므로, 직접 volume을 세팅합니다.
      nextBgm.volume(this.bgmVol);
      if (!nextBgm.playing()) {
        nextBgm.play();
      }
    }
  }

  duckBgm(durationMs: number = 1000) {
    if (!this.currentBgm) return;
    const targetVol = this.bgmVol * 0.4;
    this.currentBgm.fade(this.bgmVol, targetVol, 200);
    setTimeout(() => {
      if (this.currentBgm) {
        this.currentBgm.fade(targetVol, this.bgmVol, 500);
      }
    }, durationMs);
  }

  // --- SFX Methods ---
  playSfx(name: string, impulse: number = 0, x: number = 400, isSkill: boolean = false) {
    if (this.isMuted) return;
    
    // 매핑된 파일 경로 찾기
    let path = sfxPathMap[name];
    if (name.startsWith('skill_') || isSkill) {
      path = '/sounds/skills/skill_cast.mp3';
    }

    if (!path || !this.sfxCache[path]) return;

    const now = Date.now();
    // 1. Throttling (동일 사운드 단기 중복 방지 - 과부하 및 소음 차단)
    const throttleTime = path.includes('ui_') ? 50 : THROTTLE_MS; 
    if (this.lastPlayed[path] && now - this.lastPlayed[path] < throttleTime) {
      return; 
    }
    this.lastPlayed[path] = now;

    // 2. Polyphony control
    if (!path.includes('ui_')) {
      if (this.activeCount >= MAX_POLYPHONY) return;
      this.activeCount++;
      setTimeout(() => this.activeCount--, 300);
    }

    // 3. Dynamic Volume
    let dynamicVolume = this.masterVol * this.sfxVol;
    if (impulse > 0) {
      dynamicVolume *= Math.min(Math.max(impulse / 1000, 0.3), 1.2);
    }

    const sound = this.sfxCache[path];
    const id = sound.play();
    sound.volume(dynamicVolume, id);

    // 4. 피치 랜덤화 (기믹 소리만 약간씩 다르게)
    if (!path.includes('ui_') && !path.includes('skill_')) {
      sound.rate(0.9 + Math.random() * 0.2, id);
    } else {
      sound.rate(1.0, id);
    }

    if (isSkill) {
      this.duckBgm(800);
    }
  }

  // --- Controls ---
  setVolumes(master: number, bgmScale: number, sfxScale: number) {
    this.masterVol = master;
    this.bgmVol = bgmScale * BASE_BGM_VOL;
    this.sfxVol = sfxScale * BASE_SFX_VOL;
    Howler.volume(master);
    if (this.currentBgm) this.currentBgm.volume(this.bgmVol);
    
    // Update all cached SFX base volumes
    Object.values(this.sfxCache).forEach(howl => howl.volume(this.sfxVol));
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    Howler.mute(this.isMuted);
  }

  getMuted(): boolean {
    return this.isMuted;
  }

  toggleMute() {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }
}

export const soundManager = AudioEngine.getInstance();
