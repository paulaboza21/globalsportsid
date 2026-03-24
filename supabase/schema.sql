create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('player', 'coach', 'agency');
  end if;
  if not exists (select 1 from pg_type where typname = 'sport_type') then
    create type public.sport_type as enum ('soccer', 'football', 'tennis', 'baseball', 'basketball');
  end if;
  if not exists (select 1 from pg_type where typname = 'request_status') then
    create type public.request_status as enum ('pending', 'accepted', 'declined');
  end if;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null,
  sport public.sport_type,
  full_name text not null,
  email text,
  team_name text,
  gender text,
  nationality text,
  age integer,
  position text,
  city text,
  country text,
  bio text,
  highlights_url text,
  stats text,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  sport public.sport_type,
  note text,
  status public.request_status not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  unique (sender_id, receiver_id)
);

create table if not exists public.trials (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  sport public.sport_type not null,
  team_name text not null,
  location_text text not null,
  event_time text not null,
  description text not null,
  registration_link text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  sport public.sport_type not null,
  team_name text not null,
  details text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (conversation_id, profile_id)
);

create table if not exists public.direct_conversation_pairs (
  profile_low uuid not null references public.profiles (id) on delete cascade,
  profile_high uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid not null unique references public.conversations (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (profile_low, profile_high),
  check (profile_low <> profile_high)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists contact_requests_receiver_status_idx
  on public.contact_requests (receiver_id, status, created_at desc);

create index if not exists contact_requests_sender_receiver_idx
  on public.contact_requests (sender_id, receiver_id);

create index if not exists conversation_members_profile_idx
  on public.conversation_members (profile_id, conversation_id);

create index if not exists direct_conversation_pairs_conversation_idx
  on public.direct_conversation_pairs (conversation_id);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.get_profile_sport(profile_uuid uuid)
returns public.sport_type
language sql
stable
security definer
set search_path = public
as $$
  select sport
  from public.profiles
  where id = profile_uuid
$$;

create or replace function public.current_user_sport()
returns public.sport_type
language sql
stable
security definer
set search_path = public
as $$
  select sport
  from public.profiles
  where id = auth.uid()
$$;

create or replace function public.lookup_role_by_email(target_email text)
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where lower(email) = lower(target_email)
  limit 1
$$;

create or replace function public.is_conversation_member(conversation_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_members
    where conversation_id = conversation_uuid
      and profile_id = auth.uid()
  )
$$;

create or replace function public.enforce_profile_sport_lock()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.role is not null and new.role is distinct from old.role then
    raise exception 'Profile role cannot be changed after registration.';
  end if;

  if tg_op = 'UPDATE' and old.sport is not null and new.sport is distinct from old.sport then
    raise exception 'Profile sport cannot be changed after registration.';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_profile_requirements()
returns trigger
language plpgsql
as $$
begin
  if new.sport is null then
    raise exception 'Sport is required.';
  end if;

  if nullif(btrim(new.full_name), '') is null then
    raise exception 'Full name is required.';
  end if;

  if new.email is not null and new.email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'Email must be a valid email address.';
  end if;

  if new.role = 'player' then
    if nullif(btrim(coalesce(new.gender, '')), '') is null then
      raise exception 'Gender is required for player accounts.';
    end if;

    if lower(new.gender) not in ('female', 'male') then
      raise exception 'Gender must be female or male.';
    end if;

    if new.age is null then
      raise exception 'Age is required for player accounts.';
    end if;

    if new.age < 5 or new.age > 100 then
      raise exception 'Age must be between 5 and 100.';
    end if;

    if nullif(btrim(coalesce(new.position, '')), '') is null then
      raise exception 'Position is required for player accounts.';
    end if;
  end if;

  if new.role = 'coach' then
    if nullif(btrim(coalesce(new.team_name, '')), '') is null then
      raise exception 'Team is required for coach accounts.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_trial_sport_match()
returns trigger
language plpgsql
as $$
declare
  coach_role public.app_role;
  coach_sport public.sport_type;
begin
  select role, sport
  into coach_role, coach_sport
  from public.profiles
  where id = new.coach_id;

  if coach_role is distinct from 'coach' then
    raise exception 'Only coach profiles can create or update trials.';
  end if;

  if coach_sport is null then
    raise exception 'Coach profile must have a sport before publishing a trial.';
  end if;

  if new.sport is distinct from coach_sport then
    raise exception 'Trial sport must match the coach profile sport.';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_offer_sport_match()
returns trigger
language plpgsql
as $$
declare
  coach_role public.app_role;
  coach_sport public.sport_type;
begin
  select role, sport
  into coach_role, coach_sport
  from public.profiles
  where id = new.coach_id;

  if coach_role is distinct from 'coach' then
    raise exception 'Only coach profiles can create or update offers.';
  end if;

  if coach_sport is null then
    raise exception 'Coach profile must have a sport before publishing an offer.';
  end if;

  if new.sport is distinct from coach_sport then
    raise exception 'Offer sport must match the coach profile sport.';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_conversation_member_rules()
returns trigger
language plpgsql
as $$
declare
  existing_member_count integer;
  existing_sport public.sport_type;
  existing_role public.app_role;
  incoming_sport public.sport_type;
  incoming_role public.app_role;
  other_member_id uuid;
begin
  incoming_sport := public.get_profile_sport(new.profile_id);
  select role into incoming_role from public.profiles where id = new.profile_id;

  if incoming_sport is null then
    raise exception 'Conversation members must have a sport.';
  end if;

  if incoming_role is null then
    raise exception 'Conversation members must have a valid role.';
  end if;

  select count(*), max(public.get_profile_sport(profile_id)), max(role)
  into existing_member_count, existing_sport, existing_role
  from public.conversation_members
  join public.profiles on profiles.id = conversation_members.profile_id
  where conversation_id = new.conversation_id
    and conversation_members.profile_id <> new.profile_id;

  if existing_member_count >= 2 then
    raise exception 'Conversations are limited to two members.';
  end if;

  if existing_sport is not null and existing_sport is distinct from incoming_sport then
    raise exception 'Conversation members must share the same sport.';
  end if;

  if existing_role is not null and existing_role = incoming_role then
    raise exception 'Conversations are only allowed between a player and a coach.';
  end if;

  if existing_member_count = 1 then
    select profile_id
    into other_member_id
    from public.conversation_members
    where conversation_id = new.conversation_id
      and profile_id <> new.profile_id
    limit 1;

    if exists (
      select 1
      from public.conversation_members existing_pair
      where existing_pair.profile_id in (new.profile_id, other_member_id)
        and existing_pair.conversation_id <> new.conversation_id
      group by existing_pair.conversation_id
      having count(distinct existing_pair.profile_id) = 2
        and count(*) = 2
    ) then
      raise exception 'A direct conversation between these two users already exists.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_contact_request_sport_match()
returns trigger
language plpgsql
as $$
declare
  sender_role public.app_role;
  receiver_role public.app_role;
  sender_sport public.sport_type;
  receiver_sport public.sport_type;
  normalized_sender uuid;
  normalized_receiver uuid;
begin
  if new.sender_id = new.receiver_id then
    raise exception 'Users cannot send contact requests to themselves.';
  end if;

  normalized_sender := least(new.sender_id, new.receiver_id);
  normalized_receiver := greatest(new.sender_id, new.receiver_id);

  if exists (
    select 1
    from public.contact_requests existing_request
    where least(existing_request.sender_id, existing_request.receiver_id) = normalized_sender
      and greatest(existing_request.sender_id, existing_request.receiver_id) = normalized_receiver
      and existing_request.id is distinct from coalesce(new.id, existing_request.id)
    ) then
      raise exception 'A contact request between these two users already exists.';
    end if;

    select role, sport
    into sender_role, sender_sport
    from public.profiles
    where id = new.sender_id;

    select role, sport
    into receiver_role, receiver_sport
    from public.profiles
    where id = new.receiver_id;

    if sender_role is null or receiver_role is null then
      raise exception 'Both profiles must exist before sending contact requests.';
    end if;

    if sender_role = receiver_role then
      raise exception 'Contact requests are only allowed between a player and a coach.';
    end if;
  
    if sender_sport is null or receiver_sport is null then
      raise exception 'Both profiles must have a sport before sending contact requests.';
    end if;

  if sender_sport is distinct from receiver_sport then
    raise exception 'Contact requests are only allowed between matching sports.';
  end if;

  if new.sport is null then
    new.sport := sender_sport;
  end if;

  if new.sport is distinct from sender_sport then
    raise exception 'Contact request sport must match the sender profile sport.';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_contact_request_update_rules()
returns trigger
language plpgsql
as $$
declare
  acting_user uuid := auth.uid();
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.sender_id is distinct from new.sender_id
    or old.receiver_id is distinct from new.receiver_id
    or old.sport is distinct from new.sport then
    raise exception 'Contact request participants and sport cannot be changed.';
  end if;

  if acting_user is null then
    raise exception 'Authenticated user required.';
  end if;

  if old.status in ('accepted', 'declined') and new.status is distinct from old.status then
    raise exception 'Accepted or declined requests cannot be changed again.';
  end if;

  if acting_user = old.sender_id then
    if new.status is distinct from 'pending' then
      raise exception 'Senders can only keep a request pending.';
    end if;
  elsif acting_user = old.receiver_id then
    if new.note is distinct from old.note then
      raise exception 'Receivers cannot change the request note.';
    end if;

    if new.status not in ('accepted', 'declined') then
      raise exception 'Receivers can only accept or decline requests.';
    end if;

    if old.status is distinct from 'pending' and new.status is distinct from old.status then
      raise exception 'Receivers can only act on pending requests.';
    end if;
  else
    raise exception 'Only the sender or receiver can update this request.';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_message_update_rules()
returns trigger
language plpgsql
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.conversation_id is distinct from new.conversation_id
    or old.sender_id is distinct from new.sender_id
    or old.body is distinct from new.body
    or old.created_at is distinct from new.created_at then
    raise exception 'Only the read state can be updated on messages.';
  end if;

  if auth.uid() is null then
    raise exception 'Authenticated user required.';
  end if;

  if old.sender_id = auth.uid() then
    raise exception 'Senders cannot mark their own messages as read.';
  end if;

  if new.is_read is not true then
    raise exception 'Messages can only be marked as read.';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_message_insert_rules()
returns trigger
language plpgsql
as $$
begin
  if nullif(btrim(new.body), '') is null then
    raise exception 'Message body is required.';
  end if;

  return new;
end;
$$;

create or replace function public.get_or_create_direct_conversation(other_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_user uuid := auth.uid();
  acting_role public.app_role;
  acting_sport public.sport_type;
  other_role public.app_role;
  other_sport public.sport_type;
  low_profile_id uuid;
  high_profile_id uuid;
  existing_conversation_id uuid;
  new_conversation_id uuid;
begin
  if acting_user is null then
    raise exception 'Authenticated user required.';
  end if;

  if other_profile_id is null then
    raise exception 'Other profile is required.';
  end if;

  if acting_user = other_profile_id then
    raise exception 'Users cannot message themselves.';
  end if;

  select role, sport
  into acting_role, acting_sport
  from public.profiles
  where id = acting_user;

  select role, sport
  into other_role, other_sport
  from public.profiles
  where id = other_profile_id;

  if acting_role is null or other_role is null then
    raise exception 'Both profiles must exist before opening a conversation.';
  end if;

  if acting_sport is null or other_sport is null then
    raise exception 'Both profiles must have a sport before opening a conversation.';
  end if;

  if acting_role = other_role then
    raise exception 'Conversations are only allowed between a player and a coach.';
  end if;

  if acting_sport is distinct from other_sport then
    raise exception 'Conversation members must share the same sport.';
  end if;

  low_profile_id := least(acting_user, other_profile_id);
  high_profile_id := greatest(acting_user, other_profile_id);

  perform pg_advisory_xact_lock(hashtext(low_profile_id::text || ':' || high_profile_id::text));

  select direct_conversation_pairs.conversation_id
  into existing_conversation_id
  from public.direct_conversation_pairs
  where profile_low = low_profile_id
    and profile_high = high_profile_id;

  if existing_conversation_id is not null then
    return existing_conversation_id;
  end if;

  select existing_pair.conversation_id
  into existing_conversation_id
  from public.conversation_members existing_pair
  where existing_pair.profile_id in (acting_user, other_profile_id)
  group by existing_pair.conversation_id
  having count(distinct existing_pair.profile_id) = 2
    and count(*) = 2
  limit 1;

  if existing_conversation_id is not null then
    insert into public.direct_conversation_pairs (profile_low, profile_high, conversation_id)
    values (low_profile_id, high_profile_id, existing_conversation_id)
    on conflict (profile_low, profile_high) do update
    set conversation_id = excluded.conversation_id;

    return existing_conversation_id;
  end if;

  insert into public.conversations default values
  returning id into new_conversation_id;

  insert into public.conversation_members (conversation_id, profile_id)
  values
    (new_conversation_id, acting_user),
    (new_conversation_id, other_profile_id);

  insert into public.direct_conversation_pairs (profile_low, profile_high, conversation_id)
  values (low_profile_id, high_profile_id, new_conversation_id)
  on conflict (profile_low, profile_high) do update
  set conversation_id = excluded.conversation_id;

  return new_conversation_id;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists trials_set_updated_at on public.trials;
create trigger trials_set_updated_at
before update on public.trials
for each row
execute function public.set_updated_at();

drop trigger if exists offers_set_updated_at on public.offers;
create trigger offers_set_updated_at
before update on public.offers
for each row
execute function public.set_updated_at();

drop trigger if exists profiles_enforce_sport_lock on public.profiles;
create trigger profiles_enforce_sport_lock
before update on public.profiles
for each row
execute function public.enforce_profile_sport_lock();

drop trigger if exists profiles_enforce_requirements on public.profiles;
create trigger profiles_enforce_requirements
before insert or update on public.profiles
for each row
execute function public.enforce_profile_requirements();

drop trigger if exists trials_enforce_sport_match on public.trials;
create trigger trials_enforce_sport_match
before insert or update on public.trials
for each row
execute function public.enforce_trial_sport_match();

drop trigger if exists offers_enforce_sport_match on public.offers;
create trigger offers_enforce_sport_match
before insert or update on public.offers
for each row
execute function public.enforce_offer_sport_match();

drop trigger if exists contact_requests_enforce_sport_match on public.contact_requests;
create trigger contact_requests_enforce_sport_match
before insert or update on public.contact_requests
for each row
execute function public.enforce_contact_request_sport_match();

drop trigger if exists conversation_members_enforce_rules on public.conversation_members;
create trigger conversation_members_enforce_rules
before insert on public.conversation_members
for each row
execute function public.enforce_conversation_member_rules();

drop trigger if exists contact_requests_enforce_update_rules on public.contact_requests;
create trigger contact_requests_enforce_update_rules
before update on public.contact_requests
for each row
execute function public.enforce_contact_request_update_rules();

drop trigger if exists messages_enforce_update_rules on public.messages;
create trigger messages_enforce_update_rules
before update on public.messages
for each row
execute function public.enforce_message_update_rules();

drop trigger if exists messages_enforce_insert_rules on public.messages;
create trigger messages_enforce_insert_rules
before insert on public.messages
for each row
execute function public.enforce_message_insert_rules();

alter table public.profiles enable row level security;
alter table public.contact_requests enable row level security;
alter table public.trials enable row level security;
alter table public.offers enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.direct_conversation_pairs enable row level security;
alter table public.messages enable row level security;

alter table public.profiles force row level security;
alter table public.contact_requests force row level security;
alter table public.trials force row level security;
alter table public.offers force row level security;
alter table public.conversations force row level security;
alter table public.conversation_members force row level security;
alter table public.direct_conversation_pairs force row level security;
alter table public.messages force row level security;

drop policy if exists "profiles_select_same_sport" on public.profiles;
create policy "profiles_select_same_sport"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or (
    public.current_user_sport() is not null
    and sport = public.current_user_sport()
  )
);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "trials_select_same_sport" on public.trials;
create policy "trials_select_same_sport"
on public.trials
for select
to authenticated
using (
  public.current_user_sport() is not null
  and sport = public.current_user_sport()
);

drop policy if exists "trials_insert_own" on public.trials;
create policy "trials_insert_own"
on public.trials
for insert
to authenticated
with check (coach_id = auth.uid());

drop policy if exists "trials_update_own" on public.trials;
create policy "trials_update_own"
on public.trials
for update
to authenticated
using (coach_id = auth.uid())
with check (coach_id = auth.uid());

drop policy if exists "trials_delete_own" on public.trials;
create policy "trials_delete_own"
on public.trials
for delete
to authenticated
using (coach_id = auth.uid());

drop policy if exists "offers_select_same_sport" on public.offers;
create policy "offers_select_same_sport"
on public.offers
for select
to authenticated
using (
  public.current_user_sport() is not null
  and sport = public.current_user_sport()
);

drop policy if exists "offers_insert_own" on public.offers;
create policy "offers_insert_own"
on public.offers
for insert
to authenticated
with check (coach_id = auth.uid());

drop policy if exists "offers_update_own" on public.offers;
create policy "offers_update_own"
on public.offers
for update
to authenticated
using (coach_id = auth.uid())
with check (coach_id = auth.uid());

drop policy if exists "offers_delete_own" on public.offers;
create policy "offers_delete_own"
on public.offers
for delete
to authenticated
using (coach_id = auth.uid());

drop policy if exists "contact_requests_select_participants" on public.contact_requests;
create policy "contact_requests_select_participants"
on public.contact_requests
for select
to authenticated
using (sender_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "contact_requests_insert_sender" on public.contact_requests;
create policy "contact_requests_insert_sender"
on public.contact_requests
for insert
to authenticated
with check (sender_id = auth.uid());

drop policy if exists "contact_requests_update_participants" on public.contact_requests;
create policy "contact_requests_update_participants"
on public.contact_requests
for update
to authenticated
using (sender_id = auth.uid() or receiver_id = auth.uid())
with check (sender_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "contact_requests_delete_participants" on public.contact_requests;
create policy "contact_requests_delete_participants"
on public.contact_requests
for delete
to authenticated
using (sender_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "conversations_select_members" on public.conversations;
create policy "conversations_select_members"
on public.conversations
for select
to authenticated
using (public.is_conversation_member(id));

drop policy if exists "conversations_insert_authenticated" on public.conversations;
create policy "conversations_insert_authenticated"
on public.conversations
for insert
to authenticated
with check (auth.uid() is not null);

drop policy if exists "conversation_members_select_members" on public.conversation_members;
create policy "conversation_members_select_members"
on public.conversation_members
for select
to authenticated
using (profile_id = auth.uid() or public.is_conversation_member(conversation_id));

drop policy if exists "conversation_members_insert_limited" on public.conversation_members;
create policy "conversation_members_insert_limited"
on public.conversation_members
for insert
to authenticated
with check (
  auth.uid() is not null
  and public.get_profile_sport(profile_id) = public.current_user_sport()
  and (
    profile_id = auth.uid()
    or public.is_conversation_member(conversation_id)
    or not exists (
      select 1
      from public.conversation_members existing_members
      where existing_members.conversation_id = conversation_members.conversation_id
    )
  )
);

drop policy if exists "direct_conversation_pairs_select_participants" on public.direct_conversation_pairs;
create policy "direct_conversation_pairs_select_participants"
on public.direct_conversation_pairs
for select
to authenticated
using (profile_low = auth.uid() or profile_high = auth.uid());

drop policy if exists "messages_select_members" on public.messages;
create policy "messages_select_members"
on public.messages
for select
to authenticated
using (public.is_conversation_member(conversation_id));

drop policy if exists "messages_insert_sender_member" on public.messages;
create policy "messages_insert_sender_member"
on public.messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.is_conversation_member(conversation_id)
);

drop policy if exists "messages_update_members" on public.messages;
create policy "messages_update_members"
on public.messages
for update
to authenticated
using (public.is_conversation_member(conversation_id))
with check (public.is_conversation_member(conversation_id));
