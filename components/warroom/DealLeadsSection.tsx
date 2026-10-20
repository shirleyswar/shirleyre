'use client'

import React, { useEffect, useState } from 'react'
import CalendarPicker from '@/components/warroom3/CalendarPicker'
import { FAB_APERTURE_GRADIENT } from '@/lib/fabGradient'
import {
  draftFromLead,
  emptyLeadDraft,
  formatLeadDate,
  parseLocalDate,
  SERIOUS_LEVELS,
  seriousLabel,
  validateLeadDraft,
  type DealLead,
  type LeadDraft,
  type SeriousLevel,
} from '@/lib/dealLeads'
import { deleteLead, loadDealLeads, saveLead } from '@/lib/dealLeadsApi'

const FONT_DISPLAY = "'Space Grotesk', system-ui, sans-serif"
const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace"

const T = {
  bgPanel: '#12111B',
  bgRaise: '#1E1D26',
  textHi: '#EFEEF4',
  textMid: '#B8B6C6',
  textLow: '#8E8CA0',
  brand: '#8B5CF6',
  brandLift: '#A78BFA',
  moneyIn: '#34D399',
  hot: '#FFA23A',
  late: '#FF4D4D',
  border: 'rgba(255,255,255,0.14)',
  borderPanel: 'rgba(255,255,255,0.11)',
  borderHair: 'rgba(255,255,255,0.10)',
}

function levelColor(level: string): string {
  if (level === 'offer_likely') return T.moneyIn
  if (level === 'hot') return T.hot
  return T.textMid
}

function contactLine(lead: DealLead): string {
  return [lead.phone, lead.email].filter(Boolean).join(' · ')
}

export default function DealLeadsSection({
  dealId,
  variant,
}: {
  dealId: string
  variant: 'desktop' | 'phone'
}) {
  const [leads, setLeads] = useState<DealLead[]>([])
  const [missing, setMissing] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<LeadDraft | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadDealLeads(dealId).then(result => {
      if (cancelled) return
      setLeads(result.leads)
      setMissing(result.missing)
      setLoadError(result.error)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [dealId])

  function openCreate() {
    setEditingId(null)
    setFormError('')
    setCalendarOpen(false)
    setDraft(emptyLeadDraft())
  }

  function openEdit(lead: DealLead) {
    setEditingId(lead.id)
    setFormError('')
    setCalendarOpen(false)
    setPendingDelete(null)
    setDraft(draftFromLead(lead))
  }

  function closeForm() {
    if (saving) return
    setDraft(null)
    setEditingId(null)
    setFormError('')
    setCalendarOpen(false)
  }

  async function onSave() {
    if (!draft || saving) return
    const problem = validateLeadDraft(draft)
    if (problem) {
      setFormError(problem)
      return
    }
    setSaving(true)
    setFormError('')
    const result = await saveLead(dealId, draft, editingId ?? undefined)
    setSaving(false)
    if (result.missing) setMissing(true)
    if (!result.lead) {
      setFormError(result.error || 'Could not save this lead.')
      return
    }
    setLeads(prev => {
      const without = prev.filter(row => row.id !== result.lead!.id)
      const next = editingId ? prev.map(row => row.id === result.lead!.id ? result.lead! : row) : [result.lead!, ...without]
      return next
    })
    setDraft(null)
    setEditingId(null)
  }

  async function onDelete(id: string) {
    if (deletingId) return
    setDeletingId(id)
    setRowError(null)
    const result = await deleteLead(id)
    setDeletingId(null)
    if (result.missing) setMissing(true)
    if (!result.ok) {
      setRowError({ id, message: result.error || 'Could not delete this lead.' })
      return
    }
    setLeads(prev => prev.filter(row => row.id !== id))
    setPendingDelete(null)
  }

  const phone = variant === 'phone'

  return (
    <section
      data-leads-section={variant}
      style={{
        background: phone ? T.bgPanel : T.bgRaise,
        borderRadius: phone ? 14 : 12,
        border: `1px solid ${phone ? 'rgba(255,255,255,0.10)' : T.borderPanel}`,
        overflow: 'hidden',
        margin: phone ? '0 18px 16px' : undefined,
      }}
    >
      <div style={{
        fontFamily: FONT_MONO,
        fontSize: phone ? 11 : 9.5,
        fontWeight: 500,
        letterSpacing: '0.19em',
        textTransform: 'uppercase',
        color: T.textLow,
        padding: phone ? '14px 16px 0' : '14px 18px 0',
        marginBottom: 10,
      }}>
        Leads
      </div>

      <div style={{ padding: phone ? '0 16px 14px' : '0 18px 14px' }}>
        <button
          type="button"
          onClick={openCreate}
          data-leads-add=""
          style={{
            width: '100%',
            height: 44,
            borderRadius: 12,
            border: '1px solid rgba(167,139,250,0.55)',
            background: FAB_APERTURE_GRADIENT,
            color: '#F7F4FF',
            fontFamily: FONT_MONO,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            boxShadow: '0 0 18px rgba(124,58,237,0.38)',
          }}
        >
          Log a lead
        </button>
      </div>

      <div style={{ padding: phone ? '0 16px 16px' : '0 18px 16px' }}>
        {loading ? (
          <div style={quiet}>Loading leads…</div>
        ) : missing ? (
          <div data-leads-setup="" style={quiet}>Leads not set up yet.</div>
        ) : loadError ? (
          <div style={{ ...quiet, color: T.late }}>{loadError}</div>
        ) : leads.length === 0 ? (
          <div data-leads-empty="" style={quiet}>No leads yet.</div>
        ) : (
          <div>
            {leads.map((lead, index) => (
              <div
                key={lead.id}
                data-lead-row={lead.id}
                style={{
                  padding: '12px 0',
                  borderTop: `1px solid ${T.borderHair}`,
                  borderBottom: index === leads.length - 1 ? 'none' : undefined,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: phone ? 16 : 15, fontWeight: 500, color: T.textHi, lineHeight: 1.3 }}>
                    {lead.name}
                  </div>
                  <div style={{
                    fontFamily: FONT_MONO,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    color: levelColor(lead.serious_level),
                    whiteSpace: 'nowrap',
                  }}>
                    {seriousLabel(lead.serious_level)}
                  </div>
                </div>
                {lead.company ? (
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textMid, marginTop: 2 }}>{lead.company}</div>
                ) : null}
                {contactLine(lead) ? (
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textMid, marginTop: 2 }}>{contactLine(lead)}</div>
                ) : null}
                {lead.lead_date ? (
                  <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.textLow, letterSpacing: '0.04em', marginTop: 6 }}>
                    {formatLeadDate(lead.lead_date)}
                  </div>
                ) : null}
                {lead.note ? (
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textMid, lineHeight: 1.45, marginTop: 6, whiteSpace: 'pre-wrap' }}>
                    {lead.note}
                  </div>
                ) : null}
                <div style={{ display: 'flex', gap: 14, marginTop: 8, alignItems: 'center' }}>
                  <button type="button" onClick={() => openEdit(lead)} style={textBtn}>Edit</button>
                  {pendingDelete === lead.id ? (
                    <>
                      <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.textMid }}>Delete this lead?</span>
                      <button
                        type="button"
                        disabled={deletingId === lead.id}
                        onClick={() => onDelete(lead.id)}
                        style={{ ...textBtn, color: T.late }}
                      >
                        {deletingId === lead.id ? 'Deleting…' : 'Confirm'}
                      </button>
                      <button type="button" onClick={() => setPendingDelete(null)} style={textBtn}>Cancel</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => { setRowError(null); setPendingDelete(lead.id) }} style={textBtn}>Delete</button>
                  )}
                </div>
                {rowError?.id === lead.id && (
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: T.late, marginTop: 6 }}>{rowError.message}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {draft && (
        <LeadForm
          draft={draft}
          editing={Boolean(editingId)}
          error={formError}
          saving={saving}
          calendarOpen={calendarOpen}
          onChange={setDraft}
          onClose={closeForm}
          onSave={onSave}
          onToggleCalendar={() => setCalendarOpen(open => !open)}
          onPickDate={date => {
            setDraft(current => current ? { ...current, lead_date: date } : current)
            setCalendarOpen(false)
          }}
        />
      )}
    </section>
  )
}

const quiet: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: '0.04em',
  color: T.textLow,
}

const textBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  fontFamily: FONT_DISPLAY,
  fontSize: 13,
  fontWeight: 500,
  color: T.brandLift,
}

function LeadForm({
  draft,
  editing,
  error,
  saving,
  calendarOpen,
  onChange,
  onClose,
  onSave,
  onToggleCalendar,
  onPickDate,
}: {
  draft: LeadDraft
  editing: boolean
  error: string
  saving: boolean
  calendarOpen: boolean
  onChange: (next: LeadDraft) => void
  onClose: () => void
  onSave: () => void
  onToggleCalendar: () => void
  onPickDate: (iso: string) => void
}) {
  const selected = parseLocalDate(draft.lead_date)
  return (
    <div
      role="presentation"
      onClick={event => { if (event.target === event.currentTarget) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        background: 'rgba(5,5,9,0.78)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={editing ? 'Edit lead' : 'Log a lead'}
        data-lead-form=""
        style={{
          width: 'min(560px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 48px)',
          overflowY: 'auto',
          background: T.bgPanel,
          border: '1px solid rgba(139, 92, 246, 0.5)',
          borderRadius: 20,
          boxShadow: '0 0 0 1px rgba(139, 92, 246, 0.16), 0 24px 64px rgba(0,0,0,0.5), 0 0 48px rgba(124, 58, 237, 0.3)',
          padding: '18px 18px 20px',
          color: T.textHi,
          fontFamily: FONT_DISPLAY,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.brandLift }}>
            {editing ? 'Edit lead' : 'Log a lead'}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ ...textBtn, color: T.textMid, letterSpacing: '0.12em', fontFamily: FONT_MONO, fontSize: 11 }}>
            Close
          </button>
        </div>

        <Field label="Name">
          <input
            value={draft.name}
            autoFocus
            onChange={event => onChange({ ...draft, name: event.target.value })}
            style={inputStyle}
          />
        </Field>
        <Field label="Company">
          <input value={draft.company} onChange={event => onChange({ ...draft, company: event.target.value })} style={inputStyle} />
        </Field>
        <Field label="Phone">
          <input value={draft.phone} inputMode="tel" onChange={event => onChange({ ...draft, phone: event.target.value })} style={inputStyle} />
        </Field>
        <Field label="Email">
          <input value={draft.email} inputMode="email" onChange={event => onChange({ ...draft, email: event.target.value })} style={inputStyle} />
        </Field>
        <Field label="Serious level">
          <div style={{ display: 'flex', gap: 8 }}>
            {SERIOUS_LEVELS.map(level => {
              const on = draft.serious_level === level.value
              return (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => onChange({ ...draft, serious_level: level.value as SeriousLevel })}
                  style={{
                    flex: 1,
                    minHeight: 42,
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontFamily: FONT_DISPLAY,
                    fontSize: 14,
                    fontWeight: on ? 600 : 500,
                    color: on ? T.textHi : T.textMid,
                    background: on ? 'rgba(139,92,246,0.16)' : 'transparent',
                    border: on ? '1px solid rgba(167,139,250,0.7)' : `1px solid ${T.border}`,
                    boxShadow: on ? '0 0 14px rgba(124,58,237,0.28)' : 'none',
                  }}
                >
                  {level.label}
                </button>
              )
            })}
          </div>
        </Field>
        <Field label="Date">
          <button
            type="button"
            onClick={onToggleCalendar}
            style={{
              ...inputStyle,
              textAlign: 'left',
              cursor: 'pointer',
              color: T.textHi,
            }}
          >
            {formatLeadDate(draft.lead_date)}
          </button>
          {calendarOpen && (
            <CalendarPicker
              value={selected}
              onCancel={onToggleCalendar}
              onDone={date => {
                const y = date.getFullYear()
                const m = String(date.getMonth() + 1).padStart(2, '0')
                const d = String(date.getDate()).padStart(2, '0')
                onPickDate(`${y}-${m}-${d}`)
              }}
            />
          )}
        </Field>
        <Field label="Note">
          <textarea
            value={draft.note}
            rows={3}
            onChange={event => onChange({ ...draft, note: event.target.value })}
            style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }}
          />
        </Field>

        {error && (
          <div data-lead-form-error="" style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: T.late, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          style={{
            width: '100%',
            height: 46,
            borderRadius: 12,
            border: 'none',
            background: FAB_APERTURE_GRADIENT,
            color: '#F7F4FF',
            fontFamily: FONT_MONO,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.7 : 1,
            boxShadow: '0 0 18px rgba(124,58,237,0.35)',
          }}
        >
          {saving ? 'Saving…' : 'Save lead'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <div style={{
        fontFamily: FONT_MONO,
        fontSize: 10.5,
        fontWeight: 500,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: T.textLow,
        marginBottom: 6,
      }}>{label}</div>
      {children}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 10,
  color: T.textHi,
  fontFamily: FONT_DISPLAY,
  fontSize: 15,
  padding: '12px 14px',
  outline: 'none',
}
