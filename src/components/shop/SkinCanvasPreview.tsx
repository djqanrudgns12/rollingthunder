"use client";

/**
 * SkinCanvasPreview.tsx
 * 
 * 변경사항(캐싱 최적화):
 * 상점 리스트 등에 다수의 스킨이 노출될 때마다 <canvas>가 DOM에 붙고
 * 동기적인 렌더링이 발생하는 병목 현상을 방지하기 위해,
 * 오프스크린 캔버스에서 그린 후 data:image/png URL로 변환하여
 * 메모리에 캐싱(canvasCache)하고 <img> 태그로 렌더링합니다.
 */

import React, { useEffect, useState } from 'react';
import { SKIN_DEFINITIONS } from '@/data/skinDefinitions';

// [최적화] 전역 캐시 저장소: 동일한 스킨과 색상 조합은 단 한 번만 그립니다.
const canvasCache = new Map<string, string>();

interface SkinCanvasPreviewProps {
  skinKey: string;       // SKIN_DEFINITIONS의 키 (예: 'cat', 'horse', 'chip_base_1')
  size?: number;         // CSS 표시 크기 (기본 64px)
  color?: string;        // 채움 색상 (기본 회색)
  className?: string;    // 추가 CSS 클래스
}

export default function SkinCanvasPreview({ skinKey, size = 64, color = '#a3a3a3', className = '' }: SkinCanvasPreviewProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const cacheKey = `${skinKey}_${color}`;
    
    // 이미 그려둔 데이터가 있다면 즉시 로드
    if (canvasCache.has(cacheKey)) {
      setDataUrl(canvasCache.get(cacheKey)!);
      return;
    }

    const def = SKIN_DEFINITIONS[skinKey];
    if (!def) return;

    // Next.js SSR 방어: 클라이언트 환경에서만 캔버스 생성
    if (typeof window === 'undefined') return;

    // 내부 해상도는 128px 고정 (선명도 보장)
    const resolution = 128;
    const canvas = document.createElement('canvas');
    canvas.width = resolution;
    canvas.height = resolution;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, resolution, resolution);
    ctx.save();
    ctx.translate(resolution / 2, resolution / 2);
    ctx.fillStyle = color;

    const scale = def.scale ?? 1.0;
    if (scale !== 1.0) ctx.scale(scale, scale);

    def.draw(ctx, resolution / 2);
    ctx.restore();

    // 완성된 캔버스를 Data URL로 인코딩 후 캐싱
    const url = canvas.toDataURL('image/png');
    canvasCache.set(cacheKey, url);
    setDataUrl(url);
  }, [skinKey, color]);

  // 로딩 중이거나 렌더링되지 않았을 때는 빈 영역 유지 (Layout Shift 방지)
  if (!dataUrl) {
    return <div className={className} style={{ width: size, height: size }} />;
  }

  // <canvas> 대신 가벼운 <img> 태그 반환
  return (
    <img
      src={dataUrl}
      alt={`${skinKey} preview`}
      className={className}
      style={{
        width: size,
        height: size,
        imageRendering: 'auto',
        objectFit: 'contain'
      }}
    />
  );
}
