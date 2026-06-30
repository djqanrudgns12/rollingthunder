// src/core/entities/Map.ts
export type MapComplexity = 'Simple' | 'Medium' | 'Complex';
export type MapLengthType = 'Short' | 'Middle' | 'Long';
export type MapWallStyle = 'straight' | 'zigzag' | 'narrow' | 'wide';

export interface MapEntity {
  id: string;
  name: string;
  description?: string;
  lengthType: MapLengthType;
  complexity: MapComplexity;
  worldHeight: number;
  wallStyle: MapWallStyle;
  bgImage?: string;
  themeWeights: Record<string, number>;
  layoutConfig: Record<string, any>;
  items: any[];
  createdAt?: Date;
  updatedAt?: Date;
}
