-- Emergency only: restores legacy read policies. Does not make buckets public.
BEGIN;
DROP POLICY farol_private_files_read ON storage.objects;
CREATE POLICY "Leitura pública materiais" ON storage.objects FOR SELECT TO PUBLIC USING (bucket_id='materiais');
CREATE POLICY leitura_publica_materiais ON storage.objects FOR SELECT TO PUBLIC USING (bucket_id='materiais');
COMMIT;
