CREATE TABLE public.editor_profiles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT auth.uid(),
 name text NOT NULL,
 settings jsonb NOT NULL DEFAULT '{}'::jsonb,
 is_default boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.editor_profiles TO authenticated;
GRANT ALL ON public.editor_profiles TO service_role;
ALTER TABLE public.editor_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own editor profiles" ON public.editor_profiles FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE UNIQUE INDEX editor_profiles_one_default ON public.editor_profiles(user_id) WHERE is_default;
