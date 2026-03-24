'use client'

import { useState, useEffect } from 'react'
import { supabase, Task } from '@/lib/supabase'

export default function BattlePlanPanel() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [newTask, setNewTask] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    fetchTasks()
  }, [])

  async function fetchTasks() {
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .in('status', ['open', 'in_progress'])
        .or(`due_date.lte.${today},due_date.is.null`)
        .order('created_at', { ascending: false })
        .limit(20)
      if (data) setTasks(data as Task[])
    } catch {
      // DB not yet migrated
    } finally {
      setLoading(false)
    }
  }

  async function completeTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id))
    try {
      await supabase.from('tasks').update({ status: 'complete', completed_by: 'matthew' }).eq('id', id)
      await supabase.from('activity_log').insert({
        action_type: 'task_completed',
        description: tasks.find(t => t.id === id)?.title || 'Task completed',
        created_by: 'matthew',
      })
    } catch {}
  }

  async function addTask() {
    if (!newTask.trim()) return
    setAdding(true)
    try {
      const { data } = await supabase
        .from('tasks')
        .insert({ title: newTask.trim(), status: 'open' })
        .select()
        .single()
      if (data) setTasks(prev => [data as Task, ...prev])
      setNewTask('')
    } catch {}
    setAdding(false)
  }

  return (
    <div className="wr-card h-full min-h-[320px]">
      <div className="wr-card-header">
        <span style={{ color: 'var(--accent-gold)', display: 'flex' }}>
          <SwordIcon />
        </span>
        <span className="wr-card-title">Battle Plan</span>
        <span className="wr-panel-line" />
        <span className="wr-panel-stat" style={{ fontSize: 16 }}>
          {tasks.length > 0 ? tasks.length : '—'}
        </span>
      </div>

      {/* Add task input */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          value={newTask}
          onChange={e => setNewTask(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTask()}
          placeholder="Add action item..."
          style={{
            flex: 1,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            padding: '7px 12px',
            fontSize: 13,
            color: 'var(--text-primary)',
            outline: 'none',
          }}
          onFocus={e => (e.target.style.borderColor = 'rgba(201,147,58,0.4)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border-subtle)')}
        />
        <button
          onClick={addTask}
          disabled={adding || !newTask.trim()}
          style={{
            padding: '7px 14px',
            background: 'var(--accent-gold)',
            color: '#0D0F14',
            border: 'none',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            opacity: (!newTask.trim() || adding) ? 0.5 : 1,
          }}
        >
          Add
        </button>
      </div>

      {/* Task list */}
      {loading ? (
        <SkeletonList />
      ) : tasks.length === 0 ? (
        <EmptyState message="No open action items — clear skies." />
      ) : (
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {tasks.map(task => (
            <TaskItem key={task.id} task={task} onComplete={completeTask} />
          ))}
        </ul>
      )}
    </div>
  )
}

function TaskItem({ task, onComplete }: { task: Task; onComplete: (id: string) => void }) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date()

  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        background: 'var(--bg-elevated)',
        borderRadius: 6,
        border: '1px solid var(--border-subtle)',
        transition: 'background 0.15s',
      }}
    >
      <button
        onClick={() => onComplete(task.id)}
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: '1.5px solid rgba(201,147,58,0.4)',
          background: 'none',
          cursor: 'pointer',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(201,147,58,0.2)'
          e.currentTarget.style.borderColor = 'var(--accent-gold)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'none'
          e.currentTarget.style.borderColor = 'rgba(201,147,58,0.4)'
        }}
      />
      <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1, lineHeight: 1.4 }}>
        {task.title}
      </span>
      {task.due_date && (
        <span style={{
          fontSize: 10,
          color: isOverdue ? 'var(--danger)' : 'var(--text-muted)',
          flexShrink: 0,
        }}>
          {task.due_date}
        </span>
      )}
    </li>
  )
}

function SkeletonList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {[60, 80, 50, 70].map((w, i) => (
        <div key={i} className="skeleton" style={{ height: 36, width: `${w}%` }} />
      ))}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
      {message}
    </div>
  )
}

function SwordIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14.5 17.5L3 6V3h3l11.5 11.5"/>
      <path d="M13 19l6-6"/>
    </svg>
  )
}
