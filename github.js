'use strict';

class GitHubStorage {
  static maxBytes = 900 * 1024;
  static file = 'work-os.json';
  #token;
  #repo;

  constructor(repository, token) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || repository.split('/').some(part => part === '.' || part === '..')) {
      throw new Error('Informe o repositório no formato usuário/repositório.');
    }
    if (!token.startsWith('github_pat_')) {
      throw new Error('Use um token fine-grained do GitHub.');
    }
    this.#repo = repository.split('/').map(encodeURIComponent).join('/');
    this.#token = token;
  }

  async request(path = '', options = {}) {
    const response = await fetch(`https://api.github.com/repos/${this.#repo}${path}`, {
      ...options,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.#token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options.body ? { 'Content-Type': 'application/json' } : {})
      }
    });
    if (response.ok || (options.allowMissing && response.status === 404)) return response;
    const messages = {
      401: 'O token expirou ou é inválido. Reconecte com um token válido.',
      403: 'O GitHub negou o acesso. Confira as permissões do token ou tente novamente mais tarde.',
      404: 'Repositório ou arquivo inacessível. Confira o nome e o acesso concedido ao token.',
      409: 'Existe outra versão no GitHub.',
      422: 'O GitHub recusou a gravação. Confira a branch e as regras do repositório.',
      429: 'Limite de requisições do GitHub atingido. Tente novamente mais tarde.'
    };
    const error = new Error(messages[response.status] || `GitHub indisponível (HTTP ${response.status}).`);
    error.status = response.status;
    throw error;
  }

  async verify() {
    const repo = await (await this.request()).json();
    if (repo.private !== true || repo.visibility !== 'private') {
      throw new Error('Use um repositório privado separado do site.');
    }
    if (repo.archived || repo.disabled) {
      throw new Error('O repositório precisa estar ativo para receber alterações.');
    }
    const branch = encodeURIComponent(repo.default_branch);
    const branchResponse = await this.request(`/branches/${branch}`, { allowMissing: true });
    if (branchResponse.status === 404) {
      throw new Error('Inicialize o repositório criando um README no GitHub.');
    }
    return branch;
  }

  async load() {
    const branch = await this.verify();
    const response = await this.request(`/contents/${GitHubStorage.file}?ref=${branch}`, { allowMissing: true });
    if (response.status === 404) return { sha: null, data: null };
    const file = await response.json();
    if (file.type !== 'file' || file.encoding !== 'base64' || !file.sha) {
      throw new Error('O arquivo do GitHub precisa ser um JSON válido de até 900 KB.');
    }
    const bytes = Uint8Array.from(atob(file.content.replace(/\s/g, '')), character => character.charCodeAt(0));
    return { sha: file.sha, data: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) };
  }

  async save(snapshot, sha) {
    const bytes = new TextEncoder().encode(snapshot);
    if (bytes.length > GitHubStorage.maxBytes) {
      throw new Error('O quadro atingiu o limite de 900 KB para sincronização. Exporte um backup.');
    }
    let binary = '';
    for (let index = 0; index < bytes.length; index += 8192) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
    }
    const branch = decodeURIComponent(await this.verify());
    const response = await this.request(`/contents/${GitHubStorage.file}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: 'Atualizar tarefas do Work OS',
        branch,
        content: btoa(binary),
        ...(sha ? { sha } : {})
      })
    });
    const result = await response.json();
    if (!result.content?.sha) throw new Error('O GitHub não confirmou a gravação.');
    return result.content.sha;
  }
}
