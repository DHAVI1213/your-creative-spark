# Integração da ferramenta original

Origem: `D:\MINHAS FERRAMENTAS\editor-em-massa\editor-em-massa` (versão 0.2.0).

A tela `/editor` usa a interface original em `public/editor-original`, isolada em uma moldura para não misturar CSS e estado com o restante do aplicativo. `browser-api.js` substitui o acesso ao Electron. A geometria, o desenho de texto, filtros, capas e legendas e o construtor FFmpeg foram reaproveitados diretamente.

## Disponível no navegador

- Importação de até 50 vídeos, prévia, seleção individual/seleção/todos e aplicação ao vivo.
- Perfis, recorte manual e detecção de barras, limpeza de headline/legenda, espelhamento, velocidade, ajustes de cor e filtros.
- Fundo de cor/imagem/desfocado, moldura, logo, texto, CTA, capas, áudio original/mudo/música/mixagem, resolução, FPS, bitrate e remoção de metadados.
- Exportação MP4 real com FFmpeg WebAssembly; download pelo cartão pronto. O arquivo original é preservado. Uma fila serial evita concorrência no sistema de arquivos do FFmpeg.
- Interface responsiva e arraste por ponteiro; fontes locais com os mesmos pesos da ferramenta original.

## Serviços que exigem configuração

1. Aplicar `supabase/migrations/20261011020000_editor_conexoes.sql` pela Lovable.
2. Em **Conexões de IA e agenda**, configurar as chaves necessárias. Cada usuário tem conexões próprias; segredos não são devolvidos ao navegador e a tabela tem RLS sem acesso dos clientes.
3. Legendas usam Whisper na API OpenAI, com tempos por palavra. O áudio é enviado em partes de cinco minutos. Partes prontas são guardadas no IndexedDB por hash do arquivo e idioma, para reutilizar/retomar. Não é o Whisper local offline do Electron.
4. Cortes e frases usam OpenAI, Gemini ou Claude; **Sem IA** seleciona por regras, mas ainda precisa de transcrição. Os cortes são exportados no aparelho.
5. O agendador usa o Worker original em `tools/editor-original/nuvem`. Instalar suas dependências e executar `setup.js` em um ambiente de administração; conectar o endereço `workers.dev` e a chave da nuvem na conta correspondente. Configurar também as credenciais OAuth das plataformas no Worker. Nenhuma nuvem foi implantada por esta mudança. O aplicativo não compartilha contas sociais entre usuários.

## Dependências ainda pendentes

O usuário informou que não tem VPS. Processamento pesado de vídeos de até dez horas, downloads do YouTube com yt-dlp e execução de modelos Ollama/Whisper locais exigem um servidor de processamento. Não estão disponíveis na versão web e não devem ser anunciados como concluídos. GPU NVIDIA e caminhos/pastas do Windows foram retirados dos controles da versão web. Os limites de arquivo seguem `useDevice()`; no celular, começar com vídeos curtos em 720p.

A extensão Minerador Viral original foi preservada em `tools/editor-original/extensao` como referência. Sua integração automática ainda aponta para a ponte local `127.0.0.1:47811`; não foi migrada para o aplicativo web. Ela exige uma extensão de navegador e não funciona como extensão nos navegadores móveis comuns. O aplicativo existente de Minerador Viral não foi alterado.

Os módulos nativos de transcrição/cortes, download com yt-dlp e limpeza de metadados foram preservados em `tools/editor-original/motor` para a futura adaptação do servidor. São referências de código: não há API de processamento pesado implantada nem uma conexão pronta com esses módulos na tela web. Antes de hospedá-los será necessário criar autenticação, isolamento por usuário, upload, fila e entrega dos resultados; não basta executar esses arquivos em uma VPS.

Não foram copiados executáveis, `node_modules`, configuração pessoal da nuvem ou chaves do diretório original. Login, planos, Kiwify, Limpador, Clonador e status da lista de ferramentas foram preservados.

## Validação manual

Importar quatro vídeos, selecionar **Todos**, ativar **Aplicar na hora** e testar recorte, filtro, logo/texto, capa e áudio; processar e baixar o MP4 do cartão pronto. Repetir em uma tela de 390 px e importar um vídeo sem áudio. Configurar os serviços antes de testar transcrição, cortes por IA ou publicação; esses serviços não foram validados com credenciais reais nesta integração.

Referências de serviço: [transcrição OpenAI](https://developers.openai.com/api/docs/guides/speech-to-text), [Gemini](https://ai.google.dev/api/generate-content), [modelos Claude](https://platform.claude.com/docs/en/models/overview).
