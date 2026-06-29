import { Howl, Howler } from 'howler'

const MAX_POLYPHONY = 4;
const THROTTLE_MS = 200;

interface ActiveSound {
  id: number;
  sound: Howl;
}

class AudioEngine {
  private static instance: AudioEngine;
  
  // BGM
  private standbyBgm: Howl;
  private playgameBgm: Howl;
  private currentBgm: Howl | null = null;

  // SFX Groups
  private sounds: Record<string, Howl> = {};
  
  // Throttling state
  private lastPlayed: Record<string, number> = {};
  
  // Polyphony state
  private activeSfx: ActiveSound[] = [];

  private isMuted: boolean = false;
  
  // Volumes
  private masterVol: number = 1.0;
  private bgmVol: number = 0.6;
  private sfxVol: number = 1.0;

  private constructor() {
    Howler.volume(this.masterVol);

    this.standbyBgm = new Howl({ src: ['/sounds/bgm/Standby.mp3'], loop: true, volume: this.bgmVol, preload: true });
    this.playgameBgm = new Howl({ src: ['/sounds/bgm/Playgame.mp3'], loop: true, volume: this.bgmVol, preload: true });

    const sfxList = [
      'gimmick_funnel', 'gimmick_pipe', 'gimmick_domino', 'env_wormhole',
      'skill_tank', 'skill_slime', 'skill_ghost', 'skill_magnet', 'skill_teleport', 'skill_booster',
      'ui_click', 'ui_nudge', 'ui_door_slam', 'ui_fanfare'
    ];
    
    sfxList.forEach(name => {
      let folder = 'sfx';
      if (name.startsWith('skill_')) folder = 'skills';
      if (name.startsWith('ui_')) folder = 'ui';
      
      this.sounds[name] = new Howl({
        src: [`/sounds/${folder}/${name}.mp3`],
        volume: this.sfxVol,
        preload: true,
        onend: (id) => this.removeActiveSfx(id)
      });
    });
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

  // --- SFX Methods ---
  playSfx(name: string, impulse: number = 0, x: number = 400, isSkill: boolean = false) {
    const sound = this.sounds[name];
    if (!sound) return;

    const now = Date.now();
    // 1. Throttling (동일 사운드 단기 중복 재생 방지)
    if (this.lastPlayed[name] && now - this.lastPlayed[name] < THROTTLE_MS) {
      return; 
    }
    this.lastPlayed[name] = now;

    // 2. Polyphony control (동시 채널 제한)
    // 배경음/UI음 제외 물리/스킬음만 폴리포니 제한 적용
    if (!name.startsWith('ui_')) {
      if (this.activeSfx.length >= MAX_POLYPHONY) {
        const oldest = this.activeSfx.shift();
        if (oldest) {
          oldest.sound.fade(oldest.sound.volume(oldest.id) as number, 0, 100, oldest.id);
          setTimeout(() => oldest.sound.stop(oldest.id), 100);
        }
      }
    }

    // 3. Velocity-based volume (충돌 강도 비례 볼륨)
    let volume = this.sfxVol;
    if (impulse > 0) {
      volume = Math.min(Math.max(impulse / 1000, 0.2), 1.0) * this.sfxVol;
    }

    // 4. Stereo Panning (좌우 위치 기반 패닝)
    const pan = Math.min(Math.max((x / 400) - 1.0, -1.0), 1.0);

    // 5. Pitch Randomization (피치 무작위화 ±5%)
    const rate = 0.95 + Math.random() * 0.1;

    const id = sound.play();
    sound.volume(volume, id);
    sound.stereo(pan, id);
    sound.rate(rate, id);

    if (!name.startsWith('ui_')) {
      this.activeSfx.push({ id, sound });
    }

    // 스킬 발동 시 더킹 효과
    if (isSkill) {
      this.duckBgm(1000);
    }
  }

  private removeActiveSfx(id: number) {
    this.activeSfx = this.activeSfx.filter(s => s.id !== id);
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
