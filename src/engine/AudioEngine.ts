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

  // 충돌 강도(Impulse)에 비례하여 볼륨과 피치를 조절하는 타격음 재생
  playBumperHit(impulse: number) {
    const normalizedVolume = Math.min(Math.max(impulse / 1000, 0.2), 1.0);
    const id = this.bumperSound.play();
    this.bumperSound.volume(normalizedVolume, id);
    // 피치(재생 속도)를 무작위로 미세하게 흔들어 청각적 피로도 방지
    this.bumperSound.rate(1.0 + (Math.random() * 0.4 - 0.2), id);
  }

  playWallHit(impulse: number) {
    if (impulse < 100) return; // 너무 약한 굴러가는 소리는 무시
    const normalizedVolume = Math.min(Math.max(impulse / 2000, 0.1), 0.5);
    const id = this.wallHitSound.play();
    this.wallHitSound.volume(normalizedVolume, id);
    this.wallHitSound.rate(1.0 + (Math.random() * 0.2 - 0.1), id);
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
