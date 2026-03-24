'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useUser } from '@/lib/hooks'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import Link from 'next/link'

interface GroupRow {
  id: string
  name: string
  description: string | null
  created_by: string
  member_count: number
}

export default function GroupsPage() {
  const { user } = useUser()
  const supabase = createClient()
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [inviteEmails, setInviteEmails] = useState('')
  const [loading, setLoading] = useState(false)
  const [createError, setCreateError] = useState('')
  const [inviteStatus, setInviteStatus] = useState('')

  const loadGroups = async () => {
    if (!user) return
    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id)

    if (!memberships?.length) { setGroups([]); return }

    const ids = memberships.map(m => m.group_id)
    const { data } = await supabase
      .from('groups')
      .select('*, group_members(count)')
      .in('id', ids)
      .order('created_at', { ascending: false })

    setGroups(
      (data || []).map((g: any) => ({
        ...g,
        member_count: g.group_members?.[0]?.count || 0,
      }))
    )
  }

  useEffect(() => { loadGroups() }, [user])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setLoading(true)
    setCreateError('')
    setInviteStatus('')

    const { data: group, error } = await supabase
      .from('groups')
      .insert({ name, description: description || null, created_by: user.id })
      .select()
      .single()

    if (error) {
      setCreateError(error.message)
      setLoading(false)
      return
    }

    if (!group) {
      setCreateError('Failed to create group. Please try again.')
      setLoading(false)
      return
    }

    // Add creator as member
    await supabase.from('group_members').insert({ group_id: group.id, user_id: user.id })

    // Process invite emails
    const emails = inviteEmails
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(e => e && e !== user.email?.toLowerCase())

    if (emails.length > 0) {
      const results: string[] = []
      const pendingInviteLinks: string[] = []

      for (const email of emails) {
        // Check if user exists
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .single()

        if (profile) {
          await supabase.from('group_members').insert({ group_id: group.id, user_id: profile.id })
          results.push(`✓ ${email} added`)
        } else {
          await supabase.from('pending_invites').insert({
            group_id: group.id,
            email: email,
            invited_by: user.id,
          })
          pendingInviteLinks.push(email)
          results.push(`⏳ ${email} — invite link ready`)
        }
      }

      setInviteStatus(results.join('\n'))

      // If there are pending invites, generate a share link
      if (pendingInviteLinks.length > 0) {
        const inviteLink = `${window.location.origin}/signup?invite_group=${group.id}`
        const shareText = `Join "${name}" on Hisaab Kitaab!\n\nSign up here: ${inviteLink}`

        // Try native share (works great on mobile), fall back to clipboard
        if (navigator.share) {
          try {
            await navigator.share({ title: `Join ${name}`, text: shareText })
          } catch {
            // User cancelled share — copy to clipboard instead
            await navigator.clipboard.writeText(inviteLink)
          }
        } else {
          await navigator.clipboard.writeText(inviteLink)
        }

        setInviteStatus(results.join('\n') + '\n\n📋 Invite link copied! Share it with them.')
      }
    }

    if (!inviteEmails.trim()) {
      // No invites — just close
      setShowCreate(false)
      setName('')
      setDescription('')
      setInviteEmails('')
      setInviteStatus('')
    }

    loadGroups()
    setLoading(false)
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Groups</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage shared expenses</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ New Group</Button>
      </div>

      {groups.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-gray-500 dark:text-gray-400">No groups yet</p>
          <Button className="mt-4" onClick={() => setShowCreate(true)}>Create your first group</Button>
        </Card>
      ) : (
        <div className="grid gap-3">
          {groups.map((g) => (
            <Link key={g.id} href={`/groups/${g.id}`}>
              <Card className="hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 font-bold text-lg">
                    {g.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">{g.name}</h3>
                    {g.description && <p className="text-xs text-gray-400 truncate">{g.description}</p>}
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{g.member_count} members</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => { setShowCreate(false); setCreateError(''); setInviteStatus('') }} title="Create Group">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Group Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Goa Trip" required />
          <Input label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Beach vacation" />

          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Invite Members (optional)
            </label>
            <textarea
              value={inviteEmails}
              onChange={(e) => setInviteEmails(e.target.value)}
              placeholder="friend1@email.com, friend2@email.com"
              rows={3}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-colors"
            />
            <p className="mt-1 text-xs text-gray-400">
              Comma-separated emails. Existing users are added instantly. For new users, you'll get a share link to send them.
            </p>
          </div>

          {createError && <p className="text-sm text-red-500">{createError}</p>}
          {inviteStatus && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
              {inviteStatus.split('\n').map((line, i) => (
                <p key={i} className="text-sm text-emerald-700 dark:text-emerald-400">{line}</p>
              ))}
            </div>
          )}

          {inviteStatus ? (
            <Button type="button" className="w-full" onClick={() => { setShowCreate(false); setName(''); setDescription(''); setInviteEmails(''); setInviteStatus('') }}>Done</Button>
          ) : (
            <Button type="submit" loading={loading} className="w-full">Create Group</Button>
          )}
        </form>
      </Modal>
    </div>
  )
}
