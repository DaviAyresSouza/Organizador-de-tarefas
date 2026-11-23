# Meu Work OS · versão revisada

O organizador roda em GitHub Pages como uma aplicação estática. O site pode continuar no repositório público atual. A sincronização usa um arquivo JSON em um segundo repositório, privado. O quadro também funciona com a cópia local do navegador.

## Prévia local

Extraia o ZIP. Abra a pasta, execute `python -m http.server 8000` e acesse [localhost:8000](http://localhost:8000). O teste local usa uma origem diferente da do site publicado e começa com um quadro vazio. O arquivo `dados.json` contém os exemplos que vieram no ZIP original e pode ser usado para testar a importação.

## Migração e publicação

1. Antes de substituir a versão antiga, abra o site atual. Se suas tarefas estão no Supabase, entre na conta antiga, sincronize e use **Exportar backup JSON**. Baixe também os arquivos do Storage que precisar conservar. O JSON antigo contém referências a esses arquivos. Ele não contém os binários.
2. Coloque `index.html`, `estilos.css`, `app.js` e `github.js` na pasta que o GitHub Pages já publica, normalmente a raiz de `main`. O projeto dispensa uma etapa de build.
3. Abra o mesmo endereço que você já usava. Tarefas e mídias locais da V2 são lidas nesse navegador e nessa origem. Para dados que estavam apenas no Supabase, use **Importar backup**. O importador aceita a lista V1, o backup V2 e o backup atual.
4. Selecione uma tarefa para anexar novamente os arquivos baixados da versão antiga. Links HTTP ou HTTPS acompanham a tarefa na sincronização. Arquivos enviados ao editor ficam no navegador de origem.

## Conectar o GitHub

1. Crie um repositório **privado** dedicado aos dados. Marque a opção de adicionar um README na criação.
2. Nas [configurações de tokens do GitHub](https://github.com/settings/personal-access-tokens), gere um *fine-grained personal access token*. Restrinja o acesso ao repositório privado e configure **Contents** como **Read and write**.
3. No app, clique em **Modo local**, informe `usuário/repositório` e cole o token diretamente no formulário do app. Clique em **Conectar**.
4. O app cria ou lê `work-os.json` na branch padrão. Durante a sessão, alterações são enviadas automaticamente após uma breve pausa. Use **Sincronizar agora** para buscar alterações de outro dispositivo ou reenviar uma gravação que falhou.
5. Ao recarregar a página, reconecte para voltar a sincronizar. O token fica em memória durante a sessão. A cópia local continua disponível.

Quando o GitHub e o navegador têm versões divergentes, o app pede para você escolher qual usar. Ao usar a versão remota, a versão local anterior pode ser exportada na janela de sincronização. Ao enviar a versão local, a versão anterior fica no histórico do repositório. Essa escolha substitui o quadro inteiro. Exporte a cópia local antes de combinar manualmente alterações de versões diferentes.

O limite de sincronização do JSON é 900 KB. O histórico de commits guarda versões anteriores do quadro. Os backups JSON contêm tarefas, checklist, links e referências de anexos. Imagens e vídeos enviados ao editor ficam no IndexedDB local.
