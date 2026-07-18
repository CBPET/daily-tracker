-- Division targets (greenfield). Write roles use `manager` (not assistant_manager).
CREATE TABLE IF NOT EXISTS public.division_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT NOT NULL, -- Client Code (e.g., 'OUP')
    sub_division TEXT NOT NULL, -- 'PreEdit' or 'Validation'
    task_type TEXT NOT NULL, -- e.g., 'Preedit', 'FL Validation'
    target_value INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT unique_client_subdivision_task UNIQUE (client_id, sub_division, task_type)
);

-- Enable RLS
ALTER TABLE public.division_targets ENABLE ROW LEVEL SECURITY;

-- Policies for public.division_targets
DROP POLICY IF EXISTS "Allow read access to all authenticated users" ON public.division_targets;
CREATE POLICY "Allow read access to all authenticated users"
ON public.division_targets FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow write access to team_lead and above" ON public.division_targets;
CREATE POLICY "Allow write access to team_lead and above"
ON public.division_targets FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE public.profiles.id = auth.uid() 
    AND public.profiles.role IN ('super_admin', 'general_manager', 'manager', 'team_lead', 'group_lead')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE public.profiles.id = auth.uid()
    AND public.profiles.role IN ('super_admin', 'general_manager', 'manager', 'team_lead', 'group_lead')
  )
);
