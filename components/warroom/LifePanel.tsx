'use client'

import { useState, useEffect } from 'react'
import { supabase, PersonalTask } from '@/lib/supabase'

const EMOJI_OPTIONS = ['📋', '🏠', '🚗', '👨‍👩‍👧‍👦', '💪', '🏥', '🎓', '✈️', '🎉', '💰', '🛒', '📞', '🤝', '🔧', '⚡', '🎯', '📅', '🌱', '❤️', '⭐']

export default function LifePanel() {
  const [tasks, setTasks] = useState<PersonalTask[]>([])
  const [loading, setLoading] = useState(true)
  const [newTask, setNewTask] = useState('')
  const [selectedEmoji, setSelectedEmoji] = useState('📋')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [adding, setAdding] = useState(false)

  useEffect(() => { fetchTasks() }, [])

  async function fetchTasks() {
    try {
      const { data } = await supabase
        .from('personal_tasks')
        .select('*')
        .eq('status', 'pending')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })
      if (data) setTasks(data as PersonalTask[])
    } catch {
      // Table not yet migrated — show empty state, no crash
    } finally {
      setLoading(false)
    }
  }

  async function addTask() {
    if (!newTask.trim()) return
    setAdding(true)
    const optimistic: PersonalTask = {
      id: 'tmp-' + Date.now(),
      title: newTask.trim(),
      status: 'pending',
      emoji: selectedEmoji,
      sort_order: tasks.length,
      created_at: new Date().toISOString(),
    }
    setTasks(prev => [optimistic, ...prev])
    setNewTask('')
    setShowEmojiPicker(false)
    try {
      const { data } = await supabase
        .from('personal_tasks')
        .insert({ title: optimistic.title, emoji: optimistic.emoji, sort_order: optimistic.sort_order })
        .select()
        .single()
      if (data) {
        setTasks(prev => prev.map(t => t.id === optimistic.id ? (data as PersonalTask) : t))
      }
    } catch {
      setTasks(prev => prev.filter(t => t.id !== optimistic.id))
    }
    setAdding(false)
  }

  async function completeTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id))
    try {
      await supabase.from('personal_tasks').update({ status: 'done' }).eq('id', id)
    } catch {}
  }

  async function deleteTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id))
    try {
      await supabase.from('personal_tasks').delete().eq('id', id)
    } catch {}
  }

  return (
    <div className="wr-card" style={{ minHeight: 400 }}>
      {/* Header */}
      <div className="wr-card-header">
        <span style={{ color: 'var(--accent-gold)', display: 'flex' }}>
          <HeartIcon />
        </span>
        <span className="wr-card-title">Life</span>
        <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(139,92,246,0.15)', color: 'var(--accent-gold)', fontWeight: 600 }}>
          Personal
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
          {tasks.length} items
        </span>
      </div>

      {/* Note: separate from business */}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, borderLeft: '2px solid var(--accent-gold)' }}>
        Personal — kids, family, house, life admin. Separate from business deals.
      </div>

      {/* Add task input */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, position: 'relative' }}>
        {/* Emoji button */}
        <button
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          style={{
            padding: '0 10px',
            fontSize: 18,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            cursor: 'pointer',
            flexShrink: 0,
          }}
          title="Pick emoji"
        >
          {selectedEmoji}
        </button>

        {/* Emoji picker dropdown */}
        {showEmojiPicker && (
          <div style={{
            position: 'absolute',
            top: '110%',
            left: 0,
            zIndex: 50,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            padding: 10,
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 6,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}>
            {EMOJI_OPTIONS.map(e => (
              <button
                key={e}
                onClick={() => { setSelectedEmoji(e); setShowEmojiPicker(false) }}
                style={{
                  fontSize: 20,
                  padding: '4px',
                  background: selectedEmoji === e ? 'rgba(139,92,246,0.2)' : 'transparent',
                  border: selectedEmoji === e ? '1px solid var(--accent-gold)' : '1px solid transparent',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                {e}
              </button>
            ))}
          </div>
        )}

        <input
          type="text"
          value={newTask}
          onChange={e => setNewTask(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTask()}
          placeholder="Add personal item..."
          style={{
            flex: 1,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            padding: '8px 12px',
            fontSize: 13,
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
        <button
          onClick={addTask}
          disabled={adding || !newTask.trim()}
          style={{
            padding: '8px 16px',
            background: 'var(--accent-gold)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 700,
            cursor: adding || !newTask.trim() ? 'not-allowed' : 'pointer',
            opacity: adding || !newTask.trim() ? 0.5 : 1,
            flexShrink: 0,
          }}
        >
          Add
        </button>
      </div>

      {/* Task list */}
      {loading ? (
        <SkeletonList />
      ) : tasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>✨</div>
          All clear — life is good.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {tasks.map(task => (
            <TaskRow key={task.id} task={task} onComplete={completeTask} onDelete={deleteTask} />
          ))}
        </div>
      )}
    </div>
  )
}

function TaskRow({ task, onComplete, onDelete }: {
  task: PersonalTask
  onComplete: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 10px',
      background: 'var(--bg-elevated)',
      borderRadius: 6,
      border: '1px solid var(--border-subtle)',
      transition: 'background 0.15s',
    }}>
      {/* Complete checkbox */}
      <button
        onClick={() => onComplete(task.id)}
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          border: '1.5px solid var(--text-muted)',
          background: 'transparent',
          cursor: 'pointer',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s',
        }}
        title="Mark done"
      />

      {/* Emoji */}
      <span style={{ fontSize: 16, flexShrink: 0 }}>{task.emoji}</span>

      {/* Title */}
      <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>
        {task.title}
      </span>

      {/* Delete */}
      <button
        onClick={() => onDelete(task.id)}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontSize: 14,
          padding: '2px 4px',
          borderRadius: 4,
          opacity: 0.6,
          transition: 'opacity 0.15s',
        }}
        title="Delete"
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
      >
        ✕
      </button>
    </div>
  )
}

function SkeletonList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 40 }} />)}
    </div>
  )
}

function HeartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )
}
