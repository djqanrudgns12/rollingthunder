import { Howl, Howler } from 'howler'

class AudioEngine {
  private static instance: AudioEngine;
  private bumperSound: Howl;
  private wallHitSound: Howl;
  private finishSound: Howl;
  private isMuted: boolean = false;

  private constructor() {
    // Zero-latency를 위해 Web Audio API 기반으로 사전 로드 (Preload)
    this.bumperSound = new Howl({
      src: ['https://actions.google.com/sounds/v1/cartoon/cartoon_boing.ogg'],
      volume: 0.8,
      preload: true
    });
    this.wallHitSound = new Howl({
      src: ['https://actions.google.com/sounds/v1/impacts/wood_hit_metal.ogg'],
      volume: 0.4,
      preload: true
    });
    this.finishSound = new Howl({
      src: ['https://actions.google.com/sounds/v1/magic/magical_ping.ogg'],
      volume: 1.0,
      preload: true
    });
  }

  static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  // 충돌 강도(Impulse)와 X좌표를 이용해 볼륨, 피치, 좌우 패닝(Stereo)을 조절하는 타격음 재생
  playBumperHit(impulse: number, x: number = 400) {
    const normalizedVolume = Math.min(Math.max(impulse / 1000, 0.2), 1.0);
    const id = this.bumperSound.play();
    this.bumperSound.volume(normalizedVolume, id);
    
    // 스테레오 패닝: 캔버스 너비(800) 기준 -1(좌) ~ 1(우)로 변환
    const pan = (x / 400) - 1.0;
    this.bumperSound.stereo(pan, id);
    
    // 강하게 부딪힐수록 피치가 올라감
    const rate = 0.8 + (normalizedVolume * 0.5) + (Math.random() * 0.2 - 0.1);
    this.bumperSound.rate(rate, id);
  }

  playWallHit(impulse: number, x: number = 400) {
    if (impulse < 50) return; // 너무 약한 굴러가는 소리는 무시
    const normalizedVolume = Math.min(Math.max(impulse / 2000, 0.1), 0.5);
    const id = this.wallHitSound.play();
    this.wallHitSound.volume(normalizedVolume, id);
    
    // 스테레오 패닝
    const pan = (x / 400) - 1.0;
    this.wallHitSound.stereo(pan, id);
    
    const rate = 0.9 + (normalizedVolume * 0.4) + (Math.random() * 0.2 - 0.1);
    this.wallHitSound.rate(rate, id);
  }

  playFinish() {
    this.finishSound.play();
  }

  // 스킬 발동 효과음. 별도 에셋 추가 없이 사전 로드된 3개 사운드를 스킬별로
  // 음원/피치(rate)/볼륨/패닝을 달리해 재생 → 발동이 청각적으로 분명히 구분된다.
  playSkillActivation(skill: string, x: number = 400) {
    // [Howl, rate, volume]
    const map: Record<string, [Howl, number, number]> = {
      tank:     [this.wallHitSound, 0.7, 0.6],  // 무거운 충격음
      booster:  [this.bumperSound, 1.45, 0.7],  // 높은 휙 소리
      ghost:    [this.finishSound, 1.6, 0.45],  // 맑은 위잉
      slime:    [this.bumperSound, 0.6, 0.6],   // 낮은 뭉글
      magnet:   [this.finishSound, 0.8, 0.6],   // 저음 핑
      teleport: [this.finishSound, 1.3, 0.85],  // 워프 핑
    };
    const entry = map[skill];
    if (!entry) return;
    const [sound, rate, volume] = entry;
    const id = sound.play();
    sound.rate(rate, id);
    sound.volume(volume, id);
    // 스테레오 패닝: 캔버스 너비(800) 기준 -1(좌) ~ 1(우)
    sound.stereo((x / 400) - 1.0, id);
  }
  
  toggleMute() {
    this.isMuted = !this.isMuted;
    Howler.mute(this.isMuted);
    return this.isMuted;
  }
}

export const soundManager = AudioEngine.getInstance();
