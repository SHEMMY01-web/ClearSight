-- ClearSight Supabase Schema
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- 1. Contracts Table
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  filename TEXT,
  risk_score INTEGER,
  analysis_results JSONB,
  strategic_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Strategy Playbooks Table (includes monthly_expenses!)
CREATE TABLE IF NOT EXISTS strategy_playbooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  risk_appetite TEXT,
  monthly_expenses NUMERIC DEFAULT 0,
  industry_context TEXT,
  strategic_goal TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Flagged Clauses Table
CREATE TABLE IF NOT EXISTS flagged_clauses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT,
  clause_text TEXT,
  risk_category TEXT,
  flagged_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Enable RLS
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE flagged_clauses ENABLE ROW LEVEL SECURITY;

-- 5. Policies (Allow users to see only their own data)
CREATE POLICY "Users can view own contracts" ON contracts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own contracts" ON contracts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own playbooks" ON strategy_playbooks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own playbooks" ON strategy_playbooks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Public can view flagged clauses" ON flagged_clauses FOR SELECT TO public USING (true);
CREATE POLICY "Users can insert flagged clauses" ON flagged_clauses FOR INSERT WITH CHECK (auth.uid() = flagged_by);

-- 6. Allow backend service role to insert contracts on behalf of users
-- (The service role key bypasses RLS, so no policy needed for server-side inserts)
