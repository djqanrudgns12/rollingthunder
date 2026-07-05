"use client";

/**
 * SkinCanvasPreview.tsx
 * 
 * 왜 만들었나:
 * 벡터 스킨(Canvas 2D로 그린 기본/Normal 스킨)을 상점 아이템 목록,
 * 쇼케이스, 프로필 등 여러 곳에서 재사용할 수 있는 미리보기 컴포넌트.
 * 
 * 사용법:
 * <SkinCanvasPreview skinKey="cat" size={64} color="#a3a3a3" />
 */

import React, { useRef, useEffect } from 'react';
import { SKIN_DEFINITIONS } from '@/data/skinDefinitions';

interface SkinCanvasPreviewProps {
  skinKey: string;       // SKIN_DEFINITIONS의 키 (예: 'cat', 'horse', 'chip_base_1')
  size?: number;         // CSS 표시 크기 (기본 64px)
  color?: string;        // 채움 색상 (기본 회색)
  className?: string;    // 추가 CSS 클래스
}

export default function SkinCanvasPreview({ skinKey, size = 64, color = '#a3a3a3', className = '' }: SkinCanvasPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const def = SKIN_DEFINITIONS[skinKey];
    if (!def) return;

    // 내부 해상도는 128px 고정 (선명도 보장)
    const resolution = 128;
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
  }, [skinKey, color]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: size,
        height: size,
        imageRendering: 'auto',
      }}
    />
  );
}
