'use client'
/**
 * /warroom/logs — 160 stub
 * Minimal page proving the route. Default tab: tasks (by name).
 * Full §D12 LOGS page = Item 5 / kit 163 — do NOT build here.
 */

import { useRouter } from 'next/navigation'

const C = {
  bgBase: '#0A0A0F',
  bgRail: '#0D0D14',
  border: 'rgba(255,255,255,0.09)',
  borderHair: 'rgba(255,255,255,0.06)',
  brandLift: '#A78BFA',
  textHi: '#EFEEF4',
  textMid: '#A09EB8',
  textLow: '#6B6980',
  brandStrong: '#7C3AED',
}
const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace"
const FONT_DISP = "var(--font-space-grotesk), 'Space Grotesk', system-ui, sans-serif"

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

// Default tab: tasks (by name, not index)
const TABS = ['tasks', 'deals', 'commissions'] as const
type Tab = typeof TABS[number]

export default function LogsPage() {
  return (
    <div style={{ display:'flex', height:'100vh', background:C.bgBase, overflow:'hidden' }}>
      <LeftRail active="LOGS" />
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* Minimal tab band — default tab: tasks */}
        <div style={{
          height:48, flexShrink:0, display:'flex', alignItems:'flex-end',
          borderBottom:`1px solid ${C.border}`, padding:'0 32px', gap:0,
        }}>
          {TABS.map(tab => {
            const isActive = tab === 'tasks'
            return (
              <div key={tab} style={{
                padding:'0 18px', height:48, display:'flex', alignItems:'center',
                borderBottom: isActive ? `2px solid ${C.brandStrong}` : '2px solid transparent',
                fontFamily:FONT_MONO, fontSize:11, fontWeight:isActive ? 600 : 500,
                letterSpacing:'0.10em', textTransform:'uppercase',
                color: isActive ? C.textHi : C.textLow,
                cursor:'default',
              }}>
                {tab}
              </div>
            )
          })}
        </div>
        {/* Stub body */}
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <span style={{ fontFamily:FONT_MONO, fontSize:12, color:C.textLow, letterSpacing:'0.10em' }}>
            LOGS — COMING IN ITEM 5
          </span>
        </div>
      </div>
    </div>
  )
}
