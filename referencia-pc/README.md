# Referência: ferramentas originais do PC do Nataniel

Código das versões desktop/extensão das ferramentas, para servir de referência ao portar para o SaaS.
NÃO é importado pelo app (fica fora de src/). Não editar.

| Ferramenta no SaaS | Onde está o original |
|---|---|
| Editor em Massa | editor-em-massa/ (src/app.js, src/shared.js, src/render.js, ffmpeg-builder.js, main.js) |
| Cortes Virais + Legenda animada | editor-em-massa/cortes.js, src/cortes-ui.js, src/legendas.js |
| Limpador de Metadados | editor-em-massa/limpar-metadados.js + opção "Excluir todos os metadados" em ffmpeg-builder.js |
| Agendador | editor-em-massa/src/agendador.js + nuvem/worker.js (publicação IG/YouTube/TikTok) |
| Minerador Viral | editor-em-massa/extensao/ (extensão Chrome) + minerador-ponte.js |
| Clonador de Sites | copiador-de-sites/ (extensão Chrome) |
| Minerador de Clientes | minerador-clientes/ (extensão Chrome) |
