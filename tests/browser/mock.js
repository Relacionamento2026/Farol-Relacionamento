// Synthetic accounts: user, monitor, admin, inactive @example.invalid; password: simulated.
// This deliberately does not implement RLS. Use SQL and real isolated Supabase tests for authorization.
(() => {
  let profile = null;
  const listeners = [];
  const events = [];
  const user = () => profile && {id:profile.id,email:profile.email};
  const emit = event => listeners.forEach(fn => fn(event, user() ? {user:user()} : null));
  function query(table) {
    let single = false;
    const q = new Proxy({}, {get(_, key) {
      if (key === 'then') return (resolve,reject) => Promise.resolve({
        data:table === 'profiles' ? (single ? profile : profile ? [profile] : []) : (single ? null : []),
        error:null, count:0
      }).then(resolve,reject);
      return (...args) => {
        events.push({table,method:key,args});
        if (key === 'single' || key === 'maybeSingle') single = true;
        return q;
      };
    }});
    return q;
  }
  const client = {
    auth:{
      async getUser(){return {data:{user:user()},error:null};},
      async getSession(){return {data:{session:user() ? {user:user(),access_token:'synthetic'} : null},error:null};},
      onAuthStateChange(fn){listeners.push(fn);return {data:{subscription:{unsubscribe(){}}}};},
      async signInWithPassword({email,password}){
        const name=email.split('@')[0];
        if (!['user','monitor','admin','inactive'].includes(name) || !email.endsWith('@example.invalid') || password !== 'simulated') return {data:{},error:{message:'Invalid mock credentials'}};
        profile={id:'00000000-0000-4000-8000-000000000001',email,nome:'Pessoa simulada',role:name==='admin'?'admin':name==='monitor'?'avaliador':'user',ativo:name==='inactive'?'inativo':'ativo',avaliado:name==='user',departamento:'Simulação',must_change_password:false};
        emit('SIGNED_IN');return {data:{user:user()},error:null};
      },
      async signOut(){profile=null;emit('SIGNED_OUT');return {error:null};}
    },
    from:query,
    rpc(name){events.push({rpc:name});return Promise.resolve({data:[],error:null});},
    removeAllChannels(){},
    channel(){const c={on(){return c;},subscribe(){return c;},unsubscribe(){}};return c;},
    storage:{from(){return {getPublicUrl(){return {data:{publicUrl:''}};},async list(){return {data:[],error:null};}};}}
  };
  window.supabase={createClient:()=>client};
  window.Chart=class {static register(){} static getChart(){return null;} destroy(){} update(){} };
  window.__farolMock={events,expire(){profile=null;emit('SIGNED_OUT');},changeRole(role){if(profile)profile.role=role;emit('USER_UPDATED');}};
})();
