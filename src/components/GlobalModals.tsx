'use client'

import React from 'react'
import dynamic from 'next/dynamic'

// 모달은 부팅 시 항상 닫힘 상태(uiStore merge가 activeModal:'none' 강제)이므로
// 코드를 열 때 로드해도 사용자 체감 차이가 없다 → 초기 번들에서 제외(lazy).
const StampBookModal = dynamic(() => import('@/components/StampBookModal'), { ssr: false })
const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false })
const SettingsModal = dynamic(() => import('@/components/SettingsModal'), { ssr: false })
const ProfileModal = dynamic(() => import('@/components/profile/ProfileModal'), { ssr: false })
const ReconsentModal = dynamic(() => import('@/components/ReconsentModal'), { ssr: false })

export default function GlobalModals() {
  return (
    <>
      <StampBookModal />
      <AuthModal />
      <SettingsModal />
      <ProfileModal />
      <ReconsentModal />
    </>
  )
}
