CREATE TABLE public.plans (id text PRIMARY KEY, name text NOT NULL, price_cents integer NOT NULL DEFAULT 0 CHECK(price_cents >= 0), recurring boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.plans TO authenticated; GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_plans ON public.plans FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
CREATE TABLE public.site_content (key text PRIMARY KEY, value jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.site_content TO authenticated; GRANT ALL ON public.site_content TO service_role;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_content ON public.site_content FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
CREATE TABLE public.tool_settings (id text PRIMARY KEY, name text NOT NULL, description text NOT NULL DEFAULT '', enabled boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.tool_settings TO authenticated; GRANT ALL ON public.tool_settings TO service_role;
ALTER TABLE public.tool_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_tools ON public.tool_settings FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
CREATE TABLE public.user_accounts (user_id uuid PRIMARY KEY, active boolean NOT NULL DEFAULT true, plan_override text, updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.user_accounts TO authenticated; GRANT ALL ON public.user_accounts TO service_role;
ALTER TABLE public.user_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_accounts ON public.user_accounts FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
CREATE TABLE public.user_activity (user_id uuid PRIMARY KEY, last_seen_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.user_activity TO authenticated; GRANT ALL ON public.user_activity TO service_role;
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_activity ON public.user_activity FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE TABLE public.tool_usage (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, tool_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.tool_usage TO authenticated; GRANT ALL ON public.tool_usage TO service_role;
ALTER TABLE public.tool_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_usage ON public.tool_usage FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE INDEX tool_usage_created_idx ON public.tool_usage(created_at,tool_id);
CREATE TABLE public.purchases (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, email text NOT NULL DEFAULT '', plan text NOT NULL, amount_cents integer NOT NULL DEFAULT 0 CHECK(amount_cents>=0), status text NOT NULL DEFAULT 'pendente', external_id text UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.purchases TO authenticated; GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_purchases ON public.purchases FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.admin_panel_data() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso exclusivo para administradores' USING ERRCODE='42501'; END IF;
SELECT jsonb_build_object(
'users',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',p.id,'name',p.nome,'email',p.email,'created_at',p.created_at,'last_seen_at',a.last_seen_at,'active',COALESCE(u.active,true),'plan',COALESCE(u.plan_override,s.plano,'gratis'))) FROM public.profiles p LEFT JOIN public.user_activity a ON a.user_id=p.id LEFT JOIN public.user_accounts u ON u.user_id=p.id LEFT JOIN LATERAL (SELECT plano FROM public.assinaturas WHERE user_id=p.id AND status IN ('ativo','atrasado') AND (valido_ate IS NULL OR valido_ate>now()) ORDER BY criado_em DESC LIMIT 1) s ON true),'[]'::jsonb),
'plans',COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM public.plans p),'[]'::jsonb),
'tools',COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.tool_settings t),'[]'::jsonb),
'content',COALESCE((SELECT jsonb_object_agg(key,value) FROM public.site_content),'{}'::jsonb),
'usage',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT tool_id,date_trunc('day',created_at) AS day,count(*) AS count FROM public.tool_usage WHERE created_at>=date_trunc('month',now()) GROUP BY 1,2) x),'[]'::jsonb),
'online',(SELECT count(*) FROM public.user_activity a LEFT JOIN public.user_accounts u USING(user_id) WHERE a.last_seen_at>now()-interval '2 minutes' AND COALESCE(u.active,true)),
'subscriptions',COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM public.assinaturas s),'[]'::jsonb),
'purchase_count', (SELECT count(*) FROM public.purchases),
'captured_at',now(),
'transactions',COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC) FROM (
SELECT id::text,id::text AS source_id,user_id,email,plan,amount_cents,status,created_at,'purchase' AS source FROM public.purchases
UNION ALL
SELECT 'kiwify-'||e.id::text,e.id::text,s.user_id,e.email,COALESCE(s.plano,e.produto,'—'),e.valor_centavos,CASE WHEN e.status_pedido IN ('paid','approved') OR e.tipo IN ('order_approved','compra_aprovada') THEN 'pago' ELSE 'pendente' END,e.recebido_em,'kiwify' FROM public.eventos_kiwify e LEFT JOIN LATERAL (SELECT user_id,plano FROM public.assinaturas WHERE kiwify_order_id=e.order_id LIMIT 1) s ON true WHERE e.processado AND e.valor_centavos IS NOT NULL AND (e.status_pedido IN ('paid','approved','pending','waiting_payment') OR e.tipo IN ('order_approved','compra_aprovada')) AND NOT EXISTS(SELECT 1 FROM public.purchases p WHERE p.external_id=e.order_id) AND NOT EXISTS(SELECT 1 FROM public.eventos_kiwify newer WHERE newer.order_id=e.order_id AND newer.processado AND newer.recebido_em>e.recebido_em)
UNION ALL
SELECT 'assinatura-'||s.id::text,s.id::text,s.user_id,s.email,s.plano,s.valor_centavos,CASE WHEN s.status IN ('ativo','atrasado') THEN 'pago' ELSE s.status END,s.criado_em,'subscription' FROM public.assinaturas s WHERE s.valor_centavos IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.eventos_kiwify e WHERE e.order_id=s.kiwify_order_id AND e.processado AND e.valor_centavos IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM public.purchases p WHERE p.external_id=s.kiwify_order_id)
) t),'[]'::jsonb)) INTO result;
RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.admin_panel_data() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.admin_panel_data() TO authenticated;
CREATE OR REPLACE FUNCTION public.public_site_settings() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT jsonb_build_object('plans',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'price_cents',price_cents,'recurring',recurring)) FROM public.plans),'[]'::jsonb),'content',COALESCE((SELECT jsonb_object_agg(key,value) FROM public.site_content WHERE key IN ('hero_title','hero_description','testimonials','faq')),'{}'::jsonb),'tools',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'description',description,'enabled',enabled)) FROM public.tool_settings),'[]'::jsonb)) $$;
REVOKE ALL ON FUNCTION public.public_site_settings() FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.public_site_settings() TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.client_account_state() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT jsonb_build_object('active',COALESCE((SELECT active FROM public.user_accounts WHERE user_id=auth.uid()),true),'plan',(SELECT plan_override FROM public.user_accounts WHERE user_id=auth.uid())) WHERE auth.uid() IS NOT NULL $$;
REVOKE ALL ON FUNCTION public.client_account_state() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.client_account_state() TO authenticated;
CREATE OR REPLACE FUNCTION public.record_activity(_tool_id text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta' USING ERRCODE='42501'; END IF;
IF EXISTS(SELECT 1 FROM public.user_accounts WHERE user_id=auth.uid() AND NOT active) THEN RAISE EXCEPTION 'Conta desativada' USING ERRCODE='42501'; END IF;
INSERT INTO public.user_activity(user_id,last_seen_at) VALUES(auth.uid(),now()) ON CONFLICT(user_id) DO UPDATE SET last_seen_at=now();
IF _tool_id IS NOT NULL THEN
IF NOT EXISTS(SELECT 1 FROM public.tool_settings WHERE id=_tool_id AND enabled) THEN RAISE EXCEPTION 'Ferramenta indisponível'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.tool_usage WHERE user_id=auth.uid() AND tool_id=_tool_id AND created_at>now()-interval '30 seconds') THEN INSERT INTO public.tool_usage(user_id,tool_id) VALUES(auth.uid(),_tool_id); END IF;
END IF;
END $$;
REVOKE ALL ON FUNCTION public.record_activity(text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.record_activity(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_change_account(_user_id uuid,_active boolean,_plan text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso exclusivo para administradores' USING ERRCODE='42501'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=_user_id) THEN RAISE EXCEPTION 'Usuário não encontrado'; END IF;
IF NOT _active AND public.has_role(_user_id,'admin') THEN RAISE EXCEPTION 'Não é possível desativar um administrador'; END IF;
IF _plan IS NOT NULL AND _plan<>'gratis' AND NOT EXISTS(SELECT 1 FROM public.plans WHERE id=_plan) THEN RAISE EXCEPTION 'Plano inválido'; END IF;
INSERT INTO public.user_accounts(user_id,active,plan_override) VALUES(_user_id,_active,_plan) ON CONFLICT(user_id) DO UPDATE SET active=EXCLUDED.active,plan_override=EXCLUDED.plan_override,updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.admin_change_account(uuid,boolean,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.admin_change_account(uuid,boolean,text) TO authenticated;