declare module 'poly-decomp' {
  export function makeCCW(polygon: any[]): void;
  export function quickDecomp(polygon: any[]): any[][];
  export function decomp(polygon: any[]): any[][];
  export function isSimple(polygon: any[]): boolean;
  export function removeCollinearPoints(polygon: any[], thresholdAngle: number): void;
}
