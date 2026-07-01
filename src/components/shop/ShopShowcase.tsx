"use client";

import React, { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, PresentationControls, Float, ContactShadows, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// 동적 모델링 (임시 Box로 대체, 실제 에셋이 있을 시 GLTF 교체)
function ShowcaseItem({ selectedItem }: { selectedItem: any }) {
  const meshRef = useRef<THREE.Mesh>(null);

  // 천천히 회전하는 효과
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.5;
    }
  });

  // 카테고리별로 다른 형태 임시 렌더링
  const getGeometry = () => {
    if (selectedItem.category === 'piece') return <torusKnotGeometry args={[1, 0.3, 128, 32]} />;
    if (selectedItem.category === 'skin') return <capsuleGeometry args={[1, 2, 4, 16]} />;
    return <boxGeometry args={[2, 2, 2]} />;
  };

  const getMaterial = () => {
    if (selectedItem.rarity === 'Legendary') {
      return <meshStandardMaterial color="#fbbf24" metalness={1} roughness={0.1} />;
    }
    if (selectedItem.rarity === 'Epic') {
      return <meshStandardMaterial color="#a855f7" metalness={0.8} roughness={0.2} />;
    }
    return <meshStandardMaterial color="#94a3b8" metalness={0.5} roughness={0.5} />;
  };

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
      <mesh ref={meshRef} castShadow receiveShadow>
        {getGeometry()}
        {getMaterial()}
      </mesh>
    </Float>
  );
}

export default function ShopShowcase({ selectedItem }: { selectedItem: any }) {
  return (
    <div className="w-full h-full absolute inset-0">
      <Canvas shadows camera={{ position: [0, 2, 6], fov: 45 }}>
        {/* 어둡고 고급스러운 조명 설정 */}
        <color attach="background" args={['#000000']} />
        <ambientLight intensity={0.2} />
        <spotLight 
          position={[0, -5, 0]} 
          angle={0.5} 
          penumbra={1} 
          intensity={5} 
          color="#f59e0b" 
          castShadow
        />
        <spotLight 
          position={[5, 5, 5]} 
          angle={0.3} 
          penumbra={1} 
          intensity={2} 
          color="#ffffff" 
        />
        
        <PresentationControls 
          global 
          snap={true} 
          rotation={[0, 0, 0]} 
          polar={[-Math.PI / 3, Math.PI / 3]} 
          azimuth={[-Math.PI / 1.4, Math.PI / 2]}
        >
          <Suspense fallback={null}>
            <ShowcaseItem selectedItem={selectedItem} />
            <Environment preset="city" />
            <ContactShadows position={[0, -1.5, 0]} opacity={0.4} scale={10} blur={2} far={4} />
          </Suspense>
        </PresentationControls>
      </Canvas>
    </div>
  );
}
