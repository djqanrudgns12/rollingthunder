// 회전 단위의 단일 계약(SSOT).
//
// 배경: 기물의 회전값은 데이터 상 두 필드로 존재했다 — `angle`(항상 도) 와 `rotation`.
// 물리 엔진(MapBuilder)은 두 값을 모두 "도(degree)"로 취급(`* Math.PI/180`)하지만,
// 과거 렌더러/미니맵은 `rotation`을 "라디안"으로 오해해 프리셋(도 단위)을 잘못 렌더했다.
// → 데이터의 정규 단위를 "도(degree)"로 통일하고, 라디안 변환은 렌더/물리 경계에서만 수행한다.
//
// 이 헬퍼를 게임 캔버스·에디터 캔버스·미니맵이 공통으로 사용해 회전 해석을 일치시킨다.

const DEG2RAD = Math.PI / 180;

export const deg2rad = (d: number) => d * DEG2RAD;

/** 기물의 회전값(도). 물리(MapBuilder)의 `item.angle ?? item.rotation ?? 0` 규칙과 동일. */
export function itemRotationDeg(item: any): number {
  const base = item?.angle ?? item?.rotation;
  if (base != null) return base;
  // 플리퍼는 별도 회전 필드 없이 restAngle 로 기본 자세가 결정된다(게임 물리와 일치).
  if (item?.type === 'flipper') return item.restAngle ?? 0;
  return 0;
}

/** 기물의 회전값(라디안) — Pixi rotation 에 그대로 대입 가능. */
export const itemRotationRad = (item: any) => deg2rad(itemRotationDeg(item));
