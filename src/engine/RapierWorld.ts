import RAPIER from '@dimforge/rapier2d-compat';

export class RapierEngine {
  private static instance: RapierEngine;
  public world: RAPIER.World | null = null;
  public isInitialized = false;

  private constructor() {}

  public static async getInstance() {
    if (!RapierEngine.instance) {
      RapierEngine.instance = new RapierEngine();
      await RAPIER.init();
      // HTML Canvas 좌표계에 맞춰 중력을 아래 방향(양수)으로 설정
      const gravity = { x: 0.0, y: 9.81 * 30 }; // 스케일 조정을 위해 중력 증폭
      RapierEngine.instance.world = new RAPIER.World(gravity);
      RapierEngine.instance.isInitialized = true;
    }
    return RapierEngine.instance;
  }
  
  public step(eventQueue?: RAPIER.EventQueue) {
    if (this.world) {
      if (eventQueue) {
        this.world.step(eventQueue);
      } else {
        this.world.step();
      }
    }
  }

  public clear() {
    if (this.world) {
      this.world.free();
      this.world = null;
      this.isInitialized = false;
    }
    RapierEngine.instance = null as any;
  }
}
