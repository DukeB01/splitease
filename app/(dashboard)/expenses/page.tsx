'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useUser } from '@/lib/hooks'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { PersonalExpense, Income, CATEGORIES, INCOME_SOURCES } from '@/lib/types'

type Tab = 'expenses' | 'income'

export default function ExpensesPage() {
  const { user } = useUser()
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('expenses')

  // Expenses
  const [expenses, setExpenses] = useState<PersonalExpense[]>([])
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [filter, setFilter] = useState('All')
  const [expLoading, setExpLoading] = useState(false)
  const [expDesc, setExpDesc] = useState('')
  const [expAmount, setExpAmount] = useState('')
  const [expCategory, setExpCategory] = useState<string>('Food & Dining')
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0])
  const [editExpId, setEditExpId] = useState<string | null>(null)

  // Income
  const [incomes, setIncomes] = useState<Income[]>([])
  const [showAddIncome, setShowAddIncome] = useState(false)
  const [incLoading, setIncLoading] = useState(false)
  const [incDesc, setIncDesc] = useState('')
  const [incAmount, setIncAmount] = useState('')
  const [incSource, setIncSource] = useState<string>('Salary')
  const [incDate, setIncDate] = useState(new Date().toISOString().split('T')[0])
  const [editIncId, setEditIncId] = useState<string | null>(null)

  // CSV
  const [showCSVModal, setShowCSVModal] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadExpenses = async () => {
    if (!user) return
    const { data } = await supabase
      .from('personal_expenses')
      .select('*')
      .order('date', { ascending: false })
    setExpenses(data || [])
  }

  const loadIncome = async () => {
    if (!user) return
    const { data } = await supabase
      .from('income')
      .select('*')
      .order('date', { ascending: false })
    setIncomes(data || [])
  }

  useEffect(() => { loadExpenses(); loadIncome() }, [user])

  // --- Expense CRUD ---
  const resetExpForm = () => {
    setExpDesc(''); setExpAmount(''); setExpCategory('Food & Dining')
    setExpDate(new Date().toISOString().split('T')[0]); setEditExpId(null)
  }

  const handleExpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setExpLoading(true)
    if (editExpId) {
      await supabase.from('personal_expenses').update({
        description: expDesc, amount: parseFloat(expAmount), category: expCategory, date: expDate,
      }).eq('id', editExpId)
    } else {
      await supabase.from('personal_expenses').insert({
        user_id: user.id, description: expDesc, amount: parseFloat(expAmount), category: expCategory, date: expDate,
      })
    }
    setShowAddExpense(false); resetExpForm(); loadExpenses(); setExpLoading(false)
  }

  const startEditExp = (exp: PersonalExpense) => {
    setEditExpId(exp.id); setExpDesc(exp.description); setExpAmount(String(exp.amount))
    setExpCategory(exp.category); setExpDate(exp.date); setShowAddExpense(true)
  }

  const deleteExp = async (id: string) => {
    await supabase.from('personal_expenses').delete().eq('id', id); loadExpenses()
  }

  // --- Income CRUD ---
  const resetIncForm = () => {
    setIncDesc(''); setIncAmount(''); setIncSource('Salary')
    setIncDate(new Date().toISOString().split('T')[0]); setEditIncId(null)
  }

  const handleIncSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setIncLoading(true)
    if (editIncId) {
      await supabase.from('income').update({
        description: incDesc, amount: parseFloat(incAmount), source: incSource, date: incDate,
      }).eq('id', editIncId)
    } else {
      await supabase.from('income').insert({
        user_id: user.id, description: incDesc, amount: parseFloat(incAmount), source: incSource, date: incDate,
      })
    }
    setShowAddIncome(false); resetIncForm(); loadIncome(); setIncLoading(false)
  }

  const startEditInc = (inc: Income) => {
    setEditIncId(inc.id); setIncDesc(inc.description); setIncAmount(String(inc.amount))
    setIncSource(inc.source); setIncDate(inc.date); setShowAddIncome(true)
  }

  const deleteInc = async (id: string) => {
    await supabase.from('income').delete().eq('id', id); loadIncome()
  }

  // --- CSV ---
  const handleExportCSV = () => {
    const filtered = filteredExpenses()
    const csv = ['Description,Amount,Category,Date', ...filtered.map(e => `"${e.description}",${e.amount},"${e.category}",${e.date}`)].join('\n')
    downloadFile(csv, 'expenses.csv', 'text/csv')
  }

  const handleDownloadTemplate = () => {
    const template = ['Description,Amount,Category,Date', 'Coffee,150,Food & Dining,2026-03-20', 'Uber ride,250,Transport,2026-03-19', 'Netflix,199,Entertainment,2026-03-15'].join('\n')
    downloadFile(template, 'expense_template.csv', 'text/csv')
  }

  function downloadFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploading(true); setUploadStatus(null)
    try {
      const text = await file.text()
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
      if (lines.length < 2) { setUploadStatus({ type: 'error', message: 'CSV must have a header + at least one data row.' }); setUploading(false); return }
      const header = lines[0].toLowerCase()
      if (!header.includes('description') || !header.includes('amount') || !header.includes('category') || !header.includes('date')) {
        setUploadStatus({ type: 'error', message: 'CSV must have columns: Description, Amount, Category, Date' }); setUploading(false); return
      }
      const rows: { user_id: string; description: string; amount: number; category: string; date: string }[] = []
      const errors: string[] = []
      const validCategories = new Set(CATEGORIES as readonly string[])
      for (let i = 1; i < lines.length; i++) {
        const fields = parseCSVLine(lines[i])
        if (fields.length < 4) { errors.push(`Row ${i + 1}: not enough columns`); continue }
        const [rawDesc, rawAmount, rawCategory, rawDate] = fields
        const amt = parseFloat(rawAmount)
        if (!rawDesc.trim()) { errors.push(`Row ${i + 1}: missing description`); continue }
        if (isNaN(amt) || amt <= 0) { errors.push(`Row ${i + 1}: invalid amount`); continue }
        if (!rawDate.match(/^\d{4}-\d{2}-\d{2}$/)) { errors.push(`Row ${i + 1}: date must be YYYY-MM-DD`); continue }
        rows.push({ user_id: user.id, description: rawDesc.trim(), amount: amt, category: validCategories.has(rawCategory.trim()) ? rawCategory.trim() : 'Other', date: rawDate.trim() })
      }
      if (rows.length === 0) { setUploadStatus({ type: 'error', message: `No valid rows. ${errors.slice(0, 3).join('; ')}` }); setUploading(false); return }
      const { error } = await supabase.from('personal_expenses').insert(rows)
      if (error) { setUploadStatus({ type: 'error', message: `Upload failed: ${error.message}` }) }
      else { setUploadStatus({ type: 'success', message: `Imported ${rows.length} expense${rows.length > 1 ? 's' : ''}!${errors.length > 0 ? ` (${errors.length} skipped)` : ''}` }); loadExpenses() }
    } catch { setUploadStatus({ type: 'error', message: 'Failed to read file.' }) }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const filteredExpenses = () => filter === 'All' ? expenses : expenses.filter(e => e.category === filter)
  const totalExpenses = filteredExpenses().reduce((s, e) => s + Number(e.amount), 0)
  const totalIncome = incomes.reduce((s, e) => s + Number(e.amount), 0)

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Money Tracker</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Track income & expenses</p>
        </div>
        <div className="flex gap-2">
          {tab === 'expenses' && (
            <Button variant="ghost" size="sm" onClick={() => { setShowCSVModal(true); setUploadStatus(null) }}>
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
              CSV
            </Button>
          )}
          <Button onClick={() => tab === 'expenses' ? (resetExpForm(), setShowAddExpense(true)) : (resetIncForm(), setShowAddIncome(true))}>
            + Add {tab === 'expenses' ? 'Expense' : 'Income'}
          </Button>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        <button onClick={() => setTab('expenses')} className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${tab === 'expenses' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500'}`}>
          Expenses
        </button>
        <button onClick={() => setTab('income')} className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${tab === 'income' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500'}`}>
          Income
        </button>
      </div>

      {/* ====== EXPENSES TAB ====== */}
      {tab === 'expenses' && (
        <>
          {/* Category filter */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
            {['All', ...CATEGORIES].map(cat => (
              <button key={cat} onClick={() => setFilter(cat)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === cat ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
              >{cat}</button>
            ))}
          </div>

          <Card className="bg-gradient-to-r from-red-500 to-rose-500 border-0 text-white">
            <p className="text-xs opacity-80 uppercase tracking-wide">Total {filter !== 'All' ? filter : ''} Spending</p>
            <p className="text-3xl font-bold mt-1">₹{totalExpenses.toLocaleString()}</p>
            <p className="text-xs opacity-70 mt-1">{filteredExpenses().length} transactions</p>
          </Card>

          <div className="space-y-2">
            {filteredExpenses().length === 0 ? (
              <Card className="text-center py-8"><p className="text-gray-400">No expenses found</p></Card>
            ) : filteredExpenses().map((exp) => (
              <Card key={exp.id} className="hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-lg">{getCategoryEmoji(exp.category)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{exp.description}</p>
                    <p className="text-xs text-gray-400">{exp.category} · {new Date(exp.date).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-500">-₹{Number(exp.amount).toLocaleString()}</p>
                    <div className="flex gap-2 mt-1">
                      <button onClick={() => startEditExp(exp)} className="text-xs text-gray-400 hover:text-emerald-600">Edit</button>
                      <button onClick={() => deleteExp(exp.id)} className="text-xs text-gray-400 hover:text-red-500">Delete</button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* ====== INCOME TAB ====== */}
      {tab === 'income' && (
        <>
          <Card className="bg-gradient-to-r from-emerald-500 to-teal-500 border-0 text-white">
            <p className="text-xs opacity-80 uppercase tracking-wide">Total Income</p>
            <p className="text-3xl font-bold mt-1">₹{totalIncome.toLocaleString()}</p>
            <p className="text-xs opacity-70 mt-1">{incomes.length} entries</p>
          </Card>

          <div className="space-y-2">
            {incomes.length === 0 ? (
              <Card className="text-center py-8"><p className="text-gray-400">No income entries yet</p></Card>
            ) : incomes.map((inc) => (
              <Card key={inc.id} className="hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-lg">{getSourceEmoji(inc.source)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{inc.description}</p>
                    <p className="text-xs text-gray-400">{inc.source} · {new Date(inc.date).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-600">+₹{Number(inc.amount).toLocaleString()}</p>
                    <div className="flex gap-2 mt-1">
                      <button onClick={() => startEditInc(inc)} className="text-xs text-gray-400 hover:text-emerald-600">Edit</button>
                      <button onClick={() => deleteInc(inc.id)} className="text-xs text-gray-400 hover:text-red-500">Delete</button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Add/Edit Expense Modal */}
      <Modal open={showAddExpense} onClose={() => { setShowAddExpense(false); resetExpForm() }} title={editExpId ? 'Edit Expense' : 'Add Expense'}>
        <form onSubmit={handleExpSubmit} className="space-y-4">
          <Input label="Description" value={expDesc} onChange={(e) => setExpDesc(e.target.value)} placeholder="Coffee, groceries..." required />
          <Input label="Amount (₹)" type="number" step="0.01" min="0.01" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} required />
          <Select label="Category" value={expCategory} onChange={(e) => setExpCategory(e.target.value)} options={CATEGORIES.map(c => ({ value: c, label: c }))} />
          <Input label="Date" type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} required />
          <Button type="submit" loading={expLoading} className="w-full">{editExpId ? 'Update' : 'Add Expense'}</Button>
        </form>
      </Modal>

      {/* Add/Edit Income Modal */}
      <Modal open={showAddIncome} onClose={() => { setShowAddIncome(false); resetIncForm() }} title={editIncId ? 'Edit Income' : 'Add Income'}>
        <form onSubmit={handleIncSubmit} className="space-y-4">
          <Input label="Description" value={incDesc} onChange={(e) => setIncDesc(e.target.value)} placeholder="Monthly salary, freelance gig..." required />
          <Input label="Amount (₹)" type="number" step="0.01" min="0.01" value={incAmount} onChange={(e) => setIncAmount(e.target.value)} required />
          <Select label="Source" value={incSource} onChange={(e) => setIncSource(e.target.value)} options={INCOME_SOURCES.map(s => ({ value: s, label: s }))} />
          <Input label="Date" type="date" value={incDate} onChange={(e) => setIncDate(e.target.value)} required />
          <Button type="submit" loading={incLoading} className="w-full">{editIncId ? 'Update' : 'Add Income'}</Button>
        </form>
      </Modal>

      {/* CSV Modal */}
      <Modal open={showCSVModal} onClose={() => setShowCSVModal(false)} title="Import / Export CSV">
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Export Expenses</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Download your{filter !== 'All' ? ` ${filter}` : ''} expenses as CSV.</p>
            <Button variant="secondary" size="sm" onClick={handleExportCSV} className="w-full">
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
              Export CSV ({filteredExpenses().length} expenses)
            </Button>
          </div>
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200 dark:border-gray-700" /></div>
            <div className="relative flex justify-center text-xs"><span className="px-3 bg-white dark:bg-gray-800 text-gray-400">or</span></div>
          </div>
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Import from CSV</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Upload a CSV to bulk import expenses.</p>
            <Button variant="ghost" size="sm" onClick={handleDownloadTemplate} className="w-full mb-3">
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
              Download Template CSV
            </Button>
            <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${uploading ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10' : 'border-gray-300 dark:border-gray-600 hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10'}`}>
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" disabled={uploading} />
              {uploading ? (
                <div className="flex items-center gap-2"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600" /><span className="text-sm text-emerald-600">Importing...</span></div>
              ) : (
                <><svg className="w-8 h-8 text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg><span className="text-xs text-gray-500 dark:text-gray-400">Click to upload CSV file</span></>
              )}
            </label>
            {uploadStatus && (
              <div className={`mt-3 p-3 rounded-lg text-sm ${uploadStatus.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>{uploadStatus.message}</div>
            )}
          </div>
          <div className="text-xs text-gray-400 space-y-1">
            <p className="font-medium text-gray-500 dark:text-gray-300">CSV Format:</p>
            <code className="block bg-gray-100 dark:bg-gray-700 p-2 rounded-lg text-[11px] font-mono">Description,Amount,Category,Date<br/>Coffee,150,Food & Dining,2026-03-20</code>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function getCategoryEmoji(cat: string): string {
  const map: Record<string, string> = {
    'Food & Dining': '🍕', 'Rent & Housing': '🏠', 'Transport': '🚗', 'Shopping': '🛒',
    'Entertainment': '🎬', 'Health': '💊', 'Travel': '✈️', 'Utilities': '💡', 'Education': '📚', 'Other': '📌',
  }
  return map[cat] || '📌'
}

function getSourceEmoji(source: string): string {
  const map: Record<string, string> = {
    'Salary': '💰', 'Freelance': '💻', 'Investments': '📈', 'Refund': '🔄',
    'Gift': '🎁', 'Budget Allocation': '🏦', 'Other': '💵',
  }
  return map[source] || '💵'
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { inQuotes = !inQuotes }
    else if (ch === ',' && !inQuotes) { result.push(current); current = '' }
    else { current += ch }
  }
  result.push(current)
  return result
}
