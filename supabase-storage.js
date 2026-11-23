'use strict';

class WorkOSConflict extends Error {}

class SupabaseStorage {
  static configuration(url, key) {
    const origin = new URL(url);
    if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
      throw new Error('Informe a URL HTTPS do projeto Supabase, sem caminho adicional.');
    }
    let publicKey = /^sb_publishable_[\w-]+$/.test(key);
    if (!publicKey) {
      try {
        const parts = key.split('.');
        const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        publicKey = parts.length === 3 && JSON.parse(atob(payload)).role === 'anon';
      } catch {}
    }
    if (!publicKey) throw new Error('Use a chave publishable ou a chave anon legada do projeto.');
    return { url: origin.origin, key };
  }

  constructor(config) {
    this.client = globalThis.supabase.createClient(config.url, config.key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
  }

  async load(userId) {
    const { data, error } = await this.client.from('workspaces').select('payload,version')
      .eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data ? { version: data.version, data: data.payload } : { version: null, data: null };
  }

  async save(userId, payload, version) {
    const table = this.client.from('workspaces');
    const fields = { payload, updated_at: new Date().toISOString() };
    const query = version === null
      ? table.insert({ ...fields, user_id: userId, version: 1 })
      : table.update({ ...fields, version: version + 1 }).eq('user_id', userId).eq('version', version);
    const { data, error } = await query.select('version').maybeSingle();
    if (error?.code === '23505' || (!error && !data)) throw new WorkOSConflict();
    if (error) throw error;
    return data.version;
  }

  async putFile(userId, file, blob) {
    const filename = file.nome.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'arquivo';
    const path = `${userId}/${encodeURIComponent(file.id)}-${filename}`;
    const bucket = this.client.storage.from('workos-media');
    const { error } = await bucket.upload(path, blob, { contentType: file.tipo, upsert: false });
    if (error && String(error.statusCode) !== '409' && !/already exists|duplicate/i.test(error.message)) throw error;
    return path;
  }

  async fileUrl(userId, path) {
    if (!path.startsWith(userId + '/')) return '';
    const { data, error } = await this.client.storage.from('workos-media').createSignedUrl(path, 300);
    if (error) throw error;
    return data.signedUrl;
  }
}
