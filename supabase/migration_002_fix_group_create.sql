-- ============================================
-- Migration 002: Fix group creation RLS
-- Run this in Supabase SQL Editor
-- ============================================

-- Problem: After INSERT on groups, the chained .select() fails because
-- the SELECT policy requires group_members membership, but the creator
-- hasn't been added to group_members yet.
--
-- Fix: Allow creators to also see groups they created.

-- Drop and recreate the groups SELECT policy
drop policy if exists "Group members can view their groups" on groups;

create policy "Group members or creator can view groups"
  on groups for select to authenticated
  using (
    created_by = auth.uid()
    or id in (select get_my_group_ids())
  );

-- Fix group_members INSERT: the current policy checks groups.created_by,
-- but that SELECT on groups may also be blocked. Use a security definer function instead.

create or replace function public.is_group_creator(gid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(select 1 from groups where id = gid and created_by = auth.uid());
$$;

-- Drop and recreate group_members INSERT policy
drop policy if exists "Authenticated can add group members" on group_members;

create policy "Creator or self can add group members"
  on group_members for insert to authenticated
  with check (
    is_group_creator(group_id)
    or user_id = auth.uid()
  );

-- Also fix group_members DELETE policy for the same reason
drop policy if exists "Can remove group members" on group_members;

create policy "Creator or self can remove group members"
  on group_members for delete to authenticated
  using (
    is_group_creator(group_id)
    or user_id = auth.uid()
  );
