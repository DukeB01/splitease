'use client'

import { useEffect, useState, use } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useUser } from '@/lib/hooks'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { simplifyDebts } from '@/lib/settlement'
import { Balance, Profile } from '@/lib/types'

interface Member { user_id: string; profile: Profile }
interface Expense {
  id: string; description: string; amount: number; paid_by: string; split_type: string; created_at: string
  payer: Profile; splits: { user_id: string; amount: number; profile: Profile }[]
}

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = use(params)
  const { user } = useUser()
  const supabase = createClient()
  const [group, setGroup] = useState<{ name: string; description: string; created_by: string } | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [settlements, setSettlements] = useState<Balance[]>([])
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [showSettlements, setShowSettlements] = useState(false)
  const [tab, setTab] = useState<'expenses' | 'members'>('expenses')

  // Add expense form
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [paidBy, setPaidBy] = useState('')
  const [splitType, setSplitType] = useState('equal')
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({})
  const [expLoading, setExpLoading] = useState(false)

  // Add member
  const [memberEmail, setMemberEmail] = useState('')
  const [memLoading, setMemLoading] = useState(false)
  const [inviteCopied, setInviteCopied] = useState(false)
  const [memError, setMemError] = useState('')

  const load = async () => {
    const { data: g } = await supabase.from('groups').select('name, description, created_by').eq('id', groupId).single()
    setGroup(g)

    const { data: m } = await supabase.from('group_members').select('user_id, profile:profiles(*)').eq('group_id', groupId)
    const mems = (m || []).map((x: any) => ({ user_id: x.user_id, profile: x.profile }))
    setMembers(mems)
    if (mems.length > 0 && !paidBy) setPaidBy(mems[0].user_id)

    const { data: e } = await supabase
      .from('group_expenses')
      .select('*, payer:profiles!group_expenses_paid_by_fkey(*), splits:expense_splits(*, profile:profiles(*))')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })

    setExpenses((e || []) as Expense[])

    // Compute settlements
    const debts: { from: string; to: string; amount: number }[] = []
    for (const exp of (e || []) as Expense[]) {
      for (const split of exp.splits) {
        if (split.user_id !== exp.paid_by) {
          debts.push({ from: split.user_id, to: exp.paid_by, amount: Number(split.amount) })
        }
      }
    }
    const simplified = simplifyDebts(debts)
    // Attach profiles
    const profileMap = new Map(mems.map((m: Member) => [m.user_id, m.profile]))
    setSettlements(simplified.map(s => ({
      ...s,
      from_profile: profileMap.get(s.from_user),
      to_profile: profileMap.get(s.to_user),
    })))
  }

  useEffect(() => { if (user) load() }, [user, groupId])

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    setExpLoading(true)

    const { data: expense } = await supabase
      .from('group_expenses')
      .insert({ group_id: groupId, description: desc, amount: parseFloat(amount), paid_by: paidBy, split_type: splitType })
      .select()
      .single()

    if (expense) {
      let splits: { expense_id: string; user_id: string; amount: number }[]

      if (splitType === 'equal') {
        const perPerson = parseFloat(amount) / members.length
        splits = members.map(m => ({ expense_id: expense.id, user_id: m.user_id, amount: Math.round(perPerson * 100) / 100 }))
      } else {
        splits = members.map(m => ({
          expense_id: expense.id,
          user_id: m.user_id,
          amount: parseFloat(customSplits[m.user_id] || '0'),
        }))
      }

      await supabase.from('expense_splits').insert(splits)
      setShowAddExpense(false)
      setDesc('')
      setAmount('')
      setCustomSplits({})
      load()
    }
    setExpLoading(false)
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    setMemLoading(true)
    setMemError('')

    const email = memberEmail.trim().toLowerCase()

    const { data: profile } = await supabase.from('profiles').select('id').eq('email', email).single()

    if (profile) {
      const exists = members.find(m => m.user_id === profile.id)
      if (exists) {
        setMemError('Already a member.')
        setMemLoading(false)
        return
      }
      await supabase.from('group_members').insert({ group_id: groupId, user_id: profile.id })
    } else {
      // Save pending invite
      await supabase.from('pending_invites').insert({
        group_id: groupId,
        email: email,
        invited_by: user!.id,
      })

      // Share invite link
      const inviteLink = `${window.location.origin}/signup?invite_group=${groupId}`
      const shareText = `Join "${group?.name}" on Hisaab Kitaab!\n\nSign up here: ${inviteLink}`

      if (navigator.share) {
        try { await navigator.share({ title: `Join ${group?.name}`, text: shareText }) }
        catch { await navigator.clipboard.writeText(inviteLink) }
      } else {
        await navigator.clipboard.writeText(inviteLink)
      }

      setMemError('')
      setMemberEmail('')
      setShowAddMember(false)
      setMemLoading(false)
      // Brief alert
      setInviteCopied(true)
      setTimeout(() => setInviteCopied(false), 3000)
      load()
      return
    }

    setShowAddMember(false)
    setMemberEmail('')
    load()
    setMemLoading(false)
  }

  const handleDeleteExpense = async (expId: string) => {
    await supabase.from('group_expenses').delete().eq('id', expId)
    load()
  }

  if (!group) {
    return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{group.name}</h1>
        {group.description && <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{group.description}</p>}
      </div>

      {/* Invite copied toast */}
      {inviteCopied && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 flex items-center gap-2">
          <span className="text-sm">📋</span>
          <p className="text-sm text-emerald-700 dark:text-emerald-400">Invite link copied to clipboard! Share it with them via WhatsApp, text, etc.</p>
        </div>
      )}

      {/* Settlement Banner */}
      {settlements.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">{settlements.length} settlement{settlements.length > 1 ? 's' : ''} needed</p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Simplified debts to minimize transactions</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setShowSettlements(true)}>View</Button>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={() => setShowAddExpense(true)}>+ Add Expense</Button>
        <Button variant="secondary" onClick={() => setShowAddMember(true)}>+ Add Member</Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        <button onClick={() => setTab('expenses')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'expenses' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500'}`}>
          Expenses ({expenses.length})
        </button>
        <button onClick={() => setTab('members')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'members' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500'}`}>
          Members ({members.length})
        </button>
      </div>

      {tab === 'expenses' && (
        <div className="space-y-3">
          {expenses.length === 0 ? (
            <Card className="text-center py-8">
              <p className="text-gray-400">No expenses yet</p>
            </Card>
          ) : expenses.map((exp) => (
            <Card key={exp.id}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 dark:text-white">{exp.description}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Paid by <span className="font-medium text-gray-600 dark:text-gray-300">{exp.payer?.full_name || 'Unknown'}</span>
                    {' · '}{exp.split_type} split
                    {' · '}{new Date(exp.created_at).toLocaleDateString()}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {exp.splits.map((s) => (
                      <span key={s.user_id} className="inline-flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-lg">
                        {s.profile?.full_name || 'Unknown'}: ₹{Number(s.amount).toLocaleString()}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right ml-4">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">₹{Number(exp.amount).toLocaleString()}</p>
                  {exp.paid_by === user?.id && (
                    <button onClick={() => handleDeleteExpense(exp.id)} className="text-xs text-red-400 hover:text-red-600 mt-1">Delete</button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'members' && (
        <div className="space-y-2">
          {members.map((m) => (
            <Card key={m.user_id}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 font-semibold text-sm">
                  {m.profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{m.profile?.full_name}</p>
                  <p className="text-xs text-gray-400">{m.profile?.email}</p>
                </div>
                {m.user_id === group.created_by && (
                  <span className="ml-auto text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">Admin</span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Expense Modal */}
      <Modal open={showAddExpense} onClose={() => setShowAddExpense(false)} title="Add Expense">
        <form onSubmit={handleAddExpense} className="space-y-4">
          <Input label="Description" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Dinner, Uber, etc." required />
          <Input label="Amount (₹)" type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          <Select
            label="Paid By"
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
            options={members.map(m => ({ value: m.user_id, label: m.profile?.full_name || m.user_id }))}
          />
          <Select
            label="Split Type"
            value={splitType}
            onChange={(e) => setSplitType(e.target.value)}
            options={[{ value: 'equal', label: 'Equal Split' }, { value: 'custom', label: 'Custom Split' }]}
          />

          {splitType === 'custom' && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">Enter amount for each member:</p>
              {members.map(m => (
                <Input
                  key={m.user_id}
                  label={m.profile?.full_name || ''}
                  type="number"
                  step="0.01"
                  min="0"
                  value={customSplits[m.user_id] || ''}
                  onChange={(e) => setCustomSplits(prev => ({ ...prev, [m.user_id]: e.target.value }))}
                  placeholder="0.00"
                />
              ))}
            </div>
          )}

          <Button type="submit" loading={expLoading} className="w-full">Add Expense</Button>
        </form>
      </Modal>

      {/* Add Member Modal */}
      <Modal open={showAddMember} onClose={() => setShowAddMember(false)} title="Add Member">
        <form onSubmit={handleAddMember} className="space-y-4">
          <Input label="Email" type="email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} placeholder="friend@example.com" required />
          {memError && <p className="text-sm text-red-500">{memError}</p>}
          <p className="text-xs text-gray-400">Existing users are added instantly. New users get an email invite and auto-join on signup.</p>
          <Button type="submit" loading={memLoading} className="w-full">Add Member</Button>
        </form>
      </Modal>

      {/* Settlements Modal */}
      <Modal open={showSettlements} onClose={() => setShowSettlements(false)} title="Settlements">
        <div className="space-y-3">
          {settlements.map((s, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 text-xs font-bold">
                {s.from_profile?.full_name?.charAt(0) || '?'}
              </div>
              <div className="flex-1 text-center">
                <p className="text-sm font-medium text-gray-900 dark:text-white">₹{s.amount.toLocaleString()}</p>
                <p className="text-xs text-gray-400">→</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 text-xs font-bold">
                {s.to_profile?.full_name?.charAt(0) || '?'}
              </div>
            </div>
          ))}
          <p className="text-xs text-gray-400 text-center mt-2">
            {settlements.length} transaction{settlements.length !== 1 ? 's' : ''} to settle all debts
          </p>
        </div>
      </Modal>
    </div>
  )
}
