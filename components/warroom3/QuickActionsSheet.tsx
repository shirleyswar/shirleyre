'use client'

// §18 Quick Actions sheet — FAB's sheet, Item 150 P1
// Short sheet (47% height, top:112px via size="short").
// Row order (bottom-anchored — thumb reach): Task · Event · Voice Note · Money Mover.
// All type references bound to §3.2 named levels. No pixel literals for text.

import React from 'react'
import { Mic, CheckSquare, Calendar, DollarSign } from 'lucide-react'
import BottomSheet from '@/components/warroom3/BottomSheet'

// §3.1: UPPERCASE → JetBrains Mono · sentence case → Space Grotesk
const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO    = "'JetBrains Mono', ui-monospace, monospace"

const T = {
  textHi:    '#EFEEF4',
  textMid:   '#B8B6C6',
  textLow:   '#8E8CA0',
  brand:     '#8B5CF6',
  brandLift: '#A78BFA',
  bgRaise:   '#1E1D26',
} as const

// T4 §3.2 — 14px / 400 / sentence / text-mid (44a type scale)
const styleT4: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 14,
  fontWeight: 400,
  color: T.textMid,
  lineHeight: 1.5,
}

// TYPE_TUNE_INPUTS — T3 per §18.2 locked 13 Aug (was 17/15 pre-Type Tune)
// 44a type scale: T3 = 18px
const VOICE_NOTE_TITLE_SIZE = 18   // §18.2 Voice Note row title — T3 (44a)
const ACTION_TITLE_SIZE = 18       // §18.2 Task/Event row title — T3 (44a)

interface ActionRowProps {
  icon: React.ReactNode
  title: string
  subtitle: string
  titleSize: number
  iconTileSize: number
  verticalPadding: number
  iconPlate?: string
  onPress: () => void
}

function ActionRow({
  icon,
  title,
  subtitle,
  titleSize,
  iconTileSize,
  verticalPadding,
  iconPlate,
  onPress,
}: ActionRowProps) {
  return (
    <button
      onClick={onPress}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: `${verticalPadding}px 18px`,
        textAlign: 'left',
        WebkitTapHighlightColor: 'transparent',
        minHeight: 44,
      } as React.CSSProperties}
    >
      {/* Icon tile */}
      <div style={{
        width: iconTileSize,
        height: iconTileSize,
        borderRadius: 10,
        background: iconPlate ?? 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.14)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      {/* Labels */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Title — VOICE_NOTE_TITLE_SIZE or ACTION_TITLE_SIZE per §18.2 */}
        <div style={{
          fontFamily: FONT_DISPLAY,
          fontSize: titleSize,
          fontWeight: 500,
          color: T.textHi,
          lineHeight: 1.2,
        }}>{title}</div>
        {/* T4 subline naming destination */}
        <div style={{ ...styleT4, marginTop: 2 }}>{subtitle}</div>
      </div>
    </button>
  )
}

interface QuickActionsSheetProps {
  open: boolean
  onClose: () => void
  onOpenVoiceNote: () => void
  onOpenTask?: () => void
  onOpenEvent?: () => void
  onOpenMoneyMover?: () => void
}

export default function QuickActionsSheet({ open, onClose, onOpenVoiceNote, onOpenTask, onOpenEvent, onOpenMoneyMover }: QuickActionsSheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label="Quick Actions"
      size="list"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, paddingTop: 4 }}>
        {/* 1. Task — top slot (thumb scrolls to bottom, so top is deprioritized) */}
        <ActionRow
          icon={<CheckSquare size={18} color={T.textMid} strokeWidth={1.8} />}
          title="Task"
          subtitle="Opens here"
          titleSize={ACTION_TITLE_SIZE}
          iconTileSize={38}
          verticalPadding={15}
          onPress={() => { onClose(); setTimeout(() => onOpenTask?.(), 180) }}
        />

        {/* 2. Event */}
        <ActionRow
          icon={<Calendar size={18} color={T.textMid} strokeWidth={1.8} />}
          title="Event"
          subtitle="Opens here"
          titleSize={ACTION_TITLE_SIZE}
          iconTileSize={38}
          verticalPadding={15}
          onPress={() => { onClose(); setTimeout(() => onOpenEvent?.(), 180) }}
        />

        {/* 3. Voice Note — bottom-anchored, physically larger, closest to thumb */}
        <ActionRow
          icon={<Mic size={20} color={T.brandLift} strokeWidth={1.8} />}
          title="Voice Note"
          subtitle="Dictate — field opens ready"
          titleSize={VOICE_NOTE_TITLE_SIZE}
          iconTileSize={44}
          verticalPadding={20}
          iconPlate="rgba(139,92,246,0.16)"
          onPress={() => { onClose(); setTimeout(onOpenVoiceNote, 180) }}
        />

        {/* 4. Money Mover — bottom, opens MoneyMoverAddSheet */}
        <ActionRow
          icon={<DollarSign size={18} color={T.textMid} strokeWidth={1.8} />}
          title="Money Mover"
          subtitle="Opens here"
          titleSize={ACTION_TITLE_SIZE}
          iconTileSize={38}
          verticalPadding={15}
          onPress={() => { onClose(); setTimeout(() => onOpenMoneyMover?.(), 180) }}
        />
      </div>
    </BottomSheet>
  )
}
