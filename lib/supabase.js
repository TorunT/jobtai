import { createClient } from '@supabase/supabase-js';

// Client for browser use (limited permissions)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Admin client for server-side use (full permissions)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/*
  Run this SQL in Supabase SQL Editor to create the subscribers table:

  create table subscribers (
    id uuid default gen_random_uuid() primary key,
    email text unique not null,
    name text,
    profile text,
    skills text,
    experience text,
    education text,
    role text,
    location text,
    linkedin text,
    preferences jsonb default '[]',
    alert_time text default '08:00',
    alert_count integer default 10,
    include_resume text default 'yes',
    active boolean default true,
    created_at timestamptz default now()
  );

  alter table subscribers enable row level security;

  create policy "Anyone can subscribe"
    on subscribers for insert
    with check (true);

  create policy "Service role can read all"
    on subscribers for select
    using (auth.role() = 'service_role');

  create policy "Service role can update all"
    on subscribers for update
    using (auth.role() = 'service_role');
*/
