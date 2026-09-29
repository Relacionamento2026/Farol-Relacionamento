-- EMERGENCY ONLY: restores known insecure legacy rules. Prefer containment.

BEGIN; DO $$ BEGIN IF current_setting('farol.allow_unsafe_rollback',true) IS DISTINCT FROM 'reviewed' THEN RAISE EXCEPTION 'Review insecure rollback before enabling.'; END IF; END $$;

DO $$ DECLARE p record; BEGIN FOR p IN SELECT schemaname,tablename,policyname FROM pg_policies WHERE (schemaname='public' AND (policyname IN ('farol_active_gate','farol_admin_all') OR tablename IN ('profiles','avaliacoes_mensais'))) OR (schemaname='storage' AND policyname LIKE 'farol_%') LOOP EXECUTE format('DROP POLICY %I ON %I.%I',p.policyname,p.schemaname,p.tablename); END LOOP; END $$;

CREATE POLICY "profiles_update" ON "public"."profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));

CREATE POLICY "profiles_select_gestoras" ON "public"."profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((auth.uid() = id) OR (get_my_role() = ANY (ARRAY['admin'::text, 'diretora'::text, 'gerente'::text, 'coordenadora'::text, 'lider'::text, 'avaliador'::text, 'admin-juridico-contratos'::text, 'admin-juridico-credito'::text, 'gestor'::text]))));

CREATE POLICY "admin_upload_materiais" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'materiais'::text) AND (get_my_role() = 'admin'::text)));

CREATE POLICY "colaborador_le_proprio" ON "public"."avaliacoes_mensais" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = colaborador_id));

CREATE POLICY "avaliador_le_tudo" ON "public"."avaliacoes_mensais" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['avaliador'::text, 'admin'::text]))))));

CREATE POLICY "avaliador_grava" ON "public"."avaliacoes_mensais" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['avaliador'::text, 'admin'::text]))))));

CREATE POLICY "avaliador_atualiza" ON "public"."avaliacoes_mensais" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['avaliador'::text, 'admin'::text]))))));

CREATE POLICY "profiles_insert" ON "public"."profiles" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((auth.uid() = id) AND (COALESCE(role, 'user'::text) = ANY (ARRAY['user'::text, 'colaborador'::text])) AND ((perfil)::text = 'colaborador'::text)));

CREATE POLICY "Upload autenticado materiais" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((bucket_id = 'materiais'::text));

CREATE POLICY "Update próprio arquivo" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((bucket_id = 'materiais'::text));

CREATE POLICY "Delete admin materiais" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO PUBLIC USING (((bucket_id = 'materiais'::text) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.perfil = 'admin'::perfil_acesso))))));

CREATE POLICY "profiles_select_own" ON "public"."profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((auth.uid() = id));

CREATE POLICY "gestor_le_avaliacoes" ON "public"."avaliacoes_mensais" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((get_my_role() = ANY (ARRAY['admin'::text, 'diretora'::text, 'gerente'::text, 'coordenadora'::text, 'lider'::text, 'avaliador'::text, 'admin-juridico-contratos'::text, 'admin-juridico-credito'::text, 'gestor'::text])));

CREATE OR REPLACE FUNCTION public.get_my_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.listar_colaboradores_avaliados()
 RETURNS TABLE(id uuid, email text, nome text, role text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, email, nome, role
  FROM public.profiles
  WHERE role = 'user'
  AND avaliado = true
  AND ativo = 'ativo'
  ORDER BY nome ASC;
$function$;

CREATE OR REPLACE FUNCTION farol_private.proteger_perfil()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF current_user IN ('anon','authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      IF coalesce(NEW.role,'user') NOT IN ('user','colaborador') OR NEW.perfil::text <> 'colaborador' THEN
        RAISE EXCEPTION 'Nível de acesso deve ser definido pela administração.' USING ERRCODE='42501';
      END IF;
    ELSIF NEW.role IS DISTINCT FROM OLD.role OR NEW.perfil IS DISTINCT FROM OLD.perfil
       OR NEW.ativo IS DISTINCT FROM OLD.ativo OR NEW.id IS DISTINCT FROM OLD.id
       OR NEW.gestor_id IS DISTINCT FROM OLD.gestor_id OR NEW.gestor_email IS DISTINCT FROM OLD.gestor_email THEN
      RAISE EXCEPTION 'Campos de autorização não podem ser alterados pelo perfil pessoal.' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END; $function$;

GRANT EXECUTE ON FUNCTION public."is_admin"(p_user_id uuid) TO PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public."is_gestor"(p_user_id uuid) TO PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public."is_colaborador"(p_user_id uuid) TO PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public."get_equipe_ids"(p_gestor_id uuid) TO PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public."get_equipe_colaborador_ids"(p_gestor_id uuid) TO PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public."is_colaborador_do_gestor"(p_colaborador_id uuid, p_gestor_id uuid) TO PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public."registrar_auditoria"(p_acao text, p_recurso text, p_detalhes jsonb) TO PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public."calcular_progresso_modulo"(p_colaborador_id uuid, p_modulo_id uuid) TO PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public."concluir_modulo"(p_colaborador_id uuid, p_modulo_id uuid) TO PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public."listar_colaboradores_avaliados"() TO PUBLIC,anon,authenticated,service_role;

COMMIT;
