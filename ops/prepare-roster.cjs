// Offline generator. Does not connect to Supabase. Private inputs/outputs must not enter git.
const fs = require('node:fs');
const path = require('node:path');
const PROJECT = 'pvorwgrpkcofoukbqtyg';
function prepare(project, snapshot, decision) {
  if (project !== PROJECT) throw new Error('Projeto não autorizado. Use somente FAROL RELACIONAMENTO.');
  const fields = ['id', 'email', 'role', 'ativo', 'avaliado'];
  if (!Array.isArray(snapshot) || snapshot.length === 0) throw new Error('Snapshot obrigatório.');
  const rows = snapshot.map(row => Object.fromEntries(fields.map(key => [key,row[key]])));
  const byEmail = new Map();
  for (const row of rows) {
    if (!/^[0-9a-f-]{36}$/i.test(row.id) || typeof row.email !== 'string' ||
        !(row.role === null || typeof row.role === 'string') || !['ativo','inativo','pendente'].includes(row.ativo) || typeof row.avaliado !== 'boolean') throw new Error('Snapshot inválido.');
    const email = row.email.toLowerCase();
    if (byEmail.has(email)) throw new Error('E-mail duplicado no snapshot.');
    byEmail.set(email,row);
  }
  if (new Set(rows.map(r=>r.id)).size !== rows.length) throw new Error('ID duplicado.');
  const sets = {};
  for (const [key,count] of [['monitored',10],['monitors',2],['departed',6]]) {
    const values = decision[key];
    if (!Array.isArray(values) || values.length !== count || values.some(v=>typeof v!=='string')) throw new Error('Quantidade inválida: '+key);
    sets[key] = new Set(values.map(v=>v.toLowerCase()));
    if (sets[key].size !== count || [...sets[key]].some(v=>!byEmail.has(v))) throw new Error('Cadastro ausente/duplicado: '+key);
  }
  if ([...sets.departed].some(e=>sets.monitored.has(e)||sets.monitors.has(e))) throw new Error('Desligado não pode estar no grupo ativo.');
  for (const e of [...sets.monitored,...sets.monitors]) if(byEmail.get(e).ativo!=='ativo') throw new Error('Não reativar contas automaticamente.');
  for (const e of sets.monitors) if(byEmail.get(e).role==='admin') throw new Error('Não rebaixar administrador automaticamente.');
  const after = rows.map(row=>({...row,avaliado:sets.monitored.has(row.email.toLowerCase()),
    role:sets.monitors.has(row.email.toLowerCase())?'avaliador':row.role==='avaliador'?'user':row.role,
    ativo:sets.departed.has(row.email.toLowerCase())?'inativo':row.ativo}));
  if (!after.some(r=>r.role==='admin'&&r.ativo==='ativo')) throw new Error('Operação deixaria a aplicação sem ADM ativo.');
  const json = value => "'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb";
  function sql(before, target) {
    return `-- CONFIDENCIAL. Gerado exclusivamente para ${PROJECT}. Não publicar no GitHub.\nBEGIN;\nLOCK TABLE public.profiles IN SHARE ROW EXCLUSIVE MODE;\nCREATE TEMP TABLE farol_expected ON COMMIT DROP AS SELECT * FROM jsonb_to_recordset(${json(before)}) AS x(id uuid,email text,role text,ativo text,avaliado boolean);\nCREATE TEMP TABLE farol_target ON COMMIT DROP AS SELECT * FROM jsonb_to_recordset(${json(target)}) AS x(id uuid,email text,role text,ativo text,avaliado boolean);\nDO $$ BEGIN\n IF EXISTS(SELECT 1 FROM farol_expected e FULL JOIN public.profiles p USING(id) WHERE e.id IS NULL OR p.id IS NULL OR e.email IS DISTINCT FROM p.email OR e.role IS DISTINCT FROM p.role OR e.ativo IS DISTINCT FROM p.ativo::text OR e.avaliado IS DISTINCT FROM p.avaliado) THEN RAISE EXCEPTION 'Snapshot divergente. Nenhuma mudança aplicada.'; END IF;\nEND $$;\nUPDATE public.profiles p SET role=t.role,ativo=t.ativo::public.status_usuario,avaliado=t.avaliado FROM farol_target t WHERE p.id=t.id AND (p.role IS DISTINCT FROM t.role OR p.ativo::text IS DISTINCT FROM t.ativo OR p.avaliado IS DISTINCT FROM t.avaliado);\nCOMMIT;\n`;
  }
  return {apply:sql(rows,after),rollback:sql(after,rows)};
}
module.exports={prepare,PROJECT};
if(require.main===module){
 const [project,snapshotFile,decisionFile,outDir]=process.argv.slice(2);
 if(!outDir || !path.resolve(outDir).split(path.sep).includes('private-operations')) throw new Error('Grave somente em private-operations/.');
 const output=prepare(project,JSON.parse(fs.readFileSync(snapshotFile)),JSON.parse(fs.readFileSync(decisionFile)));
 fs.mkdirSync(outDir,{recursive:true,mode:0o700});
 for(const [name,sql] of Object.entries(output)) fs.writeFileSync(path.join(outDir,name+'-roster.sql'),sql,{mode:0o600,flag:'wx'});
 console.log('SQL de aplicação e reversão gerado. Nenhuma conexão ou alteração remota.');
}
