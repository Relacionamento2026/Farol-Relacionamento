import {mkdirSync,readFileSync,writeFileSync,existsSync,copyFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const dir='test-results/integration';
mkdirSync(dir,{recursive:true});
if (existsSync(`${dir}/supabase/.temp/project-ref`)) throw new Error('Remote link forbidden');
if (!existsSync(`${dir}/supabase/config.toml`)) {
  execFileSync('node_modules/.bin/supabase',['init','--workdir',dir,'--yes'],{stdio:'inherit'});
}
const path=`${dir}/supabase/config.toml`;
let config=readFileSync(path,'utf8').replace(/^project_id = .*$/m,'project_id = "farol-ci-isolated"');
if (!/^major_version = 17$/m.test(config)) throw new Error('Expected PostgreSQL 17');
writeFileSync(path,config);
const fn=`${dir}/supabase/functions/farol-validation`;
mkdirSync(fn,{recursive:true});
copyFileSync('tests/integration/edge-wrapper.ts',`${fn}/index.ts`);
copyFileSync('supabase/functions/pergunte-ao-farol/index.ts',`${fn}/real.ts`);
copyFileSync('supabase/functions/pergunte-ao-farol/authorize.js',`${fn}/authorize.js`);
if(!config.includes('[functions.farol-validation]'))writeFileSync(path,config+'\n[functions.farol-validation]\nverify_jwt = true\n');
console.log('Prepared disposable local Supabase; no remote project configured.');
