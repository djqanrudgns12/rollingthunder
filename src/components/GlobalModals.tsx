'use client'

import React from 'react'
import StampBookModal from '@/components/StampBookModal'
import AuthModal from '@/components/AuthModal'
import SettingsModal from '@/components/SettingsModal'
import ProfileModal from '@/components/profile/ProfileModal'

export default function GlobalModals() {
  return (
    <>
      <StampBookModal />
      <AuthModal />
      <SettingsModal />
      <ProfileModal />
    </>
  )
}
