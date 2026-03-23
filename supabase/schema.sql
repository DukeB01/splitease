-- ============================================
-- SplitEase Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Profiles (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text not null default '',
  avatar_url text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Public profiles are viewable by authenticated users"
  on profiles for select to authenticated using (true);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Groups
create table if not exists public.groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  created_by uuid references public.profiles(id) not null,
  created_at timestamptz default now()
);

alter table public.groups enable row level security;

-- Group Members
create table if not exists public.group_members (
  group_id uuid references public.groups(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

alter table public.group_members enable row level security;

-- Group policies
create policy "Group members can view their groups"
  on groups for select to authenticated
  using (id in (select group_id from group_members where user_id = auth.uid()));

create policy "Authenticated users can create groups"
  on groups for insert to authenticated
  with check (created_by = auth.uid());

create policy "Group creator can update"
  on groups for update to authenticated
  using (created_by = auth.uid());

create policy "Group creator can delete"
  on groups for delete to authenticated
  using (created_by = auth.uid());

-- Group members policies
create policy "Members can view group members"
  on group_members for select to authenticated
  using (group_id in (select group_id from group_members where user_id = auth.uid()));

create policy "Group creator can add members"
  on group_members for insert to authenticated
  with check (
    group_id in (select id from groups where created_by = auth.uid())
    or user_id = auth.uid()
  );

create policy "Group creator can remove members"
  on group_members for delete to authenticated
  using (group_id in (select id from groups where created_by = auth.uid()) or user_id = auth.uid());

-- Group Expenses
create table if not exists public.group_expenses (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  paid_by uuid references public.profiles(id) not null,
  split_type text not null default 'equal' check (split_type in ('equal', 'custom')),
  created_at timestamptz default now()
);

alter table public.group_expenses enable row level security;

create policy "Group members can view expenses"
  on group_expenses for select to authenticated
  using (group_id in (select group_id from group_members where user_id = auth.uid()));

create policy "Group members can add expenses"
  on group_expenses for insert to authenticated
  with check (group_id in (select group_id from group_members where user_id = auth.uid()));

create policy "Expense creator can delete"
  on group_expenses for delete to authenticated
  using (paid_by = auth.uid());

-- Expense Splits
create table if not exists public.expense_splits (
  id uuid default gen_random_uuid() primary key,
  expense_id uuid references public.group_expenses(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  amount numeric(12,2) not null check (amount >= 0)
);

alter table public.expense_splits enable row level security;

create policy "Group members can view splits"
  on expense_splits for select to authenticated
  using (expense_id in (
    select id from group_expenses where group_id in (
      select group_id from group_members where user_id = auth.uid()
    )
  ));

create policy "Group members can add splits"
  on expense_splits for insert to authenticated
  with check (expense_id in (
    select id from group_expenses where group_id in (
      select group_id from group_members where user_id = auth.uid()
    )
  ));

create policy "Splits deleted with expense"
  on expense_splits for delete to authenticated
  using (expense_id in (
    select id from group_expenses where paid_by = auth.uid()
  ));

-- Personal Expenses
create table if not exists public.personal_expenses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  category text not null default 'Other',
  date date not null default current_date,
  created_at timestamptz default now()
);

alter table public.personal_expenses enable row level security;

create policy "Users can view own expenses"
  on personal_expenses for select to authenticated
  using (user_id = auth.uid());

create policy "Users can add own expenses"
  on personal_expenses for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users can update own expenses"
  on personal_expenses for update to authenticated
  using (user_id = auth.uid());

create policy "Users can delete own expenses"
  on personal_expenses for delete to authenticated
  using (user_id = auth.uid());
