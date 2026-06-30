import { Howl, Howler } from 'howler';

const MAX_POLYPHONY = 6;
const THROTTLE_MS = 150;

// ============================================================================
// 🎹 ZzFX Micro Synthesizer Engine
// ============================================================================
let zzfxX: AudioContext | null = null;
export const initZzfx = (forceResume: boolean = false) => {
  if (typeof window === 'undefined') return;
  if (!zzfxX) {
    if (Howler.ctx) {
      zzfxX = Howler.ctx as AudioContext;
    } else {
      zzfxX = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }
  if (zzfxX.state === 'suspended' && forceResume) {
    zzfxX.resume().catch(() => {});
  }
};

const zzfx = (...t: any[]) => zzfxP(zzfxG(...t));
const zzfxP = (...t: any[]) => {
  if (!zzfxX) initZzfx();
  if (!zzfxX) return;
  let e = zzfxX.createBufferSource(), f = zzfxX.createBuffer(t.length, t[0].length, 44100);
  t.map((t, e) => f.getChannelData(e).set(t));
  e.buffer = f; 
  // Howler의 마스터 게인에 연결하여 전체 볼륨 및 뮤트 상태 공유
  e.connect((Howler as any).masterGain ? (Howler as any).masterGain : zzfxX.destination); 
  e.start(); 
  return e;
};
const zzfxG = (q=1,k=.05,c=220,e=0,t=0,u=.1,r=0,F=1,v=0,z=0,w=0,A=0,l=0,B=0,x=0,m=0,d=0,y=1,n=0,C=0) => {
  let b=2*Math.PI,H=v*=500*b/44100**2,I=(0<x?1:-1)*b/4,D=c*=(1+2*k*Math.random()-k)*b/44100,Z=[],g=0,E=0,a=0,n_=1,J=0,K=0,f=0,p,h;e=99+44100*e;m*=44100;t*=44100;u*=44100;d*=44100;y*=500*b/44100**3;x*=b/44100;w*=b/44100;A*=44100;l=44100*l|0;for(h=e+t+u+m+d,p=0;p<h;p++)Z[p]=0;for(p=0;p<h;p++){Z[p]=0;a=++a%100,a=r?a>n?1:-1:Math.sin(a*b/100),g+=D+=v+=y,E=g+I*Math.sin(E*x),f=(p<e?p/e:p<e+t?1:p<e+t+u?1-(p-e-t)/u:p<e+t+u+m?0:p<e+t+u+m+d?1-(p-e-t-u-m)/d:0)*Math.abs(Math.sin(E)),f=B?f*(1-B+B*Math.sin(b*p/C)):f,f=C?f*(1-C+C*Math.sin(b*p/l)):f,J+=f,K+=f,n_=p?Math.min(1,n_+A):0;Z[p]=a*f*n_*q;D+=H;}return[Z]
};

// 15종의 엄선된 알고리즘 사운드 파라미터 매핑
const zzfxData: Record<string, any[]> = {
  gimmick_funnel: [1.2, undefined, 200, undefined, .05, .2, 1, 1.5, undefined, undefined, -100, undefined, .05, undefined, undefined, undefined, undefined, undefined, .5],
  gimmick_pipe: [1.5, undefined, 150, .01, .1, .2, 1, 2, -1, -5, .1, .05, undefined, undefined, undefined, undefined, undefined, undefined, .1],
  gimmick_domino: [1.5, undefined, 400, undefined, .02, .15, 1, 1, 5, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, .1],
  spinner_whoosh: [1.2, undefined, 300, .1, .1, .2, 1, 0, -1, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, .1], // 새로 추가된 스피너 붕붕 소리
  env_wormhole: [1.5, undefined, 300, .2, .2, .3, 1, 0.5, -5, 5, .1, .1, undefined, .5, undefined, undefined, undefined, .5, .5],
  skill_tank: [2, undefined, 80, .01, .05, .4, 3, 1.5, -5, undefined, undefined, undefined, -0.1, .1, .8, undefined, undefined, undefined, .2],
  skill_slime: [1.5, undefined, 400, .02, .1, .3, 2, 2, -2, 10, .05, .1, .1, undefined, undefined, undefined, .1],
  skill_ghost: [1.5, undefined, 800, .1, .3, .5, 1, 0.5, undefined, undefined, -50, undefined, .05, undefined, .5, undefined, .1, .8],
  skill_magnet: [1.5, undefined, 200, .05, .2, .2, 3, 1, -5, 5, .1, .1, .8, undefined, .1],
  skill_teleport: [1.5, undefined, 600, .01, .05, .3, 1, 2, -10, undefined, .1, .05, undefined, undefined, undefined, undefined, .5],
  skill_booster: [1.5, undefined, 100, .05, .1, .3, 3, 2, 10, -5, .05, .05, .2, undefined, .1],
  ui_click: [1.5, undefined, 800, undefined, .01, .02, 1, 0, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, .1],
  ui_nudge: [1.5, undefined, 150, undefined, .01, .05, 3, 0, -2, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, .1],
  ui_door_slam: [1.5, undefined, 80, undefined, .02, .2, 3, 0, -1, undefined, undefined, undefined, .1, undefined, .5],
  ui_fanfare: [1.5, undefined, 600, .05, .2, .5, 0, 1, 1, -1, undefined, .05, undefined, .1, undefined, .5]
};
// ============================================================================

class AudioEngine {
  private static instance: AudioEngine;
  
  // BGM (사용자 제공 .mp3 파일은 Howler로 정상 재생)
  private standbyBgm: Howl;
  private playgameBgm: Howl;
  private mapeditorBgm: Howl;
  private currentBgm: Howl | null = null;
  
  // Throttling state
  private lastPlayed: Record<string, number> = {};
  
  // Polyphony state (간이 폴리포니 트래커)
  private activeCount: number = 0;

  private isMuted: boolean = false;
  
  // Volumes
  private masterVol: number = 1.0;
  private bgmVol: number = 0.6;
  private sfxVol: number = 1.0;

  private constructor() {
    Howler.volume(this.masterVol);

    this.standbyBgm = new Howl({ src: ['/sounds/bgm/Standby.mp3'], loop: true, volume: this.bgmVol, preload: true, html5: true });
    this.playgameBgm = new Howl({ src: ['/sounds/bgm/Playgame.mp3'], loop: true, volume: this.bgmVol, preload: true, html5: true });
    this.mapeditorBgm = new Howl({ src: ['/sounds/bgm/Mapeditor.mp3'], loop: true, volume: this.bgmVol, preload: true, html5: true });
  }

  // --- 핵심: 전역 오디오 락 해제 메서드 ---
  unlockAudio() {
    initZzfx(true);
    // 빈 버퍼를 재생하여 iOS 등에서 오디오 세션을 완벽히 초기화합니다.
    if (zzfxX) {
      const buffer = zzfxX.createBuffer(1, 1, 22050);
      const source = zzfxX.createBufferSource();
      source.buffer = buffer;
      source.connect(zzfxX.destination);
      source.start();
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
      setTimeout(() => prevBgm.pause(), fadeDuration);
    }
    
    nextBgm.volume(0);
    nextBgm.play();
    nextBgm.fade(0, this.bgmVol, fadeDuration);
  }

  // Ducking: temporarily lower BGM volume
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

  // --- SFX Methods (ZzFX 연동) ---
  playSfx(name: string, impulse: number = 0, x: number = 400, isSkill: boolean = false) {
    if (this.isMuted) return;
    
    const paramArray = zzfxData[name];
    if (!paramArray) return;

    const now = Date.now();
    // 1. Throttling (동일 사운드 단기 중복 재생 방지)
    if (this.lastPlayed[name] && now - this.lastPlayed[name] < THROTTLE_MS) {
      return; 
    }
    this.lastPlayed[name] = now;

    // 2. Polyphony control (동시 재생 수 제한)
    if (!name.startsWith('ui_')) {
      if (this.activeCount >= MAX_POLYPHONY) return;
      this.activeCount++;
      setTimeout(() => this.activeCount--, 300); // 300ms 후 동시재생 카운트 해제
    }

    // 3. Velocity-based volume (충돌 강도 비례 볼륨 조정)
    let dynamicVolume = this.masterVol * this.sfxVol;
    if (impulse > 0) {
      dynamicVolume *= Math.min(Math.max(impulse / 1000, 0.3), 1.2);
    }

    // ZzFX 초기화 보장
    initZzfx();

    // 원본 파라미터 복사 후 첫 번째 인자(Volume) 변경
    const finalParams = [...paramArray];
    finalParams[0] = (finalParams[0] || 1) * dynamicVolume;

    // 4. 피치 랜덤화: 주파수(Frequency, 세번째 인자) 미세 변조
    if (finalParams[2]) {
      finalParams[2] *= (0.9 + Math.random() * 0.2); // ±10%
    }

    // ZzFX 실행 (사운드 발사)
    zzfx(...finalParams);

    // 스킬 발동 시 더킹 효과
    if (isSkill) {
      this.duckBgm(800);
    }
  }

  // --- Controls ---
  setVolumes(master: number, bgm: number, sfx: number) {
    this.masterVol = master;
    this.bgmVol = bgm;
    this.sfxVol = sfx;
    Howler.volume(master);
    if (this.currentBgm) this.currentBgm.volume(bgm);
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
