-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES TABLE
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  company_name text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- STRATEGY PLAYBOOKS TABLE
create table if not exists strategy_playbooks (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  risk_appetite text default 'balanced',
  monthly_expenses numeric default 0,
  industry_context text default 'General Commercial',
  strategic_goal text default 'liquidity',
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  unique(user_id)
);

-- CONTRACTS (HISTORY) TABLE
create table if not exists contracts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  filename text not null,
  risk_score int default 0,
  analysis_results jsonb default '[]',
  strategic_summary text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- TRUST INDEX (FLAGGED CLAUSES) TABLE
create table if not exists flagged_clauses (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete set null,
  company_name text not null,
  clause_text text not null,
  risk_category text,
  user_comment text,
  upvotes int default 1,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- HUMAN ESCALATION TABLE
create table if not exists review_requests (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  contract_id uuid references contracts on delete cascade,
  clause_text text not null,
  status text default 'pending', -- pending | reviewed | completed
  strategist_feedback text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- RLS POLICIES
alter table review_requests enable row level security;
create policy "Users can view own requests" on review_requests for select using (auth.uid() = user_id);
create policy "Users can create requests" on review_requests for insert with check (auth.uid() = user_id);
-- ... (existing)
create policy "Anyone can upvote" on flagged_clauses for update using (true);
alter table profiles enable row level security;
alter table strategy_playbooks enable row level security;
alter table contracts enable row level security;
alter table flagged_clauses enable row level security;

-- Profiles: Users can only see/edit their own profile
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- Strategy Playbooks: Users can only see/edit their own playbook
create policy "Users can view own playbook" on strategy_playbooks for select using (auth.uid() = user_id);
create policy "Users can insert own playbook" on strategy_playbooks for insert with check (auth.uid() = user_id);
create policy "Users can update own playbook" on strategy_playbooks for update using (auth.uid() = user_id);

-- Contracts: Users can only see their own contract history
create policy "Users can view own contracts" on contracts for select using (auth.uid() = user_id);
create policy "Users can insert own contracts" on contracts for insert with check (auth.uid() = user_id);

-- Flagged Clauses: Anyone can view (Public Intelligence), only authenticated can insert
create policy "Public can view trust index" on flagged_clauses for select using (true);
create policy "Authenticated users can flag clauses" on flagged_clauses for insert with check (auth.role() = 'authenticated');
