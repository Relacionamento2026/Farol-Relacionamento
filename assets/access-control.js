(function(root) {
    'use strict';
    function roleFor(profile) {
        if (!profile || profile.ativo !== 'ativo') return null;
        return profile.role === 'admin' ? 'admin' : profile.role === 'avaliador' ? 'avaliador' : 'user';
    }
    async function readIdentity(client) {
        if (!client) throw new Error('Serviço de autenticação indisponível.');
        const result = await client.auth.getUser();
        if (result.error || !result.data || !result.data.user) throw new Error('Faça login novamente.');
        const user = result.data.user;
        const resultProfile = await client.from('profiles').select('*').eq('id', user.id).single();
        if (resultProfile.error || !resultProfile.data || resultProfile.data.id !== user.id) {
            throw new Error('Não foi possível validar seu perfil. Contate o administrador.');
        }
        const profile = resultProfile.data;
        const role = roleFor(profile);
        if (!role) throw new Error('Acesso indisponível para esta conta. Contate o administrador.');
        return { id:user.id, email:user.email, name:profile.nome || profile.name || 'Colaborador',
            role, avaliado:profile.avaliado === true, departamento:profile.departamento || '',
            gestor_email:profile.gestor_email || '', mustChangePassword:profile.must_change_password === true };
    }
    function canOpen(role, page) {
        if (!role) return false;
        if (role === 'admin') return true;
        if (page.startsWith('admin-') || page === 'gestor' || page === 'executivo') return false;
        if (page === 'avaliador-5e') return role === 'avaliador';
        return true;
    }
    const api = Object.freeze({roleFor, readIdentity, canOpen});
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.FarolAccess = api;
})(typeof window !== 'undefined' ? window : globalThis);
