-- ==========================================
-- CLIENT HIERARCHY MIGRATION
-- Run this in your Supabase SQL Editor
-- ==========================================

BEGIN;

-- 1. Add 'group_lead' to user_role enum
-- Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction in some PG versions.
-- If this fails, run it separately outside the transaction:
--   ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'group_lead' BEFORE 'team_lead';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.user_role'::regtype
      AND enumlabel = 'group_lead'
  ) THEN
    -- Cannot use ADD VALUE inside transaction in PG < 12; this workaround is safe
    EXECUTE 'ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS ''group_lead'' BEFORE ''team_lead''';
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'group_lead enum value may already exist or cannot be added in transaction. Run separately if needed.';
END $$;

COMMIT;

-- Separate transaction for the rest (enum ADD VALUE requires its own transaction)
BEGIN;

-- 2. Create clients table
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Seed the 5 clients
INSERT INTO public.clients (code, name) VALUES
  ('OUP', 'OUP'),
  ('T&F', 'T&F'),
  ('OOH', 'OOH'),
  ('MCB', 'MCB'),
  ('SPW', 'SPW')
ON CONFLICT (code) DO NOTHING;

-- 4. Add sub_division to profiles (nullable, constrained)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'sub_division'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN sub_division text DEFAULT NULL;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_sub_division_check
      CHECK (sub_division IN ('PreEdit', 'Validation') OR sub_division IS NULL);
  END IF;
END $$;

-- 5. Add client_ref FK to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'client_ref'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN client_ref uuid REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 6. Add sub_division to status_entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'status_entries' AND column_name = 'sub_division'
  ) THEN
    ALTER TABLE public.status_entries ADD COLUMN sub_division text DEFAULT NULL;
  END IF;
END $$;

-- 7. RLS for clients table
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Everyone can read clients
DROP POLICY IF EXISTS "clients_select_authenticated" ON public.clients;
CREATE POLICY "clients_select_authenticated" ON public.clients
  FOR SELECT TO authenticated USING (true);

-- Only SA, GM, and AM can manage clients
DROP POLICY IF EXISTS "clients_manage_gm_am" ON public.clients;
CREATE POLICY "clients_manage_gm_am" ON public.clients
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'general_manager', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'general_manager', 'manager')
    )
  );

-- 8. Timestamps trigger for clients
DROP TRIGGER IF EXISTS set_updated_at_clients ON public.clients;
CREATE TRIGGER set_updated_at_clients
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 9. Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_client_ref ON public.profiles (client_ref);
CREATE INDEX IF NOT EXISTS idx_profiles_sub_division ON public.profiles (sub_division);
CREATE INDEX IF NOT EXISTS idx_clients_active ON public.clients (is_active) WHERE is_active = true;

-- 10. Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;

COMMIT;
