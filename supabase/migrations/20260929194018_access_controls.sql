-- Prepared against FAROL RELACIONAMENTO only. No production data in this file.
-- Run in a transaction after preflight and a fresh rollback snapshot.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN p.role = 'admin' THEN 'admin'
              WHEN p.role = 'avaliador' THEN 'avaliador' ELSE 'user' END
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL AND p.id = auth.uid() AND p.ativo::text = 'ativo'
  LIMIT 1;
$$;

-- An inactive profile must not gain access through any permissive policy.
-- The existing table list is explicit: schema drift is a preflight failure.
DO $$
DECLARE tab text;
BEGIN
  FOREACH tab IN ARRAY ARRAY['celebracoes_vistas','consultas_realizadas','equipes',
    'equipe_membros','auditoria_acesso','respostas_cache','colaboradores','trilhas',
    'modulos','administradoras','slides','progresso_modulos','certificados',
    'central_conhecimento','faq','progresso_slides','profiles','Arquivos',
    'respostas_quiz','avaliacoes_mensais','treinamentos_unic','materiais','avisos',
    'farol_conteudo_versoes'] LOOP
    EXECUTE format('CREATE POLICY farol_active_gate ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.get_my_role() IS NOT NULL) WITH CHECK (public.get_my_role() IS NOT NULL)',tab);
    EXECUTE format('CREATE POLICY farol_admin_all ON public.%I FOR ALL TO authenticated USING (public.get_my_role() = ''admin'') WITH CHECK (public.get_my_role() = ''admin'')',tab);
  END LOOP;
END $$;

-- Replace every old profile/evaluation policy, including permissive OR paths.
DO $$
DECLARE pol record;
BEGIN
 FOR pol IN SELECT schemaname,tablename,policyname FROM pg_policies
   WHERE schemaname='public' AND tablename IN ('profiles','avaliacoes_mensais')
     AND policyname NOT IN ('farol_active_gate','farol_admin_all') LOOP
   EXECUTE format('DROP POLICY %I ON %I.%I',pol.policyname,pol.schemaname,pol.tablename);
 END LOOP;
END $$;

CREATE POLICY farol_profiles_read ON public.profiles FOR SELECT TO authenticated
USING (id=auth.uid() OR (public.get_my_role()='avaliador' AND avaliado AND ativo::text='ativo'));
CREATE POLICY farol_profiles_edit_own ON public.profiles FOR UPDATE TO authenticated
USING (id=auth.uid()) WITH CHECK (id=auth.uid());

CREATE OR REPLACE FUNCTION farol_private.proteger_perfil()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF current_user IN ('anon','authenticated') AND coalesce(public.get_my_role(),'') <> 'admin' THEN
   IF TG_OP='INSERT' THEN
     RAISE EXCEPTION 'Perfil deve ser criado pelo fluxo de cadastro autorizado.' USING ERRCODE='42501';
   ELSIF NEW.role IS DISTINCT FROM OLD.role OR NEW.perfil IS DISTINCT FROM OLD.perfil
     OR NEW.ativo IS DISTINCT FROM OLD.ativo OR NEW.id IS DISTINCT FROM OLD.id
     OR NEW.gestor_id IS DISTINCT FROM OLD.gestor_id OR NEW.gestor_email IS DISTINCT FROM OLD.gestor_email
     OR NEW.avaliado IS DISTINCT FROM OLD.avaliado OR NEW.departamento IS DISTINCT FROM OLD.departamento
     OR NEW.email IS DISTINCT FROM OLD.email THEN
     RAISE EXCEPTION 'Campos de acesso e organização exigem administração.' USING ERRCODE='42501';
   END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE POLICY farol_notes_read_own ON public.avaliacoes_mensais FOR SELECT TO authenticated
USING (colaborador_id=auth.uid());
CREATE POLICY farol_monitor_read ON public.avaliacoes_mensais FOR SELECT TO authenticated
USING (public.get_my_role()='avaliador' AND EXISTS (SELECT 1 FROM public.profiles p
  WHERE p.id=colaborador_id AND p.avaliado AND p.ativo::text='ativo'));
CREATE POLICY farol_monitor_insert ON public.avaliacoes_mensais FOR INSERT TO authenticated
WITH CHECK (public.get_my_role()='avaliador' AND EXISTS (SELECT 1 FROM public.profiles p
  WHERE p.id=colaborador_id AND p.avaliado AND p.ativo::text='ativo'));
CREATE POLICY farol_monitor_update ON public.avaliacoes_mensais FOR UPDATE TO authenticated
USING (public.get_my_role()='avaliador' AND EXISTS (SELECT 1 FROM public.profiles p
  WHERE p.id=colaborador_id AND p.avaliado AND p.ativo::text='ativo'))
WITH CHECK (public.get_my_role()='avaliador' AND EXISTS (SELECT 1 FROM public.profiles p
  WHERE p.id=colaborador_id AND p.avaliado AND p.ativo::text='ativo'));

CREATE OR REPLACE FUNCTION public.listar_colaboradores_avaliados()
RETURNS TABLE(id uuid,email text,nome text,role text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT p.id,p.email,p.nome,p.role FROM public.profiles p
 WHERE public.get_my_role() IN ('admin','avaliador')
   AND p.avaliado AND p.ativo::text='ativo' ORDER BY p.nome;
$$;
REVOKE ALL ON FUNCTION public.listar_colaboradores_avaliados() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.listar_colaboradores_avaliados() TO authenticated;

-- Legacy privileged RPCs have no current frontend callers. Keep server use.
REVOKE EXECUTE ON FUNCTION public.concluir_modulo(uuid,uuid),
  public.calcular_progresso_modulo(uuid,uuid),public.get_equipe_ids(uuid),
  public.get_equipe_colaborador_ids(uuid),public.is_colaborador_do_gestor(uuid,uuid),
  public.registrar_auditoria(text,text,jsonb),public.is_admin(uuid),
  public.is_gestor(uuid),public.is_colaborador(uuid) FROM PUBLIC,anon,authenticated;

-- Remove every permissive write path found for the materials bucket.
DROP POLICY admin_upload_materiais ON storage.objects;
DROP POLICY "Upload autenticado materiais" ON storage.objects;
DROP POLICY "Update próprio arquivo" ON storage.objects;
DROP POLICY "Delete admin materiais" ON storage.objects;
CREATE POLICY farol_storage_active ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
USING (public.get_my_role() IS NOT NULL) WITH CHECK (public.get_my_role() IS NOT NULL);
CREATE POLICY farol_materials_admin ON storage.objects FOR ALL TO authenticated
USING (bucket_id='materiais' AND public.get_my_role()='admin')
WITH CHECK (bucket_id='materiais' AND public.get_my_role()='admin');
CREATE POLICY farol_avatar_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='materiais' AND name='avatars/' || auth.uid()::text || '/avatar'
  AND public.get_my_role() IS NOT NULL);
CREATE POLICY farol_avatar_update ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id='materiais' AND name='avatars/' || auth.uid()::text || '/avatar'
  AND public.get_my_role() IS NOT NULL)
WITH CHECK (bucket_id='materiais' AND name='avatars/' || auth.uid()::text || '/avatar'
  AND public.get_my_role() IS NOT NULL);

-- Deliberately preserve bucket visibility in this patch: changing URLs requires
-- coordinated asset migration. Public download is a documented residual risk.
COMMIT;
