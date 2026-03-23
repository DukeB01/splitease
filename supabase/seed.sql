-- ============================================
-- Seed Data (run AFTER creating test users)
-- ============================================
-- NOTE: First create 2-3 users via the app signup.
-- Then update the UUIDs below with real user IDs from auth.users.
-- This is a template — replace 'USER1_ID', 'USER2_ID', 'USER3_ID'.

-- Example: Insert a group
-- insert into public.groups (id, name, description, created_by)
-- values ('11111111-1111-1111-1111-111111111111', 'Goa Trip', 'Beach vacation expenses', 'USER1_ID');

-- Add members
-- insert into public.group_members (group_id, user_id) values
--   ('11111111-1111-1111-1111-111111111111', 'USER1_ID'),
--   ('11111111-1111-1111-1111-111111111111', 'USER2_ID'),
--   ('11111111-1111-1111-1111-111111111111', 'USER3_ID');

-- Add a group expense (USER1 paid 3000, split equally)
-- insert into public.group_expenses (id, group_id, description, amount, paid_by, split_type)
-- values ('aaaa-...', '11111111-...', 'Hotel booking', 3000, 'USER1_ID', 'equal');

-- Splits
-- insert into public.expense_splits (expense_id, user_id, amount) values
--   ('aaaa-...', 'USER1_ID', 1000),
--   ('aaaa-...', 'USER2_ID', 1000),
--   ('aaaa-...', 'USER3_ID', 1000);

-- Personal expenses
-- insert into public.personal_expenses (user_id, description, amount, category, date) values
--   ('USER1_ID', 'Groceries', 850, 'Food & Dining', '2026-03-20'),
--   ('USER1_ID', 'Uber ride', 250, 'Transport', '2026-03-19'),
--   ('USER1_ID', 'Netflix', 199, 'Entertainment', '2026-03-15');
