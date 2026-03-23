-- ============================================
-- Migration 001: Fix RLS recursion + Add Income
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- PART 1: Fix infinite recursion in RLS
-- The problem: group_members SELECT policy queries group_members → infinite loop
-- The fix: use a security definer function that bypasses RLS
-- ============================================

-- Helper function that bypasses RLS to check membership
create or replace function public.get_my_group_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select group_id from group_members where user_id = auth.uid();
$$;

-- Drop all old problematic policies
drop policy if exists "Members can view group members" on group_members;
drop policy if exists "Group creator can add members" on group_members;
drop policy if exists "Group creator can remove members" on group_members;
drop policy if exists "Group members can view their groups" on groups;
drop policy if exists "Group members can view expenses" on group_expenses;
drop policy if exists "Group members can add expenses" on group_expenses;
drop policy if exists "Group members can view splits" on expense_splits;
drop policy if exists "Group members can add splits" on expense_splits;

-- Recreate group_members policies using the helper function
create policy "Members can view group members"
  on group_members for select to authenticated
  using (group_id in (select get_my_group_ids()));

create policy "Authenticated can add group members"
  on group_members for insert to authenticated
  with check (
    group_id in (select id from groups where created_by = auth.uid())
    or user_id = auth.uid()
  );

create policy "Can remove group members"
  on group_members for delete to authenticated
  using (
    group_id in (select id from groups where created_by = auth.uid())
    or user_id = auth.uid()
  );

-- Recreate groups SELECT policy using the helper function
create policy "Group members can view their groups"
  on groups for select to authenticated
  using (id in (select get_my_group_ids()));

-- Recreate group_expenses policies using the helper function
create policy "Group members can view expenses"
  on group_expenses for select to authenticated
  using (group_id in (select get_my_group_ids()));

create policy "Group members can add expenses"
  on group_expenses for insert to authenticated
  with check (group_id in (select get_my_group_ids()));

-- Recreate expense_splits policies using the helper function
create policy "Group members can view splits"
  on expense_splits for select to authenticated
  using (expense_id in (
    select id from group_expenses where group_id in (select get_my_group_ids())
  ));

create policy "Group members can add splits"
  on expense_splits for insert to authenticated
  with check (expense_id in (
    select id from group_expenses where group_id in (select get_my_group_ids())
  ));

-- ============================================
-- PART 2: Add Income table
-- ============================================

create table if not exists public.income (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  source text not null default 'Other',
  date date not null default current_date,
  created_at timestamptz default now()
);

alter table public.income enable row level security;

create policy "Users can view own income"
  on income for select to authenticated
  using (user_id = auth.uid());

create policy "Users can add own income"
  on income for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users can update own income"
  on income for update to authenticated
  using (user_id = auth.uid());

create policy "Users can delete own income"
  on income for delete to authenticated
  using (user_id = auth.uid());
