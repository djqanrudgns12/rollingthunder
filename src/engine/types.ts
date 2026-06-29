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
  type: 'chip' | 'wall' | 'pin' | 'bumper' | 'portal' | 'booster' | 'windmill' | 'piston' | 'blackhole' | 'whitehole' | 'hole' | 'spinner';
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
}
