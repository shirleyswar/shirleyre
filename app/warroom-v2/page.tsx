'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PinGate from '@/components/warroom/PinGate'
import Sidebar from '@/components/warroom/Sidebar'
import StatsRibbon from '@/components/warroom/StatsRibbon'
import BattlePlanPanel from '@/components/warroom/BattlePlanPanel'
import SchedulePanel from '@/components/warroom/SchedulePanel'
import UnderContractPanel from '@/components/warroom/UnderContractPanel'
import MoneyMoversPanel from '@/components/warroom/MoneyMoversPanel'
import DealPipelinePanel from '@/components/warroom/DealPipelinePanel'
import AccountsReceivablePanel from '@/components/warroom/AccountsReceivablePanel'
import ShirleyCREAgentCard from '@/components/warroom/ShirleyCREAgentCard'

const PIN_HASH_KEY = 'wr_pin_hash'
const SESSION_KEY  = 'wr_session_exp'
const SESSION_HOURS = 8

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Default PIN hash for "1234"
const DEFAULT_PIN_HASH = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4'

export default function WarRoomPage() {
  const [unlocked, setUnlocked] = useState(false)
  const [showFlash, setShowFlash] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activePanel, setActivePanel] = useState('overview')

  // Check existing session on mount
  useEffect(() => {
    const expiry = localStorage.getItem(SESSION_KEY)
    if (expiry && Date.now() < parseInt(expiry)) {
      setUnlocked(true)
    }
  }, [])

  const handlePinSuccess = useCallback(() => {
    // Set 8-hour session
    const expiry = Date.now() + SESSION_HOURS * 60 * 60 * 1000
    localStorage.setItem(SESSION_KEY, expiry.toString())
    // Gold flash then reveal dashboard
    setShowFlash(true)
    setTimeout(() => {
      setShowFlash(false)
      setUnlocked(true)
    }, 800)
  }, [])

  if (!unlocked) {
    return (
      <>
        <PinGate
          pinHash={DEFAULT_PIN_HASH}
          sha256={sha256}
          onSuccess={handlePinSuccess}
        />
        <AnimatePresence>
          {showFlash && (
            <motion.div
              className="gold-flash-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
            />
          )}
        </AnimatePresence>
      </>
    )
  }

  return (
    <div className="flex h-screen bg-bg-base overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        activePanel={activePanel}
        onPanelSelect={setActivePanel}
      />

      {/* Main content area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Stats ribbon */}
        <StatsRibbon />

        {/* Dashboard grid */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5 max-w-[1600px] mx-auto"
            initial="hidden"
            animate="visible"
          >
            {/* Row 1: Battle Plan (large) + Schedule (medium) + ShirleyCRE Agent (medium) */}
            <div className="lg:col-span-2 card-reveal card-reveal-1">
              <BattlePlanPanel />
            </div>
            <div className="card-reveal card-reveal-2">
              <SchedulePanel />
            </div>

            {/* Row 2: Under Contract (large) + Money Movers (medium) */}
            <div className="lg:col-span-2 card-reveal card-reveal-3">
              <UnderContractPanel />
            </div>
            <div className="card-reveal card-reveal-4">
              <MoneyMoversPanel />
            </div>

            {/* Row 3: Deal Pipeline (full width) */}
            <div className="lg:col-span-3 card-reveal card-reveal-5">
              <DealPipelinePanel />
            </div>

            {/* Row 4: AR (compact) + ShirleyCRE Agent Card */}
            <div className="card-reveal card-reveal-6">
              <AccountsReceivablePanel />
            </div>
            <div className="card-reveal card-reveal-7">
              <ShirleyCREAgentCard />
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  )
}
