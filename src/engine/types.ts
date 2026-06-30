export interface PhysicComponent {
  x: number;
  y: number;
  radius?: number;
  width?: number;
  height?: number;
  color?: string;
  isDynamic: boolean;
  type: 'chip' | 'wall' | 'pin' | 'bumper';
  id?: string;
}

export interface UserData {
  type: 'chip' | 'wall' | 'pin' | 'bumper' | 'portal' | 'booster' | 'windmill' | 'piston' | 'blackhole' | 'whitehole' | 'hole' | 'spinner' | 'iceblock' | 'windcannon' | 'luckygate' | 'flipper' | 'polygon';
  id?: string;
  radius?: number;
  w?: number;
  h?: number;
  rotation?: number;
  power?: number;
  speed?: number;
  force?: number;
  color?: string;
  soundTag?: string;
  hp?: number;
  maxHp?: number;
  windAngle?: number;
  windForce?: number;
  onFrames?: number;
  offFrames?: number;
  length?: number;
  restAngle?: number;
  swingAngle?: number;
  state?: string;
  stateFrame?: number;
  swingSpeed?: number;
  returnSpeed?: number;
  side?: string;
}
