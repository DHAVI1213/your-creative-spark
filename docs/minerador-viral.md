# Minerador Viral no aplicativo

## Ativação pelo dono

1. Aplique pela Lovable a migração `supabase/migrations/20261011031000_viral_buscas.sql`. Ela cria o histórico interno de coletas com RLS e libera `apify_token` na função administrativa já existente, preservando a chave Kiwify.
2. Crie uma conta na [Apify](https://console.apify.com/), com saldo e acesso aos coletores abaixo. O aplicativo usa uma conta do dono para todas as buscas; buscas e downloads podem gerar cobrança nessa conta. Não é preciso uma VPS nem instalar a extensão no celular.
3. Entre como dono, abra **Minerador Viral → Conectar serviço** e salve o token Apify. Não cole o token em arquivos públicos nem em mensagens. A chave é armazenada em `app_secrets` e usada exclusivamente no servidor.
4. Faça uma primeira busca com 25 vídeos em um perfil público conhecido. Confira os números na rede de origem antes de disponibilizar para clientes.

Coletores usados e contratos consultados:

- [Instagram Reel Scraper](https://apify.com/apify/instagram-reel-scraper): `username`, `resultsLimit`; saída `videoPlayCount`, `likesCount`, `videoUrl`, `displayUrl`.
- [TikTok Scraper](https://apify.com/clockworks/tiktok-scraper): `profiles`, `resultsPerPage`, `shouldDownloadVideos: true` (complemento cobrado pelo provedor). O arquivo pode vir em `mediaUrls`.
- [YouTube Scraper](https://apify.com/streamers/youtube-scraper): canal em `startUrls`, limites de vídeos e Shorts. Coleta métricas antes do download.
- [YouTube Video Downloader](https://apify.com/datapipe/youtube-video-downloader): somente os links selecionados, `videoUrls`, MP4, 720p; arquivo em `downloadUrl` no armazenamento Apify.
- [API de execução e resultados](https://docs.apify.com/api/v2): inicia execuções assíncronas e consulta status e dataset. Nenhuma chave Apify é devolvida ao navegador.

## Uso

Cole um perfil do Instagram, TikTok ou YouTube. Selecione 25, 50, 100 ou 200 vídeos para analisar. Ordene por visualizações, curtidas, comentários, engajamento, data ou desempenho relativo. Combine views e likes mínimos, busca no título e vezes a mediana. **Selecionar todos os filtrados** seleciona o conjunto visível (até 50); seleções anteriores permanecem quando filtros mudam.

**Baixar ZIP** baixa os arquivos reais e monta o ZIP no aparelho. **Importar para o Editor** guarda os arquivos no IndexedDB por conta, abre `/editor` e importa automaticamente na mesa. A ordem de seleção da mesa é preservada. Arquivos só são removidos da transferência depois de confirmados; falhas ficam disponíveis para nova tentativa ao recarregar o Editor. Um lote pendente não é sobrescrito por outro.

## Limites e comportamento

- A integração está preparada, mas não foi ativada nem testada contra uma conta Apify real nesta entrega. A busca fica bloqueada sem configuração; nenhum resultado de exemplo é mostrado ao cliente.
- A coleta depende da disponibilidade das redes e dos coletores. Perfis privados, restrições de acesso, métricas ocultas e URLs de mídia expiradas podem impedir resultados ou download. A coleta limitada não representa todo o histórico do perfil.
- Métricas ausentes aparecem como **Não informado**, não como zero. O score é views divididas pela mediana positiva de views da coleta; não é uma promessa de viralização.
- Até 50 arquivos por lote, 48 MB por arquivo e até 200 MB somados (ou o limite menor do aparelho). Vídeos grandes exigem uma futura entrega com armazenamento e streaming, para evitar respostas e ZIPs enormes no celular.
- Há uma busca em andamento por conta, com reserva antes de iniciar coleta paga; até 10 buscas por hora por usuário. Reservas de coleta expiram após 20 minutos. O botão Interromper encerra a espera/download na interface; uma execução já iniciada na Apify pode continuar e consumir saldo. É possível abortá-la pelo painel Apify.
- Downloads aceitam apenas CDNs reconhecidas e arquivos no armazenamento Apify, sem redirecionamentos. URLs de download enviadas pelo navegador não são usadas: o servidor consulta o resultado pertencente ao usuário. Retornos HTML ou arquivos sem cabeçalho MP4/WebM são recusados.
- O código da extensão continua preservado em `tools/editor-original/extensao`; esta integração não depende de `localhost` nem do motor Windows. Os status em `src/lib/app.ts` permanecem inalterados conforme a instrução anterior.

## Validação

Testes automatizados cobrem links válidos/inválidos, métricas ausentes, deduplicação, ranking/filtros, URLs de mídia, sessão/plano e isolamento por usuário. O fluxo no navegador foi verificado com respostas de coleta controladas e vídeos MP4 reais: filtrar, selecionar, ZIP com os arquivos e importação automática na mesa, além da largura de celular. Isso não substitui a validação dos coletores com saldo e credenciais reais.

Depois de configurar: busque um perfil público em cada plataforma; filtre views/likes; selecione dois vídeos; abra o ZIP e confira os arquivos. Repita com **Importar para o Editor** e confirme que os vídeos aparecem prontos para edição. Confira também perfil inexistente, sem resultados, chave inválida e vídeo indisponível.
