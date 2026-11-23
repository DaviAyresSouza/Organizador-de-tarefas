# Meu Work OS com Supabase

O app mantém o Quadro, a Lista e o Calendário da versão revisada. Tarefas são sincronizadas com o banco do Supabase e os arquivos de imagem e vídeo usam o bucket privado `workos-media`.

## Usar o projeto Supabase que você já tem

1. Abra o app depois de publicar os arquivos desta versão no endereço atual. O app tenta reutilizar a configuração e a sessão da versão anterior salvas nesse navegador.
2. Se precisar configurar, clique em **Modo local**, preencha a URL HTTPS do projeto e a chave pública **publishable** ou **anon**, e salve. Use a mesma conta de e-mail e senha para carregar seu quadro antigo.
3. Se houver diferenças entre a cópia local e o quadro do Supabase, escolha qual versão deseja usar. Você pode exportar a versão substituída na janela de sincronização. Ao entrar, o app faz uma leitura antes de gravar.
4. Se tiver usado o GitHub para armazenar tarefas, exporte o JSON da versão anterior e importe pelo menu **Importar backup**. O app lê os backups V1, V2 e V3.

O app usa o mesmo esquema da V2, `public.workspaces` e `workos-media`. Uma instalação que já sincroniza nesse projeto pode continuar usando o esquema existente. O SQL incluído pode ser reaplicado para explicitar permissões das tabelas e políticas de acesso por usuário. Ele não apaga tarefas nem arquivos.

## Configurar um projeto Supabase novo

1. Execute `supabase_setup.sql` no SQL Editor do Supabase. Use o esquema `public` na Data API.
2. Habilite autenticação por e-mail e senha e configure a URL do site para confirmação de cadastro. Crie uma conta pelo app ou use uma já cadastrada.
3. No app, clique em **Modo local**, configure a URL e a chave pública do projeto, depois entre. Credenciais administrativas são desnecessárias.

Imagens e vídeos de até 40 MB são enviados na sincronização, respeitando o limite do Storage do projeto. Uma mídia que só existe em outro navegador ou projeto precisa ser anexada novamente. O backup JSON exporta tarefas, links e referências aos arquivos de mídia.

## Publicar ou testar

- No GitHub Pages, publique `index.html`, `app.js`, `estilos.css`, `supabase-storage.js`, a pasta `vendor` e o arquivo `.nojekyll` na mesma pasta. O GitHub Pages hospeda o app e o Supabase armazena os dados.
- Para abrir localmente, extraia o ZIP, execute `python -m http.server 8000` nessa pasta e acesse [localhost:8000](http://localhost:8000). O navegador trata o teste local e o site publicado como origens independentes.
- `dados.json` é o exemplo do projeto original. A importação é opcional.

A biblioteca usada no navegador é `@supabase/supabase-js` 2.119.2, distribuída com sua licença na pasta `vendor`.
