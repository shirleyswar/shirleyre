'use client'

import { useState, useEffect } from 'react'
import { supabase, Entity, EntityItem } from '@/lib/supabase'

const ENTITY_TYPES = ['LLC', 'S-Corp', 'C-Corp', 'Trust', 'Partnership', 'Sole Prop', 'Other']

export default function EntitiesPanel() {
  const [entities, setEntities] = useState<Entity[]>([])
  const [entityItems, setEntityItems] = useState<Record<string, EntityItem[]>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Add form state
  const [form, setForm] = useState({ name: '', type: 'LLC', notes: '', dropbox_link: '' })

  // Sub-item form state
  const [addingItemFor, setAddingItemFor] = useState<string | null>(null)
  const [newItemTitle, setNewItemTitle] = useState('')
  const [newItemNotes, setNewItemNotes] = useState('')

  useEffect(() => { fetchEntities() }, [])

  async function fetchEntities() {
    try {
      const { data } = await supabase
        .from('entities')
        .select('*')
        .order('created_at', { ascending: true })
      if (data) setEntities(data as Entity[])
    } catch {
      // Table not yet migrated
    } finally {
      setLoading(false)
    }
  }

  async function fetchItemsFor(entityId: string) {
    try {
      const { data } = await supabase
        .from('entity_items')
        .select('*')
        .eq('entity_id', entityId)
        .order('created_at', { ascending: true })
      if (data) {
        setEntityItems(prev => ({ ...prev, [entityId]: data as EntityItem[] }))
      }
    } catch {}
  }

  function toggleExpand(id: string) {
    const next = new Set(expanded)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
      if (!entityItems[id]) fetchItemsFor(id)
    }
    setExpanded(next)
  }

  async function addEntity() {
    if (!form.name.trim()) return
    try {
      const { data } = await supabase
        .from('entities')
        .insert({ name: form.name.trim(), type: form.type || null, notes: form.notes || null, dropbox_link: form.dropbox_link || null })
        .select()
        .single()
      if (data) setEntities(prev => [...prev, data as Entity])
    } catch {}
    setForm({ name: '', type: 'LLC', notes: '', dropbox_link: '' })
    setShowAddForm(false)
  }

  async function deleteEntity(id: string) {
    if (!confirm('Delete this entity and all sub-items?')) return
    setEntities(prev => prev.filter(e => e.id !== id))
    try {
      await supabase.from('entities').delete().eq('id', id)
    } catch {}
  }

  async function addItem(entityId: string) {
    if (!newItemTitle.trim()) return
    const optimistic: EntityItem = {
      id: 'tmp-' + Date.now(),
      entity_id: entityId,
      title: newItemTitle.trim(),
      notes: newItemNotes || null,
      created_at: new Date().toISOString(),
    }
    setEntityItems(prev => ({ ...prev, [entityId]: [...(prev[entityId] || []), optimistic] }))
    setNewItemTitle('')
    setNewItemNotes('')
    setAddingItemFor(null)
    try {
      const { data } = await supabase
        .from('entity_items')
        .insert({ entity_id: entityId, title: optimistic.title, notes: optimistic.notes })
        .select()
        .single()
      if (data) {
        setEntityItems(prev => ({
          ...prev,
          [entityId]: (prev[entityId] || []).map(i => i.id === optimistic.id ? (data as EntityItem) : i),
        }))
      }
    } catch {
      setEntityItems(prev => ({
        ...prev,
        [entityId]: (prev[entityId] || []).filter(i => i.id !== optimistic.id),
      }))
    }
  }

  async function deleteItem(entityId: string, itemId: string) {
    setEntityItems(prev => ({ ...prev, [entityId]: (prev[entityId] || []).filter(i => i.id !== itemId) }))
    try {
      await supabase.from('entity_items').delete().eq('id', itemId)
    } catch {}
  }

  return (
    <div className="wr-card" style={{ minHeight: 400 }}>
      {/* Header */}
      <div className="wr-card-header">
        <span style={{ color: 'var(--accent-gold)', display: 'flex' }}>
          <BuildingIcon />
        </span>
        <span className="wr-card-title">Entities</span>
        <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(139,92,246,0.12)', color: 'var(--accent-gold)', fontWeight: 600 }}>
          Registry
        </span>
        <span style={{ marginLeft: 'auto' }}>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            style={{
              fontSize: 11,
              padding: '4px 12px',
              background: showAddForm ? 'var(--accent-gold)' : 'rgba(139,92,246,0.15)',
              color: showAddForm ? '#000' : 'var(--accent-gold)',
              border: '1px solid rgba(139,92,246,0.3)',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {showAddForm ? 'Cancel' : '+ Add Entity'}
          </button>
        </span>
      </div>

      {/* Add entity form */}
      {showAddForm && (
        <div style={{
          background: 'var(--bg-elevated)',
          border: '1px solid rgba(139,92,246,0.25)',
          borderRadius: 8,
          padding: 14,
          marginBottom: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="Entity name *"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              style={inputStyle}
            />
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              style={{ ...inputStyle, width: 110, flexShrink: 0 }}
            >
              {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <input
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            style={inputStyle}
          />
          <input
            placeholder="Dropbox link (optional)"
            value={form.dropbox_link}
            onChange={e => setForm(f => ({ ...f, dropbox_link: e.target.value }))}
            style={inputStyle}
          />
          <button
            onClick={addEntity}
            disabled={!form.name.trim()}
            style={{
              padding: '8px 16px',
              background: 'var(--accent-gold)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              alignSelf: 'flex-end',
            }}
          >
            Save Entity
          </button>
        </div>
      )}

      {/* Entity list */}
      {loading ? (
        <SkeletonList />
      ) : entities.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🏢</div>
          No entities registered yet.<br />
          <span style={{ fontSize: 11 }}>Add LLCs, trusts, and business entities above.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entities.map(entity => (
            <EntityCard
              key={entity.id}
              entity={entity}
              items={entityItems[entity.id]}
              isExpanded={expanded.has(entity.id)}
              onToggle={() => toggleExpand(entity.id)}
              onDelete={() => deleteEntity(entity.id)}
              addingItem={addingItemFor === entity.id}
              onStartAddItem={() => { setAddingItemFor(entity.id); setNewItemTitle(''); setNewItemNotes('') }}
              onCancelAddItem={() => setAddingItemFor(null)}
              newItemTitle={newItemTitle}
              newItemNotes={newItemNotes}
              onNewItemTitleChange={setNewItemTitle}
              onNewItemNotesChange={setNewItemNotes}
              onAddItem={() => addItem(entity.id)}
              onDeleteItem={(itemId) => deleteItem(entity.id, itemId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function EntityCard({
  entity, items, isExpanded, onToggle, onDelete,
  addingItem, onStartAddItem, onCancelAddItem,
  newItemTitle, newItemNotes, onNewItemTitleChange, onNewItemNotesChange,
  onAddItem, onDeleteItem,
}: {
  entity: Entity
  items?: EntityItem[]
  isExpanded: boolean
  onToggle: () => void
  onDelete: () => void
  addingItem: boolean
  onStartAddItem: () => void
  onCancelAddItem: () => void
  newItemTitle: string
  newItemNotes: string
  onNewItemTitleChange: (v: string) => void
  onNewItemNotesChange: (v: string) => void
  onAddItem: () => void
  onDeleteItem: (id: string) => void
}) {
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 8,
      overflow: 'hidden',
    }}>
      {/* Entity header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          cursor: 'pointer',
        }}
        onClick={onToggle}
      >
        {/* Expand chevron */}
        <span style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
          flexShrink: 0,
        }}>▶</span>

        {/* Name */}
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
          {entity.name}
        </span>

        {/* Type badge */}
        {entity.type && (
          <span style={{
            fontSize: 10,
            padding: '2px 8px',
            borderRadius: 10,
            background: 'rgba(139,92,246,0.1)',
            color: 'var(--accent-gold)',
            fontWeight: 600,
            flexShrink: 0,
          }}>
            {entity.type}
          </span>
        )}

        {/* Dropbox link */}
        {entity.dropbox_link && (
          <a
            href={entity.dropbox_link}
            target="_blank"
            rel="noreferrer"
            onClick={e => e.stopPropagation()}
            style={{
              fontSize: 10,
              color: '#60A5FA',
              textDecoration: 'none',
              padding: '2px 6px',
              borderRadius: 4,
              background: 'rgba(96,165,250,0.1)',
              flexShrink: 0,
            }}
          >
            📁 Dropbox
          </a>
        )}

        {/* Delete button */}
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: 12,
            padding: '2px 4px',
            borderRadius: 4,
            opacity: 0.5,
            flexShrink: 0,
          }}
          title="Delete entity"
        >
          ✕
        </button>
      </div>

      {/* Notes */}
      {entity.notes && (
        <div style={{ padding: '0 12px 8px 32px', fontSize: 11, color: 'var(--text-muted)' }}>
          {entity.notes}
        </div>
      )}

      {/* Expanded sub-items */}
      {isExpanded && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '10px 12px' }}>
          {/* Sub-items list */}
          {items && items.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
              {items.map(item => (
                <div key={item.id} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '6px 8px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 6,
                  borderLeft: '2px solid rgba(139,92,246,0.3)',
                }}>
                  <span style={{ fontSize: 11, color: 'var(--text-primary)', flex: 1 }}>
                    {item.title}
                    {item.notes && (
                      <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>— {item.notes}</span>
                    )}
                  </span>
                  <button
                    onClick={() => onDeleteItem(item.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      fontSize: 11,
                      opacity: 0.5,
                      flexShrink: 0,
                    }}
                  >✕</button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, fontStyle: 'italic' }}>
              No sub-items yet — add tenant rosters, tax tracking, documents, etc.
            </div>
          )}

          {/* Add sub-item */}
          {addingItem ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input
                placeholder="Sub-item title *"
                value={newItemTitle}
                onChange={e => onNewItemTitleChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') onAddItem(); if (e.key === 'Escape') onCancelAddItem() }}
                style={{ ...inputStyle, fontSize: 12 }}
                autoFocus
              />
              <input
                placeholder="Notes (optional)"
                value={newItemNotes}
                onChange={e => onNewItemNotesChange(e.target.value)}
                style={{ ...inputStyle, fontSize: 12 }}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={onAddItem} disabled={!newItemTitle.trim()} style={{
                  padding: '5px 12px', background: 'var(--accent-gold)', color: '#fff',
                  border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}>Add</button>
                <button onClick={onCancelAddItem} style={{
                  padding: '5px 12px', background: 'transparent', color: 'var(--text-muted)',
                  border: '1px solid var(--border-subtle)', borderRadius: 5, fontSize: 11, cursor: 'pointer',
                }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button
              onClick={onStartAddItem}
              style={{
                fontSize: 11,
                padding: '4px 10px',
                background: 'rgba(139,92,246,0.1)',
                color: 'var(--accent-gold)',
                border: '1px solid rgba(139,92,246,0.2)',
                borderRadius: 5,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              + Add sub-item
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: 'var(--bg-base)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 6,
  padding: '7px 10px',
  fontSize: 13,
  color: 'var(--text-primary)',
  outline: 'none',
  width: '100%',
}

function SkeletonList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 48 }} />)}
    </div>
  )
}

function BuildingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  )
}
