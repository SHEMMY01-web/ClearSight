-- SQL for Supabase Table
CREATE TABLE IF NOT EXISTS strategy_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  risk_appetite VARCHAR(20) DEFAULT 'balanced', -- options: 'aggressive', 'balanced', 'conservative'
  priority_clauses JSONB DEFAULT '[]', -- e.g., ["IP Ownership", "Termination", "Liability"]
  auto_flag_terms JSONB DEFAULT '[]', -- e.g., ["unlimited liability", "exclusive"]
  industry_context TEXT DEFAULT 'General Commercial', -- e.g., "Software Engineering" or "Afrobeats Music"
  monthly_expenses NUMERIC DEFAULT 250000,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE strategy_playbooks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own playbook
CREATE POLICY "Users can view own playbook" ON strategy_playbooks
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can only insert their own playbook
CREATE POLICY "Users can insert own playbook" ON strategy_playbooks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only update their own playbook
CREATE POLICY "Users can update own playbook" ON strategy_playbooks
  FOR UPDATE USING (auth.uid() = user_id);
