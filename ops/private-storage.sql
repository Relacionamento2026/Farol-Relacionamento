BEGIN;
DROP POLICY "Leitura pública materiais" ON storage.objects;
DROP POLICY leitura_publica_materiais ON storage.objects;
CREATE POLICY farol_private_files_read ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('materiais','UPLOADS') AND public.get_my_role() IS NOT NULL
 AND (name NOT LIKE 'avatars/%' OR name='avatars/' || auth.uid()::text || '/avatar' OR public.get_my_role()='admin'));
COMMIT;
