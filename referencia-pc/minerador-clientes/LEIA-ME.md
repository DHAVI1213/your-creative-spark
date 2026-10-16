# Minerador de Clientes

Acha lojas no Google Maps da sua cidade e mostra quais têm mais chance de comprar um site.

## Instalar (uma vez)
1. Descompacte o ZIP numa pasta que você não vai apagar (ex.: Documentos\minerador-clientes).
2. No Chrome, abra `chrome://extensions`.
3. Ligue o **Modo do desenvolvedor** (canto de cima, à direita).
4. Clique em **Carregar sem compactação** e escolha a pasta.
5. Fixe o ícone verde (o alfinete de mapa) na barra do Chrome.

## Usar
1. Clique no ícone: o painel abre do lado.
2. Escreva o que procurar (ou toque num atalho, como "hamburgueria") e a cidade (ex.: "Formosa GO").
3. Clique em **Buscar no Maps**. A aba do Maps abre e a extensão rola a lista sozinha.
   **Deixe a aba do Maps à vista enquanto ela lê a lista**: o Maps só carrega mais lojas quando a aba está aparecendo.
4. Com "Ver site e telefone de cada loja" ligado, a extensão abre cada loja numa aba de fundo (uma por vez, ~2 s cada) e depois avalia o site.
5. Use os filtros (quentes, só sem site, esconder já contatados) e:
   - **WhatsApp**: abre a conversa com a mensagem pronta (você revisa e envia);
   - **Copiar msg**: copia a mensagem;
   - **marcar contatado**: some da lista se você ligar "esconder já contatados";
   - **Planilha**: baixa um CSV que abre no Excel ou no Google Planilhas.

Se você já fez a busca no Maps por conta própria, use **Ler a lista que está aberta**.

## A nota de chance (0 a 100)
- **Quente (60+)**: sem site; ou o "site" é Instagram, Linktree, WhatsApp, iFood, Anota AI ou outro cardápio digital; ou o site não abre.
- **Morna (35–59)**: tem site, mas com problemas: não se ajusta ao celular, sem https, lento, parado há anos, feito em construtor grátis.
- **Fria (<35)**: já tem um site que parece bom.
- Nota alta e muitas avaliações aumentam a chance (a loja vende bem e tem como investir). Lojas fechadas de vez ficam de fora.

## Bom saber
- A extensão lê o que o Maps mostra na sua tela. Os termos do Google não permitem coleta automática, então use com moderação: algumas buscas por dia, não centenas. Se o Google mostrar um aviso ou "captcha", pare um pouco.
- Se o Google mudar o visual do Maps, a leitura pode parar de funcionar e precisar de ajuste.
- Tudo fica salvo só no seu navegador (aba Histórico). Nada é enviado para servidor nenhum.
- Edite a mensagem do WhatsApp e os atalhos de busca na aba Ajustes.
