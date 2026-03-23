-- ============================================
-- Migration 003: Pending invites + Notifications
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- PART 1: Pending invites table
-- When a non-existing user is invited, store their email + group_id.
-- When they sign up, a trigger auto-adds them to the group.
-- ============================================

create table if not exists public.pending_invites (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  email text not null,
  invited_by uuid references public.profiles(id) not null,
  created_at timestamptz default now(),
  unique(group_id, email)
);

alter table public.pending_invites enable row level security;

-- Anyone authenticated can view/create/delete invites for groups they created
create policy "Creator can manage invites"
  on pending_invites for all to authenticated
  using (is_group_creator(group_id))
  with check (is_group_creator(group_id));

-- Also allow users to see invites for their own email
create policy "Users can see own invites"
  on pending_invites for select to authenticated
  using (email = (select email from auth.users where id = auth.uid()));

-- ============================================
-- PART 2: Notifications table
-- ============================================

create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  message text not null,
  read boolean default false,
  link text,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;

create policy "Users can view own notifications"
  on notifications for select to authenticated
  using (user_id = auth.uid());

create policy "Users can update own notifications"
  on notifications for update to authenticated
  using (user_id = auth.uid());

create policy "Users can delete own notifications"
  on notifications for delete to authenticated
  using (user_id = auth.uid());

-- System can insert notifications (via trigger)
create policy "System can insert notifications"
  on notifications for insert to authenticated
  with check (true);

-- ============================================
-- PART 3: Auto-join trigger
-- When a new user signs up, check pending_invites for their email.
-- If found, add them to the group(s) and create notifications.
-- ============================================

create or replace function public.handle_new_user()
returns trigger as $$
declare
  invite record;
  group_name text;
  inviter_name text;
begin
  -- Create profile
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );

  -- Process pending invites
  for invite in
    select pi.group_id, pi.invited_by
    from public.pending_invites pi
    where lower(pi.email) = lower(new.email)
  loop
    -- Add to group
    insert into public.group_members (group_id, user_id)
    values (invite.group_id, new.id)
    on conflict do nothing;

    -- Get group name for notification
    select name into group_name from public.groups where id = invite.group_id;
    select full_name into inviter_name from public.profiles where id = invite.invited_by;

    -- Notify the new user
    insert into public.notifications (user_id, title, message, link)
    values (
      new.id,
      'Group Invite Accepted',
      'You have been added to "' || coalesce(group_name, 'a group') || '" by ' || coalesce(inviter_name, 'someone'),
      '/groups/' || invite.group_id
    );

    -- Notify the inviter
    insert into public.notifications (user_id, title, message, link)
    values (
      invite.invited_by,
      'Invite Accepted',
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)) || ' joined "' || coalesce(group_name, 'your group') || '"',
      '/groups/' || invite.group_id
    );

    -- Delete the processed invite
    delete from public.pending_invites where group_id = invite.group_id and lower(email) = lower(new.email);
  end loop;

  return new;
end;
$$ language plpgsql security definer;

-- ============================================
-- PART 4: Notification when someone is directly added to a group
-- (for existing users added via email)
-- ============================================

create or replace function public.notify_group_member_added()
returns trigger as $$
declare
  group_name text;
  adder_name text;
begin
  -- Don't notify if user added themselves (group creator)
  if new.user_id = auth.uid() then
    return new;
  end if;

  select name into group_name from public.groups where id = new.group_id;
  select full_name into adder_name from public.profiles where id = auth.uid();

  -- Notify the added user
  insert into public.notifications (user_id, title, message, link)
  values (
    new.user_id,
    'Added to Group',
    coalesce(adder_name, 'Someone') || ' added you to "' || coalesce(group_name, 'a group') || '"',
    '/groups/' || new.group_id
  );

  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_group_member_added
  after insert on public.group_members
  for each row execute function public.notify_group_member_added();
