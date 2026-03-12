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
as $$
  select sport
  from public.profiles
  where id = profile_uuid
$$;

create or replace function public.enforce_profile_sport_lock()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.sport is not null and new.sport is distinct from old.sport then
    raise exception 'Profile sport cannot be changed after registration.';
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

create or replace function public.enforce_contact_request_sport_match()
returns trigger
language plpgsql
as $$
declare
  sender_sport public.sport_type;
  receiver_sport public.sport_type;
begin
  sender_sport := public.get_profile_sport(new.sender_id);
  receiver_sport := public.get_profile_sport(new.receiver_id);

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
