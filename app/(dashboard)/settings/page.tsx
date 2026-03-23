'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useUser } from '@/lib/hooks'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const AVATARS = [
  '🦊', '🐻', '🐼', '🐨', '🦁', '🐯', '🐸', '🐵',
  '🦄', '🐲', '🦉', '🐧', '🐹', '🐰', '🐱', '🐶',
  '🦋', '🐙', '🦈', '🐢', '🦜', '🐺', '🦝', '🐮',
]

export default function SettingsPage() {
  const { user } = useUser()
  const supabase = createClient()
  const router = useRouter()
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).single().then(({ data }) => {
      if (data) {
        setName(data.full_name)
        setAvatar(data.avatar_url)
      }
    })
    const stored = localStorage.getItem('theme')
    if (stored === 'dark') setTheme('dark')
    else if (stored === 'light') setTheme('light')
    else setTheme('system')
  }, [user])

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    await supabase.from('profiles').update({ full_name: name, avatar_url: avatar }).eq('id', user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const applyTheme = (t: 'light' | 'dark' | 'system') => {
    setTheme(t)
    if (t === 'system') {
      localStorage.removeItem('theme')
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      document.documentElement.classList.toggle('dark', prefersDark)
    } else {
      localStorage.setItem('theme', t)
      document.documentElement.classList.toggle('dark', t === 'dark')
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const themes: { value: 'light' | 'dark' | 'system'; label: string; icon: string }[] = [
    { value: 'light', label: 'Light', icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z' },
    { value: 'dark', label: 'Dark', icon: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z' },
    { value: 'system', label: 'System', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  ]

  return (
    <div className="p-4 sm:p-8 max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>

      {/* Avatar */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Profile Picture</h3>

        {/* Current avatar preview */}
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-3xl">
            {avatar || user?.email?.charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{name || 'Your Name'}</p>
            <p className="text-xs text-gray-400">{user?.email}</p>
            {avatar && (
              <button onClick={() => setAvatar(null)} className="text-xs text-red-400 hover:text-red-600 mt-1">Remove avatar</button>
            )}
          </div>
        </div>

        {/* Avatar grid */}
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Choose a character:</p>
        <div className="grid grid-cols-8 gap-1.5">
          {AVATARS.map((a) => (
            <button
              key={a}
              onClick={() => setAvatar(a)}
              className={`w-full aspect-square rounded-xl flex items-center justify-center text-xl transition-all hover:scale-110 ${avatar === a ? 'bg-emerald-100 dark:bg-emerald-900/30 ring-2 ring-emerald-500 scale-110' : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              {a}
            </button>
          ))}
        </div>
      </Card>

      {/* Profile info */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Profile</h3>
        <div className="space-y-4">
          <Input label="Email" value={user?.email || ''} disabled />
          <Input label="Full Name" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} loading={saving}>Save Changes</Button>
            {saved && <span className="text-sm text-emerald-600">Saved!</span>}
          </div>
        </div>
      </Card>

      {/* Theme */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Appearance</h3>
        <div className="grid grid-cols-3 gap-2">
          {themes.map((t) => (
            <button
              key={t.value}
              onClick={() => applyTheme(t.value)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${theme === t.value ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}
            >
              <svg className={`w-6 h-6 ${theme === t.value ? 'text-emerald-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
              </svg>
              <span className={`text-xs font-medium ${theme === t.value ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-500'}`}>{t.label}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <Button variant="danger" onClick={handleLogout} className="w-full">Sign Out</Button>
      </Card>
    </div>
  )
}
