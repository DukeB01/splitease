import { Balance } from './types'

/**
 * Minimize transactions using a greedy algorithm.
 * Takes a list of (from, to, amount) debts and simplifies them.
 */
export function simplifyDebts(
  debts: { from: string; to: string; amount: number }[]
): Balance[] {
  // Calculate net balance for each person
  const netBalance = new Map<string, number>()

  for (const debt of debts) {
    netBalance.set(debt.from, (netBalance.get(debt.from) || 0) - debt.amount)
    netBalance.set(debt.to, (netBalance.get(debt.to) || 0) + debt.amount)
  }

  // Separate into creditors (positive) and debtors (negative)
  const creditors: { user: string; amount: number }[] = []
  const debtors: { user: string; amount: number }[] = []

  netBalance.forEach((amount, user) => {
    if (amount > 0.01) creditors.push({ user, amount })
    else if (amount < -0.01) debtors.push({ user, amount: -amount })
  })

  // Sort descending for greedy matching
  creditors.sort((a, b) => b.amount - a.amount)
  debtors.sort((a, b) => b.amount - a.amount)

  const settlements: Balance[] = []
  let i = 0, j = 0

  while (i < debtors.length && j < creditors.length) {
    const settleAmount = Math.min(debtors[i].amount, creditors[j].amount)

    if (settleAmount > 0.01) {
      settlements.push({
        from_user: debtors[i].user,
        to_user: creditors[j].user,
        amount: Math.round(settleAmount * 100) / 100,
      })
    }

    debtors[i].amount -= settleAmount
    creditors[j].amount -= settleAmount

    if (debtors[i].amount < 0.01) i++
    if (creditors[j].amount < 0.01) j++
  }

  return settlements
}
