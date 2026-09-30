-- Synthetic records only. Profiles/notes types mirror the inspected schema.

-- Unrelated tables use reduced nullable columns; this is not a full Supabase clone.

CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA farol_private;

CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;

CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_user::text $$;

GRANT USAGE ON SCHEMA auth,public,storage TO anon,authenticated;

CREATE TYPE public."perfil_acesso" AS ENUM ('admin','gestor','colaborador');

CREATE TYPE public."status_usuario" AS ENUM ('ativo','inativo','pendente');

CREATE TABLE public."celebracoes_vistas" ("colaborador_id" uuid,"id" uuid,"visto_em" timestamp with time zone,"competencia" text,"faixa" text);

ALTER TABLE public."celebracoes_vistas" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."consultas_realizadas" ("id" uuid,"colaborador_id" uuid,"consultado_em" timestamp with time zone,"termo_buscado" text,"resultado_alvo" text,"feedback" text,"resposta_gerada" text);

ALTER TABLE public."consultas_realizadas" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."equipes" ("id" uuid,"gestor_id" uuid,"ativo" boolean,"criado_em" timestamp with time zone,"atualizado_em" timestamp with time zone,"nome" text,"departamento" text,"descricao" text);

ALTER TABLE public."equipes" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."equipe_membros" ("id" uuid,"equipe_id" uuid,"colaborador_id" uuid,"ativo" boolean,"criado_em" timestamp with time zone,"cargo_na_equipe" text);

ALTER TABLE public."equipe_membros" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."auditoria_acesso" ("id" uuid,"usuario_id" uuid,"detalhes" jsonb,"ip_address" inet,"criado_em" timestamp with time zone,"acao" text,"recurso" text,"user_agent" text);

ALTER TABLE public."auditoria_acesso" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."respostas_cache" ("criado_em" timestamp with time zone,"pergunta_normalizada" text,"resposta" text);

ALTER TABLE public."respostas_cache" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."colaboradores" ("id" uuid,"ativo" boolean,"criado_em" timestamp with time zone,"atualizado_em" timestamp with time zone,"nome" text,"email" text,"cargo" text,"departamento" text,"foto_url" text,"role" text);

ALTER TABLE public."colaboradores" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."trilhas" ("id" uuid,"ordem" integer,"ativo" boolean,"criado_em" timestamp with time zone,"slug" text,"titulo" text,"descricao" text,"icone" text);

ALTER TABLE public."trilhas" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."modulos" ("ordem" integer,"desbloqueado" boolean,"ativo" boolean,"criado_em" timestamp with time zone,"id" uuid,"trilha_id" uuid,"duracao_min" integer,"slug" text,"titulo" text,"descricao" text);

ALTER TABLE public."modulos" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."administradoras" ("id" uuid,"atualizado_em" timestamp with time zone,"contatos" jsonb,"sindicos" jsonb,"data_lancamento" date,"data_habitese" date,"empreendimento" text,"administradora" text,"telefone" text,"email" text,"sindico_nome" text,"sindico_telefone" text,"sindico_email" text,"banco_financiador" text,"assessoria" text);

ALTER TABLE public."administradoras" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."slides" ("id" uuid,"modulo_id" uuid,"ordem" integer,"conteudo" jsonb,"criado_em" timestamp with time zone,"tipo" text);

ALTER TABLE public."slides" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."progresso_modulos" ("id" uuid,"colaborador_id" uuid,"trilha_id" uuid,"concluido" boolean,"percentual" integer,"iniciado_em" timestamp with time zone,"concluido_em" timestamp with time zone,"modulo_id" text);

ALTER TABLE public."progresso_modulos" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."certificados" ("id" uuid,"colaborador_id" uuid,"trilha_id" uuid,"emitido_em" timestamp with time zone,"codigo" text);

ALTER TABLE public."certificados" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."central_conhecimento" ("id" bigint,"ativo" boolean,"criado_em" timestamp with time zone,"titulo" text,"descricao_resumida" text,"area" text,"url_arquivo" text);

ALTER TABLE public."central_conhecimento" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."faq" ("id" bigint,"criado_em" timestamp with time zone,"responsavel_id" uuid,"revisado_em" timestamp with time zone,"revisado_por" uuid,"proxima_revisao_em" timestamp with time zone,"versao" integer,"atualizado_em" timestamp with time zone,"pergunta" text,"resposta" text,"categoria" text,"status_revisao" text);

ALTER TABLE public."faq" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."progresso_slides" ("id" uuid,"colaborador_id" uuid,"visualizado_em" timestamp with time zone,"slide_id" text,"modulo_id" text);

ALTER TABLE public."progresso_slides" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."profiles" ("id" uuid NOT NULL,"nome" text DEFAULT 'Novo usuario'::text NOT NULL,"email" text NOT NULL,"foto_perfil" text,"cargo" text,"departamento" text,"perfil" perfil_acesso DEFAULT 'colaborador'::perfil_acesso NOT NULL,"ativo" status_usuario DEFAULT 'ativo'::status_usuario NOT NULL,"criado_em" timestamp with time zone DEFAULT now() NOT NULL,"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,"gestor_id" uuid,"name" text,"foto_url" text,"created_at" timestamp with time zone DEFAULT now(),"role" text DEFAULT 'user'::text,"must_change_password" boolean DEFAULT false NOT NULL,"avaliado" boolean DEFAULT false NOT NULL,"gestor_email" text);

ALTER TABLE public."profiles" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."Arquivos" ("created_at" timestamp with time zone,"Nome" text,"Url" text,"Tipo" text,"Modulo" text);

ALTER TABLE public."Arquivos" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."respostas_quiz" ("correta" boolean,"id" uuid,"colaborador_id" uuid,"opcao_escolhida" integer,"tentativas" integer,"respondido_em" timestamp with time zone,"slide_id" text);

ALTER TABLE public."respostas_quiz" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."avaliacoes_mensais" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"colaborador_id" uuid NOT NULL,"colaborador_nome" text NOT NULL,"competencia" text NOT NULL,"nota_monitoria" numeric(3,2) NOT NULL,"nota_cliente" numeric(3,2) NOT NULL,"nota_final" numeric(4,3) NOT NULL,"atendimentos_monitorados" integer DEFAULT 0 NOT NULL,"elegivel" boolean DEFAULT false NOT NULL,"classificacao" text NOT NULL,"observacao" text,"lancado_por" text,"lancado_em" timestamp with time zone DEFAULT now() NOT NULL,"atualizado_em" timestamp with time zone,"data_avaliacao" date);

ALTER TABLE public."avaliacoes_mensais" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."treinamentos_unic" ("id" uuid,"ordem" integer,"ativo" boolean,"criado_em" timestamp with time zone,"titulo" text,"descricao" text,"icone" text,"cor" text,"categoria" text,"url_unic" text);

ALTER TABLE public."treinamentos_unic" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."materiais" ("id" uuid,"tamanho_bytes" bigint,"enviado_por" uuid,"criado_em" timestamp with time zone,"url" text,"nome" text,"descricao" text,"tipo" text,"modulo" text);

ALTER TABLE public."materiais" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."avisos" ("id" uuid,"ativo" boolean,"criado_em" timestamp with time zone,"texto" text,"autor_email" text);

ALTER TABLE public."avisos" ENABLE ROW LEVEL SECURITY;

CREATE TABLE public."farol_conteudo_versoes" ("id" bigint,"faq_id" bigint,"versao" integer,"conteudo" jsonb,"autor_id" uuid,"registrado_em" timestamp with time zone,"operacao" text);

ALTER TABLE public."farol_conteudo_versoes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE profiles ADD PRIMARY KEY(id);

ALTER TABLE avaliacoes_mensais ADD PRIMARY KEY(id);

ALTER TABLE avaliacoes_mensais ADD UNIQUE(colaborador_id,competencia);

CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,bucket_id text,name text,owner_id text); ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public,storage TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_nome text;
begin
  v_nome := coalesce(new.raw_user_meta_data->>'full_name',
                     new.raw_user_meta_data->>'name',
                     split_part(new.email,'@',1));
  insert into public.profiles (id, email, name, nome, role, must_change_password, created_at)
  values (new.id, new.email, v_nome, v_nome, 'user', false, now())
  on conflict (id) do nothing;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(p_user_id, (SELECT auth.uid()));

    RETURN EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = v_user_id
        AND perfil = 'admin'
        AND ativo = 'ativo'
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_gestor(p_user_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(p_user_id, (SELECT auth.uid()));

    RETURN EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = v_user_id
        AND perfil = 'gestor'
        AND ativo = 'ativo'
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_colaborador(p_user_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(p_user_id, (SELECT auth.uid()));

    RETURN EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = v_user_id
        AND perfil = 'colaborador'
        AND ativo = 'ativo'
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_equipe_ids(p_gestor_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(equipe_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_gestor_id UUID;
BEGIN
    v_gestor_id := COALESCE(p_gestor_id, (SELECT auth.uid()));

    RETURN QUERY
    SELECT e.id
    FROM public.equipes e
    WHERE e.gestor_id = v_gestor_id
    AND e.ativo = TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_equipe_colaborador_ids(p_gestor_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(colaborador_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_gestor_id UUID;
BEGIN
    v_gestor_id := COALESCE(p_gestor_id, (SELECT auth.uid()));

    RETURN QUERY
    SELECT em.colaborador_id
    FROM public.equipe_membros em
    INNER JOIN public.equipes e ON e.id = em.equipe_id
    WHERE e.gestor_id = v_gestor_id
    AND e.ativo = TRUE
    AND em.ativo = TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_colaborador_do_gestor(p_colaborador_id uuid, p_gestor_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_gestor_id UUID;
BEGIN
    v_gestor_id := COALESCE(p_gestor_id, (SELECT auth.uid()));

    RETURN EXISTS (
        SELECT 1
        FROM public.equipe_membros em
        INNER JOIN public.equipes e ON e.id = em.equipe_id
        WHERE e.gestor_id = v_gestor_id
        AND em.colaborador_id = p_colaborador_id
        AND e.ativo = TRUE
        AND em.ativo = TRUE
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_user_updated()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    IF NEW.email IS DISTINCT FROM OLD.email OR
       NEW.raw_user_meta_data IS DISTINCT FROM OLD.raw_user_meta_data THEN
        UPDATE public.profiles
        SET
            email = NEW.email,
            nome = COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
            atualizado_em = NOW()
        WHERE id = NEW.id;
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.registrar_auditoria(p_acao text, p_recurso text, p_detalhes jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    INSERT INTO public.auditoria_acesso (
        usuario_id,
        acao,
        recurso,
        detalhes
    ) VALUES (
        (SELECT auth.uid()),
        p_acao,
        p_recurso,
        p_detalhes
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.calcular_progresso_modulo(p_colaborador_id uuid, p_modulo_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  total_slides    integer;
  slides_vistos   integer;
  percentual      integer;
begin
  select count(*) into total_slides
  from slides where modulo_id = p_modulo_id and tipo != 'encerramento';

  select count(*) into slides_vistos
  from progresso_slides
  where colaborador_id = p_colaborador_id and modulo_id = p_modulo_id;

  if total_slides = 0 then return 0; end if;

  percentual := floor((slides_vistos::float / total_slides::float) * 100);

  insert into progresso_modulos (colaborador_id, modulo_id, trilha_id, percentual)
  select p_colaborador_id, p_modulo_id, t.trilha_id, percentual
  from modulos t where t.id = p_modulo_id
  on conflict (colaborador_id, modulo_id)
  do update set percentual = excluded.percentual;

  return percentual;
end;
$function$;

CREATE OR REPLACE FUNCTION public.concluir_modulo(p_colaborador_id uuid, p_modulo_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_trilha_id     uuid;
  v_ordem_atual   integer;
  v_proximo_id    uuid;
begin
  select trilha_id, ordem into v_trilha_id, v_ordem_atual
  from modulos where id = p_modulo_id;

  -- Marca módulo como concluído
  insert into progresso_modulos (colaborador_id, modulo_id, trilha_id, concluido, percentual, concluido_em)
  values (p_colaborador_id, p_modulo_id, v_trilha_id, true, 100, now())
  on conflict (colaborador_id, modulo_id)
  do update set concluido = true, percentual = 100, concluido_em = now();

  -- Desbloqueia o próximo módulo da trilha
  select id into v_proximo_id
  from modulos
  where trilha_id = v_trilha_id and ordem = v_ordem_atual + 1 and ativo = true;

  if v_proximo_id is not null then
    insert into progresso_modulos (colaborador_id, modulo_id, trilha_id, concluido, percentual)
    values (p_colaborador_id, v_proximo_id, v_trilha_id, false, 0)
    on conflict (colaborador_id, modulo_id) do nothing;

    update modulos set desbloqueado = true where id = v_proximo_id;
  end if;

  -- Verifica se todos os módulos da trilha foram concluídos → emite certificado
  if not exists (
    select 1 from modulos m
    left join progresso_modulos pm
      on pm.modulo_id = m.id and pm.colaborador_id = p_colaborador_id
    where m.trilha_id = v_trilha_id and m.ativo = true
      and (pm.concluido is null or pm.concluido = false)
  ) then
    insert into certificados (colaborador_id, trilha_id)
    values (p_colaborador_id, v_trilha_id)
    on conflict (colaborador_id, trilha_id) do nothing;
  end if;
end;
$function$;

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

CREATE OR REPLACE FUNCTION farol_private.versionar_faq()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT coalesce(public.get_my_role() IN ('admin','diretora','gerente','coordenadora'),false) THEN
    RAISE EXCEPTION 'Apenas responsáveis autorizados podem revisar conteúdo.' USING ERRCODE='42501';
  END IF;
  IF TG_OP='DELETE' THEN
    INSERT INTO public.farol_conteudo_versoes(faq_id,versao,operacao,conteudo,autor_id)
    VALUES(OLD.id,OLD.versao,'DELETE',to_jsonb(OLD),auth.uid());
    RETURN OLD;
  END IF;
  NEW.atualizado_em=now();
  IF TG_OP='INSERT' THEN
    NEW.versao=1;
  ELSE
    NEW.versao=OLD.versao+1;
    IF NEW.pergunta IS DISTINCT FROM OLD.pergunta OR NEW.resposta IS DISTINCT FROM OLD.resposta
       OR NEW.categoria IS DISTINCT FROM OLD.categoria THEN
      NEW.status_revisao='pendente';
    END IF;
  END IF;
  IF NEW.status_revisao='pendente' THEN
    NEW.revisado_em=NULL; NEW.revisado_por=NULL; NEW.proxima_revisao_em=NULL;
  ELSIF TG_OP='INSERT' OR OLD.status_revisao IS DISTINCT FROM NEW.status_revisao THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Revisão exige um responsável autenticado.';
    END IF;
    NEW.revisado_em=now(); NEW.revisado_por=auth.uid();
    NEW.proxima_revisao_em=coalesce(NEW.proxima_revisao_em,now()+interval '90 days');
  ELSE
    NEW.revisado_em=OLD.revisado_em; NEW.revisado_por=OLD.revisado_por;
  END IF;
  INSERT INTO public.farol_conteudo_versoes(faq_id,versao,operacao,conteudo,autor_id)
  VALUES(NEW.id,NEW.versao,TG_OP,to_jsonb(NEW),auth.uid());
  RETURN NEW;
END; $function$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_equipes_updated_at BEFORE UPDATE ON public.equipes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER farol_proteger_perfil BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION farol_private.proteger_perfil();

CREATE TRIGGER farol_versionar_faq BEFORE INSERT OR DELETE OR UPDATE ON public.faq FOR EACH ROW EXECUTE FUNCTION farol_private.versionar_faq();

CREATE POLICY "colab_select" ON "public"."colaboradores" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = id));

CREATE POLICY "colab_insert" ON "public"."colaboradores" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = id));

CREATE POLICY "colab_update" ON "public"."colaboradores" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = id));

CREATE POLICY "trilhas_select" ON "public"."trilhas" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.role() = 'authenticated'::text));

CREATE POLICY "modulos_select" ON "public"."modulos" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.role() = 'authenticated'::text));

CREATE POLICY "slides_select" ON "public"."slides" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.role() = 'authenticated'::text));

CREATE POLICY "prog_mod_select" ON "public"."progresso_modulos" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = colaborador_id));

CREATE POLICY "prog_mod_insert" ON "public"."progresso_modulos" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = colaborador_id));

CREATE POLICY "prog_mod_update" ON "public"."progresso_modulos" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = colaborador_id));

CREATE POLICY "prog_mod_delete" ON "public"."progresso_modulos" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((auth.uid() = colaborador_id));

CREATE POLICY "prog_slide_all" ON "public"."progresso_slides" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.uid() = colaborador_id));

CREATE POLICY "profiles_update" ON "public"."profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));

CREATE POLICY "quiz_all" ON "public"."respostas_quiz" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.uid() = colaborador_id));

CREATE POLICY "cert_select" ON "public"."certificados" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = colaborador_id));

CREATE POLICY "profiles_select_gestoras" ON "public"."profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((auth.uid() = id) OR (get_my_role() = ANY (ARRAY['admin'::text, 'diretora'::text, 'gerente'::text, 'coordenadora'::text, 'lider'::text, 'avaliador'::text, 'admin-juridico-contratos'::text, 'admin-juridico-credito'::text, 'gestor'::text]))));

CREATE POLICY "faq_select" ON "public"."faq" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "faq_insert" ON "public"."faq" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((get_my_role() = ANY (ARRAY['admin'::text, 'diretora'::text, 'gerente'::text, 'coordenadora'::text])));

CREATE POLICY "faq_delete" ON "public"."faq" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((get_my_role() = ANY (ARRAY['admin'::text, 'diretora'::text, 'gerente'::text, 'coordenadora'::text])));

CREATE POLICY "arquivos_select" ON "public"."Arquivos" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.role() = 'authenticated'::text));

CREATE POLICY "arquivos_insert" ON "public"."Arquivos" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.role() = 'authenticated'::text));

CREATE POLICY "admin_upload_materiais" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'materiais'::text) AND (get_my_role() = 'admin'::text)));

CREATE POLICY "leitura_publica_materiais" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((bucket_id = 'materiais'::text));

CREATE POLICY "gestoras_inserem_avisos" ON "public"."avisos" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((get_my_role() = ANY (ARRAY['admin'::text, 'diretora'::text, 'gerente'::text, 'coordenadora'::text])));

CREATE POLICY "todos_leem_avisos" ON "public"."avisos" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((ativo = true));

CREATE POLICY "Todo mundo logado pode ver" ON "public"."treinamentos_unic" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.role() = 'authenticated'::text));

CREATE POLICY "Só admin cria/edita/apaga" ON "public"."treinamentos_unic" AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

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

CREATE POLICY "admin_gerencia_materiais" ON "public"."materiais" AS PERMISSIVE FOR ALL TO "authenticated" USING ((get_my_role() = 'admin'::text)) WITH CHECK ((get_my_role() = 'admin'::text));

CREATE POLICY "autenticados_leem_materiais" ON "public"."materiais" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "usuario_le_propria" ON "public"."celebracoes_vistas" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((colaborador_id = auth.uid()));

CREATE POLICY "usuario_insere_propria" ON "public"."celebracoes_vistas" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((colaborador_id = auth.uid()));

CREATE POLICY "colaborador_ve_proprio" ON "public"."certificados" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((colaborador_id = auth.uid()));

CREATE POLICY "insert_proprio" ON "public"."certificados" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((colaborador_id = auth.uid()));

CREATE POLICY "admin_ve_todos" ON "public"."certificados" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((get_my_role() = ANY (ARRAY['admin'::text, 'avaliador'::text])));

CREATE POLICY "usuario_insere_propria" ON "public"."consultas_realizadas" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((colaborador_id = auth.uid()));

CREATE POLICY "gestao_le_todas" ON "public"."consultas_realizadas" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((get_my_role() = ANY (ARRAY['admin'::text, 'diretora'::text, 'gerente'::text, 'coordenadora'::text])));

CREATE POLICY "faq_update_gestao" ON "public"."faq" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((get_my_role() = ANY (ARRAY['admin'::text, 'diretora'::text, 'gerente'::text, 'coordenadora'::text]))) WITH CHECK ((get_my_role() = ANY (ARRAY['admin'::text, 'diretora'::text, 'gerente'::text, 'coordenadora'::text])));

CREATE POLICY "profiles_insert" ON "public"."profiles" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((auth.uid() = id) AND (COALESCE(role, 'user'::text) = ANY (ARRAY['user'::text, 'colaborador'::text])) AND ((perfil)::text = 'colaborador'::text)));

CREATE POLICY "autenticados_leem" ON "public"."administradoras" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "gestao_insere" ON "public"."administradoras" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((get_my_role() = ANY (ARRAY['admin'::text, 'diretora'::text, 'gerente'::text, 'coordenadora'::text])));

CREATE POLICY "gestao_atualiza" ON "public"."administradoras" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((get_my_role() = ANY (ARRAY['admin'::text, 'diretora'::text, 'gerente'::text, 'coordenadora'::text])));

CREATE POLICY "gestao_remove" ON "public"."administradoras" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((get_my_role() = ANY (ARRAY['admin'::text, 'diretora'::text, 'gerente'::text, 'coordenadora'::text])));

CREATE POLICY "versoes_leitura_gestao" ON "public"."farol_conteudo_versoes" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((get_my_role() = ANY (ARRAY['admin'::text, 'diretora'::text, 'gerente'::text, 'coordenadora'::text])));

CREATE POLICY "Leitura pública materiais" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((bucket_id = 'materiais'::text));

CREATE POLICY "Upload autenticado materiais" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((bucket_id = 'materiais'::text));

CREATE POLICY "Update próprio arquivo" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((bucket_id = 'materiais'::text));

CREATE POLICY "Delete admin materiais" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO PUBLIC USING (((bucket_id = 'materiais'::text) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.perfil = 'admin'::perfil_acesso))))));

CREATE POLICY "profiles_select_own" ON "public"."profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((auth.uid() = id));

CREATE POLICY "gestor_le_avaliacoes" ON "public"."avaliacoes_mensais" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((get_my_role() = ANY (ARRAY['admin'::text, 'diretora'::text, 'gerente'::text, 'coordenadora'::text, 'lider'::text, 'avaliador'::text, 'admin-juridico-contratos'::text, 'admin-juridico-credito'::text, 'gestor'::text])));
