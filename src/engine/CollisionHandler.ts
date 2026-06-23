import RAPIER from '@dimforge/rapier2d-compat';

export class CollisionHandler {
  static drainEvents(
    eventQueue: RAPIER.EventQueue, 
    onCollide?: (handle1: number, handle2: number) => void
  ) {
    eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      if (started && onCollide) {
        onCollide(handle1, handle2);
      }
    });
  }
}
