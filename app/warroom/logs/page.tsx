'use client'
/**
 * /warroom/logs — §D12 FULL LOGS PAGE (163 Item 5)
 * Tabs: TASKS · MONEY MOVERS · DEALS
 * Totals band: 68px fixed bottom
 * Violet REOPEN PIN gate (DEALS only functional; TASKS/MOVERS inert)
 */

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { motion } from 'framer-motion'

const SUPA_URL = 'https://mtkyyaorvensylrfbhxv.supabase.co'
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10a3l5YW9ydmVuc3lscmZiaHh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTU0OTUsImV4cCI6MjA4ODc3MTQ5NX0.YqyuBjymYf26cA6JF534NVmsTmdMv7ohB1LBCmdsaJA'
const supabase = createClient(SUPA_URL, SUPA_ANON)

const C = {
  bgBase: '#0A0A0F',
  bgRail: '#0D0D14',
  bgPanel: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.09)',
  borderHair: 'rgba(255,255,255,0.06)',
  brandLift: '#A78BFA',
  brandStrong: '#7C3AED',
  textHi: '#EFEEF4',
  textMid: '#A09EB8',
  textLow: '#6B6980',
  moneyIn: '#4ADE80',
}
const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace"
const FONT_DISP = "var(--font-space-grotesk), 'Space Grotesk', system-ui, sans-serif"

// ── Plate map ────────────────────────────────────────────────────────────────
const PLATE_MAP: Record<string, string> = {
  sale:       '/assets/plates/plate-sale-v7.png',
  retail:     '/assets/plates/plate-retail-v7.png',
  lease:      '/assets/plates/plate-lease-v7.png',
  industrial: '/assets/plates/plate-indst-v7.png',
  office:     '/assets/plates/plate-office-v7.png',
  land:       '/assets/plates/plate-land-v7.png',
  multifamily:'/assets/plates/plate-multi-v7.png',
  multi:      '/assets/plates/plate-multi-v7.png',
}
function plateSrc(propertyType: string | null | undefined): string | null {
  if (!propertyType) return null
  const key = propertyType.toLowerCase().replace(/[_\s-]/g, '')
  for (const [k, v] of Object.entries(PLATE_MAP)) {
    if (key.includes(k)) return v
  }
  return null
}

// ── Date formatter ────────────────────────────────────────────────────────────
function fmtLogDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  const mon = months[d.getMonth()]
  const day = d.getDate()
  const h = d.getHours()
  const m = d.getMinutes()
  const pad = (n: number) => String(n).padStart(2,'0')
  return `${mon} ${day} · ${pad(h)}:${pad(m)}`
}

// ── Money formatter ───────────────────────────────────────────────────────────
function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `$${(abs/1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${Math.round(abs/1_000)}K`
  return `$${Math.round(abs).toLocaleString()}`
}

// ── LeftRail ─────────────────────────────────────────────────────────────────
const RAIL_LOGS_SVG = `<rect x="5.4" y="4" width="13.2" height="16"/><path d="M8.6 8.4h7M8.6 12h7M8.6 15.6h4.2"/>`
const RAIL_SET_SVG  = `<path d="M3.4 8.6h4M13 8.6h7.6M3.4 15.4h7.1M16.1 15.4h4.5"/><circle cx="10.1" cy="8.6" r="2.6"/><circle cx="13.3" cy="15.4" r="2.6"/>`

type RailId = 'HOME'|'DEALS'|'SCHED'|'DEADLINES'|'MONEY'|'PORTF'|'ENTITY'|'PEOPLE'|'LOGS'|'SET'
const TOP_SLOTS: { id: RailId; label: string; href: string; svgInner: string }[] = [
  { id:'HOME',      label:'HOME',      href:'/warroom',          svgInner:`<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>` },
  { id:'DEALS',     label:'DEALS',     href:'/warroom/deals',    svgInner:`<rect x="3.5" y="4" width="17" height="10" rx="1.5"/><path d="M12 14v7M7 7.8h6M7 10.8h9"/>` },
  { id:'SCHED',     label:'SCHED',     href:'/warroom',          svgInner:`<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>` },
  { id:'DEADLINES', label:'DEADLINES', href:'/warroom',          svgInner:`<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>` },
  { id:'MONEY',     label:'MONEY',     href:'/warroom',          svgInner:`<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>` },
  { id:'PORTF',     label:'PORTF',     href:'/warroom',          svgInner:`<path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z"/><path d="M3 12.5 12 17l9-4.5"/><path d="M3 17 12 21.5l9-4.5"/>` },
  { id:'ENTITY',    label:'ENTITY',    href:'/warroom',          svgInner:`<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/>` },
  { id:'PEOPLE',    label:'PEOPLE',    href:'/warroom/contacts', svgInner:`<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.4 2.7-5.6 6-5.6s6 2.2 6 5.6"/><path d="M16 5.4a3.2 3.2 0 0 1 0 6M17.5 14.9c2.1.6 3.5 2.4 3.5 5.1"/>` },
]
const LOGS_SLOT = { id:'LOGS' as RailId, label:'LOGS', href:'/warroom/logs', svgInner: RAIL_LOGS_SVG }
const SET_SLOT  = { id:'SET'  as RailId, label:'SET',  href:'/warroom',      svgInner: RAIL_SET_SVG  }

function LeftRail({ active }: { active: RailId }) {
  const router = useRouter()
  function Slot({ s }: { s: typeof TOP_SLOTS[0] }) {
    const act = s.id === active
    const color = act ? C.brandLift : C.textLow
    return (
      <button onClick={() => router.push(s.href)} style={{
        width:76, padding:'13px 0', borderRadius:10, border:'none',
        background: act ? 'rgba(139,92,246,0.14)' : 'transparent',
        display:'flex', flexDirection:'column', alignItems:'center', gap:7,
        cursor:'pointer', color,
      }}>
        <span style={{ color, display:'flex', alignItems:'center', justifyContent:'center' }}
          dangerouslySetInnerHTML={{ __html:`<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${s.svgInner}</svg>` }}
        />
        <span style={{ fontFamily:FONT_MONO, fontSize:11, fontWeight:500, letterSpacing:'0.08em', lineHeight:'15px', color, textTransform:'uppercase' }}>{s.label}</span>
      </button>
    )
  }
  return (
    <div style={{
      width:96, flexShrink:0, height:'100%', background:C.bgRail,
      borderRight:`1px solid ${C.border}`,
      display:'flex', flexDirection:'column', alignItems:'center',
      paddingTop:13, boxSizing:'border-box',
    }}>
      {TOP_SLOTS.map(s => <Slot key={s.id} s={s} />)}
      <div style={{ flex:1 }} />
      <Slot s={LOGS_SLOT} />
      <Slot s={SET_SLOT} />
      <div style={{ height:8 }} />
    </div>
  )
}

// ── Violet REOPEN Gate ────────────────────────────────────────────────────────
interface ReopenGateProps {
  dealId: string
  label: string
  onClose: () => void
  onSuccess: () => void
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('')
}

const PIN_HASH_EXPECTED = (async () => sha256('1887'))()

function ReopenGate({ dealId, label, onClose, onSuccess }: ReopenGateProps) {
  const [digits, setDigits] = useState<string[]>([])
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleKey = useCallback(async (key: string) => {
    if (error || submitting) return
    if (key === 'C') { setDigits([]); return }
    if (key === '⌫') { setDigits(d => d.slice(0, -1)); return }
    if (digits.length >= 4) return

    const next = [...digits, key]
    setDigits(next)

    if (next.length === 4) {
      const pin = next.join('')
      const hash = await sha256(pin)
      const expected = await PIN_HASH_EXPECTED
      if (hash === expected) {
        setSubmitting(true)
        await supabase.from('deals').update({ status: 'active' }).eq('id', dealId)
        onSuccess()
      } else {
        setShake(true)
        setError(true)
        setTimeout(() => { setShake(false); setError(false); setDigits([]) }, 650)
      }
    }
  }, [digits, error, submitting, dealId, onSuccess])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handleKey(e.key)
      else if (e.key === 'Backspace') handleKey('⌫')
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleKey, onClose])

  return (
    <div
      style={{ position:'fixed', inset:0, zIndex:500, background:'rgba(5,5,9,0.92)',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/star-glow-512.png" alt="" width={148} height={148} style={{ display:'block' }} />
      <div style={{ height:20 }} />
      <div style={{ fontFamily:FONT_MONO, fontSize:11, fontWeight:500, letterSpacing:'0.42em',
        paddingLeft:'0.42em', color:C.brandLift, textTransform:'uppercase' }}>WAR ROOM</div>
      <div style={{ height:12 }} />
      <div style={{ fontFamily:FONT_MONO, fontSize:11, fontWeight:500, letterSpacing:'0.16em',
        color:C.textMid, textTransform:'uppercase', textAlign:'center', maxWidth:400 }}>
        REOPEN · {label}
      </div>
      <div style={{ height:32 }} />
      <motion.div
        animate={shake ? { x:[-6,6,-6,6,-4,4,0] } : {}}
        transition={{ duration:0.26 }}
        style={{ display:'flex', gap:12 }}
      >
        {[0,1,2,3].map(i => {
          const filled = i < digits.length
          const isActive = i === digits.length && !error
          return (
            <div key={i} style={{
              width:56, height:66, borderRadius:12,
              background: filled ? '#EFEEF4' : 'rgba(167,139,250,0.07)',
              border: error ? '1px solid #A78BFA' : isActive ? '1px solid #A78BFA' : '1px solid rgba(167,139,250,0.25)',
              boxShadow: isActive ? '0 0 20px rgba(167,139,250,0.35)' : error ? '0 0 16px rgba(167,139,250,0.35)' : 'none',
              display:'flex', alignItems:'center', justifyContent:'center',
              transition:'border-color 0.15s, box-shadow 0.15s',
            }}>
              {filled && (
                <div style={{ width:12, height:12, borderRadius:'50%', background:'#0A0A0F' }} />
              )}
            </div>
          )
        })}
      </motion.div>
      <div style={{ height:24 }} />
      <div style={{ fontFamily:FONT_MONO, fontSize:11, fontWeight:500, letterSpacing:'0.24em',
        color:C.textLow, textTransform:'uppercase' }}>
        {submitting ? 'REOPENING…' : 'ENTER PIN'}
      </div>
    </div>
  )
}

// ── Inert REOPEN pill ─────────────────────────────────────────────────────────
function InertReopen() {
  return (
    <div style={{
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      padding:'3px 10px', borderRadius:20,
      border:`1px solid rgba(167,139,250,0.35)`,
      fontFamily:FONT_MONO, fontSize:10, fontWeight:600, letterSpacing:'0.12em',
      color:C.brandLift, textTransform:'uppercase', userSelect:'none',
      cursor:'default',
    }}>REOPEN</div>
  )
}

// ── Column header row ─────────────────────────────────────────────────────────
function ColHeaders({ tab }: { tab: string }) {
  const baseStyle: React.CSSProperties = {
    fontFamily:FONT_MONO, fontSize:10, fontWeight:600, letterSpacing:'0.14em',
    color:C.textLow, textTransform:'uppercase', whiteSpace:'nowrap',
    display:'flex', alignItems:'center',
  }
  if (tab === 'tasks') return (
    <div style={{ height:36, flexShrink:0, display:'flex', alignItems:'center',
      borderBottom:`1px solid ${C.borderHair}`, padding:'0 24px', gap:0 }}>
      <div style={{ ...baseStyle, flex:1 }}>TASK</div>
      <div style={{ ...baseStyle, width:280 }}>DEAL</div>
      <div style={{ ...baseStyle, width:160 }}>LOGGED</div>
      <div style={{ ...baseStyle, width:64 }}>NOTES</div>
      <div style={{ ...baseStyle, width:72, justifyContent:'center' }}>REOPEN</div>
    </div>
  )
  if (tab === 'money-movers') return (
    <div style={{ height:36, flexShrink:0, display:'flex', alignItems:'center',
      borderBottom:`1px solid ${C.borderHair}`, padding:'0 24px', gap:0 }}>
      <div style={{ ...baseStyle, flex:1 }}>ITEM</div>
      <div style={{ ...baseStyle, width:210 }}>CLIENT</div>
      <div style={{ ...baseStyle, width:150, justifyContent:'flex-end' }}>COMM</div>
      <div style={{ ...baseStyle, width:160, paddingLeft:16 }}>LOGGED</div>
      <div style={{ ...baseStyle, width:64 }}>NOTES</div>
      <div style={{ ...baseStyle, width:72, justifyContent:'center' }}>REOPEN</div>
    </div>
  )
  // deals
  return (
    <div style={{ height:36, flexShrink:0, display:'flex', alignItems:'center',
      borderBottom:`1px solid ${C.borderHair}`, padding:'0 24px', gap:0 }}>
      <div style={{ ...baseStyle, flex:1 }}>ADDRESS</div>
      <div style={{ ...baseStyle, width:210 }}>CLIENT</div>
      <div style={{ ...baseStyle, width:150, justifyContent:'flex-end' }}>VALUE</div>
      <div style={{ ...baseStyle, width:150, justifyContent:'flex-end' }}>COMM</div>
      <div style={{ ...baseStyle, width:160, paddingLeft:16 }}>CLOSED</div>
      <div style={{ ...baseStyle, width:72, justifyContent:'center' }}>REOPEN</div>
    </div>
  )
}

// ── Type declarations ─────────────────────────────────────────────────────────
interface TaskRow {
  id: string
  title: string
  completed_at: string | null
  deal_id: string | null
  deals: { addr_display: string | null; addr_street_name: string | null } | null
}
interface MMRow {
  id: string
  title: string
  commission: number | null
  logged_at: string | null
  note: string | null
  deal_id: string | null
  deals: { name: string | null; addr_display: string | null } | null
}
interface DealRow {
  id: string
  addr_display: string | null
  addr_street_name: string | null
  status: string
  updated_at: string | null
  property_type: string | null
  deal_contacts: { contacts: { name: string | null } | null }[] | null
  deal_economics: { asking_price: number | null; commission_estimated: number | null }[] | null
}

// ── Main inner component (uses useSearchParams) ───────────────────────────────
function LogsInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab') ?? 'tasks'
  const activeTab = ['tasks','money-movers','deals'].includes(tabParam) ? tabParam : 'tasks'

  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const isCurrentYear = year === currentYear

  // Data states
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [movers, setMovers] = useState<MMRow[]>([])
  const [deals, setDeals] = useState<DealRow[]>([])
  const [loading, setLoading] = useState(false)

  // Reopen gate state
  const [reopenDeal, setReopenDeal] = useState<{ id:string; label:string } | null>(null)

  function setTab(t: string) {
    router.push(`/warroom/logs?tab=${t}`)
  }

  // Fetch data when tab or year changes
  useEffect(() => {
    setLoading(true)
    const yearStart = `${year}-01-01T00:00:00.000Z`
    const yearEnd   = `${year}-12-31T23:59:59.999Z`

    if (activeTab === 'tasks') {
      supabase
        .from('tasks')
        .select('id,title,status,completed_at,deal_id,deals(addr_display,addr_street_name)')
        .eq('status','completed')
        .gte('completed_at', yearStart)
        .lte('completed_at', yearEnd)
        .order('completed_at', { ascending:false })
        .then(({ data, error }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (!error && data) setTasks(data as unknown as TaskRow[])
          setLoading(false)
        })
    } else if (activeTab === 'money-movers') {
      supabase
        .from('money_movers')
        .select('id,title,commission,logged_at,note,deal_id,deals(name,addr_display)')
        .not('logged_at','is',null)
        .gte('logged_at', yearStart)
        .lte('logged_at', yearEnd)
        .order('commission', { ascending:false })
        .then(({ data, error }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (!error && data) setMovers(data as unknown as MMRow[])
          setLoading(false)
        })
    } else {
      // 163C.1: closed_at column does not exist in DB; do NOT year-gate on updated_at
      // (updated_at is last-touched, not close date — year-gating on it drops closed deals
      // whose last update falls outside the selected year). Show all status=closed deals;
      // YEAR selector still meaningful for TASKS/MONEY-MOVERS tabs.
      // Chosen close-timestamp field: updated_at (best available; closed_at absent).
      supabase
        .from('deals')
        .select('id,addr_display,addr_street_name,status,updated_at,property_type,deal_contacts(contacts(name)),deal_economics(asking_price,commission_estimated)')
        .eq('status','closed')
        .order('updated_at', { ascending:false })
        .then(({ data, error }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (!error && data) setDeals(data as unknown as DealRow[])
          setLoading(false)
        })
    }
  }, [activeTab, year])

  // ── Totals ────────────────────────────────────────────────────────────────
  const taskCount = tasks.length
  const mmCount   = movers.length
  const mmCommTotal = movers.reduce((s, m) => s + (m.commission ?? 0), 0)
  const dealCount = deals.length
  const dealValueTotal = deals.reduce((s, d) => {
    const econ = Array.isArray(d.deal_economics) ? d.deal_economics[0] : d.deal_economics
    return s + (econ?.asking_price ?? 0)
  }, 0)
  const dealCommTotal = deals.reduce((s, d) => {
    const econ = Array.isArray(d.deal_economics) ? d.deal_economics[0] : d.deal_economics
    return s + (econ?.commission_estimated ?? 0)
  }, 0)

  // ── Render ────────────────────────────────────────────────────────────────
  const TABS = [
    { key:'tasks',        label:'TASKS' },
    { key:'money-movers', label:'MONEY MOVERS' },
    { key:'deals',        label:'DEALS' },
  ]

  // Body height = 1080 − 112(identity) − 62(tab band) − 36(col header) − 68(totals) = 802px
  // But we don't control identity strip height here; use flex-1 for body, 68px totals fixed
  const ROW_H = 46
  const BODY_H = 802

  function TasksBody() {
    if (loading) return <EmptyMsg msg="LOADING…" />
    if (!tasks.length) return <EmptyMsg msg="NO COMPLETED TASKS THIS YEAR" />
    return (
      <>
        {tasks.map((t, i) => {
          const deal = t.deals
          return (
            <div key={t.id} style={{
              height:ROW_H, flexShrink:0, display:'flex', alignItems:'center',
              padding:'0 24px',
              borderBottom:`1px solid ${C.borderHair}`,
              // INERT — no cursor, no hover wash
            }}>
              {/* TASK */}
              <div style={{ flex:1, overflow:'hidden', paddingRight:12 }}>
                <div style={{ fontFamily:FONT_DISP, fontSize:14, color:C.textHi,
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.title}</div>
                {deal && (
                  <div style={{ fontFamily:FONT_DISP, fontSize:12, color:C.textLow,
                    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginTop:1 }}>
                    {deal.addr_display ?? deal.addr_street_name ?? ''}
                  </div>
                )}
              </div>
              {/* DEAL */}
              <div style={{ width:280, overflow:'hidden', paddingRight:12 }}>
                {deal && (
                  <span style={{ fontFamily:FONT_DISP, fontSize:13, color:C.textMid,
                    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {deal.addr_display ?? deal.addr_street_name ?? ''}
                  </span>
                )}
              </div>
              {/* LOGGED */}
              <div style={{ width:160 }}>
                <span style={{ fontFamily:FONT_MONO, fontSize:11, color:C.textMid }}>
                  {fmtLogDate(t.completed_at)}
                </span>
              </div>
              {/* NOTES */}
              <div style={{ width:64 }}>
                <span style={{ fontFamily:FONT_MONO, fontSize:11, color:C.textMid }}>0</span>
              </div>
              {/* REOPEN — inert */}
              <div style={{ width:72, display:'flex', justifyContent:'center' }}>
                <InertReopen />
              </div>
            </div>
          )
        })}
      </>
    )
  }

  function MoversBody() {
    if (loading) return <EmptyMsg msg="LOADING…" />
    if (!movers.length) return <EmptyMsg msg="NO LOGGED COMMISSIONS THIS YEAR" />
    return (
      <>
        {movers.map((m) => {
          const deal = m.deals
          return (
            <div key={m.id} style={{
              height:ROW_H, flexShrink:0, display:'flex', alignItems:'center',
              padding:'0 24px',
              borderBottom:`1px solid ${C.borderHair}`,
              // INERT
            }}>
              {/* ITEM */}
              <div style={{ flex:1, overflow:'hidden', paddingRight:12 }}>
                <span style={{ fontFamily:FONT_DISP, fontSize:14, color:C.textHi,
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{m.title}</span>
              </div>
              {/* CLIENT */}
              <div style={{ width:210, overflow:'hidden', paddingRight:12 }}>
                {deal?.name && (
                  <span style={{ fontFamily:FONT_DISP, fontSize:13, color:C.textMid,
                    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {deal.name}
                  </span>
                )}
              </div>
              {/* COMM */}
              <div style={{ width:150, textAlign:'right' }}>
                <span style={{ fontFamily:FONT_MONO, fontSize:13, color:C.moneyIn, fontWeight:600 }}>
                  {fmtMoney(m.commission)}
                </span>
              </div>
              {/* LOGGED */}
              <div style={{ width:160, paddingLeft:16 }}>
                <span style={{ fontFamily:FONT_MONO, fontSize:11, color:C.textMid }}>
                  {fmtLogDate(m.logged_at)}
                </span>
              </div>
              {/* NOTES */}
              <div style={{ width:64 }}>
                <span style={{ fontFamily:FONT_MONO, fontSize:11, color:C.textMid }}>
                  {m.note ? 1 : 0}
                </span>
              </div>
              {/* REOPEN — inert */}
              <div style={{ width:72, display:'flex', justifyContent:'center' }}>
                <InertReopen />
              </div>
            </div>
          )
        })}
      </>
    )
  }

  function DealsBody() {
    if (loading) return <EmptyMsg msg="LOADING…" />
    if (!deals.length) return <EmptyMsg msg="NO CLOSED DEALS" />
    return (
      <>
        {deals.map((d) => {
          const contactsArr = Array.isArray(d.deal_contacts) ? d.deal_contacts : []
          const clientName = contactsArr[0]?.contacts?.name ?? ''
          const econArr = Array.isArray(d.deal_economics) ? d.deal_economics : []
          const econ = econArr[0] ?? null
          const addrLabel = d.addr_display ?? d.addr_street_name ?? ''
          const plate = plateSrc(d.property_type)
          const canReopen = isCurrentYear

          return (
            <div key={d.id}
              onClick={() => router.push('/warroom/deal/?id=' + d.id)}
              style={{
                height:ROW_H, flexShrink:0, display:'flex', alignItems:'center',
                padding:'0 24px',
                borderBottom:`1px solid ${C.borderHair}`,
                cursor:'pointer',
              }}
            >
              {/* ADDRESS + plate */}
              <div style={{ flex:1, overflow:'hidden', paddingRight:12, display:'flex', alignItems:'center', gap:10 }}>
                {plate && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={plate} alt="" style={{ height:26, width:'auto', flexShrink:0 }} />
                )}
                <span style={{ fontFamily:FONT_DISP, fontSize:14, color:C.textHi,
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {addrLabel}
                </span>
              </div>
              {/* CLIENT */}
              <div style={{ width:210, overflow:'hidden', paddingRight:12 }}>
                <span style={{ fontFamily:FONT_DISP, fontSize:13, color:C.textMid,
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {clientName}
                </span>
              </div>
              {/* VALUE */}
              <div style={{ width:150, textAlign:'right' }}>
                <span style={{ fontFamily:FONT_MONO, fontSize:13, color:C.textHi }}>
                  {fmtMoney(econ?.asking_price ?? null)}
                </span>
              </div>
              {/* COMM */}
              <div style={{ width:150, textAlign:'right' }}>
                <span style={{ fontFamily:FONT_MONO, fontSize:13, color:C.moneyIn, fontWeight:600 }}>
                  {fmtMoney(econ?.commission_estimated ?? null)}
                </span>
              </div>
              {/* CLOSED */}
              <div style={{ width:160, paddingLeft:16 }}>
                <span style={{ fontFamily:FONT_MONO, fontSize:11, color:C.textMid }}>
                  {fmtLogDate(d.updated_at)}
                </span>
              </div>
              {/* REOPEN */}
              <div style={{ width:72, display:'flex', justifyContent:'center' }}
                onClick={e => {
                  e.stopPropagation()
                  if (canReopen) setReopenDeal({ id:d.id, label:addrLabel })
                }}>
                <div style={{
                  display:'inline-flex', alignItems:'center', justifyContent:'center',
                  padding:'3px 10px', borderRadius:20,
                  border:`1px solid rgba(167,139,250,${canReopen ? '0.55' : '0.2'})`,
                  fontFamily:FONT_MONO, fontSize:10, fontWeight:600, letterSpacing:'0.12em',
                  color: canReopen ? C.brandLift : C.textLow,
                  textTransform:'uppercase' as const, userSelect:'none' as const,
                  cursor: canReopen ? 'pointer' : 'default',
                  opacity: canReopen ? 1 : 0.4,
                }}>REOPEN</div>
              </div>
            </div>
          )
        })}
      </>
    )
  }

  // ── Totals band ───────────────────────────────────────────────────────────
  function TotalsBand() {
    const labelStyle: React.CSSProperties = {
      fontFamily:FONT_MONO, fontSize:11, fontWeight:500, letterSpacing:'0.10em',
      color:C.textLow, textTransform:'uppercase', lineHeight:'14px',
    }
    const figStyle: React.CSSProperties = {
      fontFamily:FONT_MONO, fontSize:20, fontWeight:600, color:C.textHi,
      lineHeight:'24px', marginTop:7,
    }
    const moneyFigStyle: React.CSSProperties = { ...figStyle, color:C.moneyIn }

    if (activeTab === 'tasks') return (
      <div style={{
        height:68, flexShrink:0, background:C.bgPanel,
        borderTop:`1px solid ${C.borderHair}`,
        display:'flex', alignItems:'center', padding:'0 24px',
      }}>
        {/* COUNT aligned with TASK column (flex) */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center' }}>
          <div style={labelStyle}>{taskCount === 1 ? '1 TASK' : `${taskCount} TASKS`}</div>
          <div style={figStyle}>{taskCount}</div>
        </div>
        {/* DEAL 280px */}
        <div style={{ width:280 }} />
        {/* LOGGED 160px */}
        <div style={{ width:160 }} />
        {/* NOTES 64px */}
        <div style={{ width:64 }} />
        {/* REOPEN 72px */}
        <div style={{ width:72 }} />
      </div>
    )

    if (activeTab === 'money-movers') return (
      <div style={{
        height:68, flexShrink:0, background:C.bgPanel,
        borderTop:`1px solid ${C.borderHair}`,
        display:'flex', alignItems:'center', padding:'0 24px',
      }}>
        {/* COUNT — ITEM column */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center' }}>
          <div style={labelStyle}>{mmCount === 1 ? '1 MOVER' : `${mmCount} MOVERS`}</div>
          <div style={figStyle}>{mmCount}</div>
        </div>
        {/* CLIENT 210px */}
        <div style={{ width:210 }} />
        {/* COMM 150px — right-aligned */}
        <div style={{ width:150, display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'flex-end' }}>
          <div style={labelStyle}>TOTAL COMM</div>
          <div style={moneyFigStyle}>{fmtMoney(mmCommTotal || null)}</div>
        </div>
        {/* LOGGED 160px — label only */}
        <div style={{ width:160, paddingLeft:16, display:'flex', flexDirection:'column', justifyContent:'center' }}>
          <div style={labelStyle}>LOGGED</div>
        </div>
        {/* NOTES 64px */}
        <div style={{ width:64 }} />
        {/* REOPEN 72px */}
        <div style={{ width:72 }} />
      </div>
    )

    // deals
    return (
      <div style={{
        height:68, flexShrink:0, background:C.bgPanel,
        borderTop:`1px solid ${C.borderHair}`,
        display:'flex', alignItems:'center', padding:'0 24px',
      }}>
        {/* COUNT — ADDRESS column */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center' }}>
          <div style={labelStyle}>{dealCount === 1 ? '1 DEAL' : `${dealCount} DEALS`}</div>
          <div style={figStyle}>{dealCount}</div>
        </div>
        {/* CLIENT 210px */}
        <div style={{ width:210 }} />
        {/* VALUE 150px — right-aligned */}
        <div style={{ width:150, display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'flex-end' }}>
          <div style={labelStyle}>TOTAL VALUE</div>
          <div style={figStyle}>{fmtMoney(dealValueTotal || null)}</div>
        </div>
        {/* COMM 150px — right-aligned */}
        <div style={{ width:150, display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'flex-end' }}>
          <div style={labelStyle}>TOTAL COMM</div>
          <div style={moneyFigStyle}>{fmtMoney(dealCommTotal || null)}</div>
        </div>
        {/* CLOSED 160px */}
        <div style={{ width:160 }} />
        {/* REOPEN 72px */}
        <div style={{ width:72 }} />
      </div>
    )
  }

  return (
    <div style={{ display:'flex', height:'100vh', background:C.bgBase, overflow:'hidden' }}>
      <LeftRail active="LOGS" />
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>

        {/* ── Tab band (62px) ──────────────────────────────────────────────── */}
        <div style={{
          height:62, flexShrink:0, display:'flex', alignItems:'center',
          borderBottom:`1px solid ${C.border}`, padding:'0 24px',
          justifyContent:'space-between',
        }}>
          {/* Tab buttons */}
          <div style={{ display:'flex', alignItems:'center', height:'100%' }}>
            {TABS.map((t, i) => {
              const isActive = t.key === activeTab
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  style={{
                    height:'100%',
                    padding:'0 22px',
                    background:'none', border:'none',
                    borderRight: i < TABS.length - 1 ? `1px solid ${C.borderHair}` : 'none',
                    fontFamily:FONT_MONO, fontSize:17, fontWeight:500, letterSpacing:'0.16em',
                    textTransform:'uppercase',
                    color: isActive ? C.textHi : C.textLow,
                    cursor:'pointer',
                    borderBottom: isActive ? `2px solid ${C.brandLift}` : '2px solid transparent',
                    boxSizing:'border-box',
                  }}
                >{t.label}</button>
              )
            })}
          </div>

          {/* YEAR selector */}
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2, paddingRight:8, cursor:'pointer' }}>
            <span style={{ fontFamily:FONT_MONO, fontSize:11, color:C.textLow, letterSpacing:'0.10em' }}>YEAR</span>
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              <span style={{ fontFamily:FONT_MONO, fontSize:15, color:C.textMid, fontWeight:500 }}>{year}</span>
              <span style={{ fontFamily:FONT_MONO, fontSize:11, color:C.textLow }}>▾</span>
              <select
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                style={{
                  position:'absolute', opacity:0, width:60, height:30, cursor:'pointer',
                }}
                aria-label="Select year"
              >
                {[currentYear, currentYear-1, currentYear-2].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Column headers (36px) ───────────────────────────────────────── */}
        <ColHeaders tab={activeTab} />

        {/* ── Scrollable body ─────────────────────────────────────────────── */}
        <div style={{ flex:1, overflowY:'auto', overflowX:'hidden', minHeight:0 }}>
          {activeTab === 'tasks'        && <TasksBody />}
          {activeTab === 'money-movers' && <MoversBody />}
          {activeTab === 'deals'        && <DealsBody />}
        </div>

        {/* ── Totals band (68px) ──────────────────────────────────────────── */}
        <TotalsBand />
      </div>

      {/* ── Violet REOPEN gate ───────────────────────────────────────────── */}
      {reopenDeal && (
        <ReopenGate
          dealId={reopenDeal.id}
          label={reopenDeal.label}
          onClose={() => setReopenDeal(null)}
          onSuccess={() => {
            setReopenDeal(null)
            router.push('/warroom/deals')
          }}
        />
      )}
    </div>
  )
}

function EmptyMsg({ msg }: { msg: string }) {
  return (
    <div style={{ height:802, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <span style={{ fontFamily:FONT_MONO, fontSize:11, color:C.textLow, letterSpacing:'0.10em' }}>{msg}</span>
    </div>
  )
}

export default function LogsPage() {
  return (
    <Suspense fallback={
      <div style={{ display:'flex', height:'100vh', background:'#0A0A0F', alignItems:'center', justifyContent:'center' }}>
        <span style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:11, color:'#6B6980' }}>LOADING…</span>
      </div>
    }>
      <LogsInner />
    </Suspense>
  )
}
