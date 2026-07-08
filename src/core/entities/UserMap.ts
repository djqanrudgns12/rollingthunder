// src/core/entities/UserMap.ts
// premium/admin 이 만드는 개인 커스텀 맵 (user_maps 테이블).
// 공식맵(MapEntity/maps 테이블)과 분리된 네임스페이스 — 권한 모델이 테이블 경계로 나뉜다.
import type { MapComplexity, MapLengthType, MapWallStyle } from './Map';

export interface UserMapEntity {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  lengthType: MapLengthType;
  complexity: MapComplexity;
  worldHeight: number;
  wallStyle: MapWallStyle;
  bgImage?: string;
  themeWeights: Record<string, number>;
  layoutConfig: Record<string, any>;
  items: any[];
  schemaVersion: number;
  isPublished: boolean;
  publishedAt?: Date;
  validationSummary?: any;
  downloadCount: number;
  likeCount: number;
  /** 스토어 조회 시 profiles 조인으로 채워지는 표시명 */
  creatorName?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/** user_map_downloads 의 스냅샷 — 원본 삭제/수정과 무관하게 보존되는 완전한 맵 데이터 */
export interface UserMapSnapshot {
  schemaVersion: number;
  items: any[];
  worldHeight: number;
  wallStyle: string;
  bgImage?: string | null;
  layoutConfig: Record<string, any>;
  themeWeights: Record<string, number>;
  lengthType: MapLengthType;
  complexity: MapComplexity;
  description: string;
}

export interface UserMapDownloadEntity {
  id: string;
  sourceMapId: string | null;
  mapName: string;
  creatorName: string;
  snapshot: UserMapSnapshot;
  downloadedAt: Date;
}

/** premium 개인 맵 저장 슬롯 (admin 무제한) — DB 트리거와 동일 값 유지 */
export const USER_MAP_SLOT_LIMIT = 10;
/** 스토어 다운로드 비용 = 제작자 보상 (칩 이전, 시스템 발행 없음) — RPC와 동일 값 유지 */
export const MAP_DOWNLOAD_COST = 100;
