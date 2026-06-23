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
  
  toggleMute() {
    this.isMuted = !this.isMuted;
    Howler.mute(this.isMuted);
    return this.isMuted;
  }
}

export const soundManager = AudioEngine.getInstance();
