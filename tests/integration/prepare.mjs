import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
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
console.log('Prepared disposable local Supabase; no remote project configured.');
