# Radar de Produtos

Aplicação Next.js que consulta as **APIs oficiais** do Mercado Livre, Shopee e
TikTok Shop para mostrar produtos mais vendidos, comparar preços entre
plataformas e calcular lucro. Todo dado exibido vem direto da API; a IA é opcional e só comenta esses dados.

## Como rodar

Requisitos: Node.js 18.18 ou mais novo.

```bash
npm install
npm run dev
```

Abra http://localhost:3000 e vá na aba **Conexões**. Cole as credenciais de
cada plataforma e clique em **Salvar e testar**: o app guarda, faz uma chamada
real para conferir e mostra se conectou. Não é preciso editar arquivo nenhum.

- No Telegram e no WhatsApp, o botão **Buscar meus grupos** lista os grupos e
  você só escolhe; ao escolher, chega uma mensagem de teste no grupo.
- As credenciais ficam em `data/config.json`, só no seu computador, em texto
  simples. A tela nunca mostra o valor inteiro de volta (só os 4 últimos
  caracteres). Não publique essa pasta nem hospede o app aberto na internet
  sem colocar uma senha na frente.
- O `.env.local` continua funcionando como alternativa (veja `.env.example`).

## Painel de afiliado

É a primeira tela. Mostra comissão ganha, total vendido pelos seus links,
número de vendas e comissão média, com gráfico por dia, divisão por plataforma
e os produtos que mais renderam, em 7, 30 ou 90 dias.

**Tudo automático, sem lançar nada à mão:**

- O painel busca as vendas sozinho a cada `PAINEL_ATUALIZAR_SEG` segundos
  (padrão 60, mínimo 15; ajustável em Conexões → Automação) e mostra há quantos
  segundos foi a última atualização. Venda nova aparece destacada.
- Com o Telegram conectado, cada venda nova gera um aviso no seu celular,
  mesmo com o painel fechado (o app precisa estar rodando).
- **Shopee:** relatório de conversões da API de afiliados.
- **TikTok Shop:** API de pedidos de afiliado do criador.
- **Mercado Livre:** não tem API pública para as vendas do programa de
  afiliados; elas só existem no painel de afiliado do site, então não entram.

Limites reais:

- Não é possível atualizar a cada segundo: as APIs limitam o número de
  consultas e bloqueiam quem passa do limite. O intervalo mínimo aceito é 15 s.
- **Venda diária:** o bloco "Venda diária · hoje" mostra comissão, faturamento
  e vendas do dia atual (fuso de São Paulo), com a comparação com a média
  diária do período escolhido. O gráfico "Vendas por dia" tem um seletor para
  ver comissão, faturamento ou número de vendas, e a tabela mostra as três
  colunas por dia.
- A venda só aparece quando a plataforma a registra no relatório de afiliado,
  o que pode levar alguns minutos depois da compra.
- As duas importações foram escritas pela documentação e **ainda não foram
  testadas com contas reais**. A do TikTok Shop é a mais incerta (o formato da
  resposta pode precisar de ajuste). Erros aparecem no próprio painel.
- Vendas canceladas aparecem riscadas e não entram nos totais.

## Logotipos das plataformas

Coloque os logotipos oficiais em `public/logos` com os nomes `shopee.png`,
`tiktok.png` e `meli.png` (veja `public/logos/LEIA-ME.txt`). Eles aparecem nas
vendas recentes, nos cartões de produto e no resumo por plataforma. Sem os
arquivos, o app mostra a inicial de cada plataforma.

## Top 10 vendendo agora

Na tela Produtos em alta, no topo, ficam os 10 produtos que mais venderam na
**última hora** ou no **último dia**, cada um com foto, preço, quantidade
vendida na janela e o botão **Ver na loja oficial** (o link que a própria
plataforma devolve; na Shopee é o seu link de afiliado).

- A contagem vem do histórico do monitor: unidades vendidas = aumento das
  vendas acumuladas entre uma checagem e a seguinte. Para a janela de uma hora
  funcionar, o monitor precisa checar pelo menos duas vezes por hora (o padrão
  de 30 minutos já atende).
- Enquanto não houver duas checagens na janela, a lista mostra o ranking atual
  das plataformas e avisa isso na tela.
- Só entram produtos que o monitor acompanha (categorias e palavras-chave
  escolhidas em Alertas). Mercado Livre não informa unidades vendidas, então os
  produtos de lá só aparecem no modo ranking.

## Analisar métricas

Cada cartão de produto tem o botão **Analisar métricas**, que abre uma janela
com período (24 horas, 7 dias, 30 dias), unidades vendidas, volume bruto,
gráfico por intervalo e um indicador de potencial de 0 a 100.

- Os números vêm do **histórico que o próprio app coleta**: a cada busca e a
  cada checagem do monitor ele grava um ponto por produto em
  `data/historico.json`. Unidades vendidas = aumento das vendas acumuladas
  entre um ponto e o seguinte. Por isso o gráfico só aparece depois de pelo
  menos duas checagens do produto, e fica mais rico com os dias.
- Quando a plataforma não informa vendas (produtos de catálogo do Mercado
  Livre), a janela mostra a posição no ranking ao longo do tempo.
- O **indicador de potencial** é um cálculo do app, não um número oficial:
  procura (até 40), ritmo de vendas em 7 dias (até 25), avaliação (até 20) e
  comissão (até 15). A janela mostra quanto cada parcela somou.

## Alertas (aba Alertas + Telegram)

O monitor roda sozinho **enquanto o app estiver aberto** (`npm run dev` ou
`npm start`). Se o computador desligar ou o app fechar, os avisos param.

- Na aba **Alertas**, marque as categorias do Mercado Livre e escreva as
  palavras-chave para Shopee e TikTok Shop.
- A cada `MONITOR_INTERVALO_MIN` minutos ele consulta as APIs e compara com a
  checagem anterior. Vira alerta: produto que entrou no ranking, que subiu 3
  posições ou mais, ou cujas vendas cresceram 10% ou mais.
- Uma vez por dia, a partir de `MONITOR_HORA_RESUMO`, sai o resumo com o top 5
  de cada lista.
- Tudo aparece na aba Alertas e, se o Telegram estiver configurado, chega
  também no celular.
- Com `ANTHROPIC_API_KEY` preenchida, o resumo diário ganha um comentário da IA
  apontando as melhores oportunidades. A IA lê só os dados das APIs.

A primeira checagem apenas registra o ranking; os avisos de mudança começam na
segunda. O histórico fica em `data/monitor.json`.

## Envio automático para grupos (Telegram e WhatsApp)

A cada checagem (padrão: 30 minutos) o app escolhe os produtos em alta que
ainda não foram enviados e manda para os grupos configurados. Um mesmo produto
só volta a ser enviado depois de `DIVULGACAO_REPETIR_HORAS` (padrão: 24h);
quando não há nada novo no ranking, aquela rodada não envia nada.

**Telegram:** adicione o seu bot ao grupo como administrador, mande uma
mensagem no grupo e copie o id do grupo (número negativo) de
`https://api.telegram.org/bot<TOKEN>/getUpdates` para `TELEGRAM_GRUPO_ID`.

**WhatsApp:** a API oficial do WhatsApp só libera grupos para contas com selo
oficial e limita cada grupo a 8 pessoas, então o envio usa um conector que
opera um número comum de WhatsApp: Evolution API (código aberto, você hospeda)
ou Z-API (serviço pago). Preencha `WHATSAPP_PROVEDOR`, `WHATSAPP_GRUPO_ID` e as
chaves do conector escolhido. Esses conectores **não são oficiais**: o WhatsApp
pode restringir ou banir números que automatizam envios. Use um número separado
do pessoal e um grupo em que as pessoas entraram por vontade própria.

Na aba Alertas, o botão **Testar grupos** manda uma mensagem de teste a cada
grupo configurado. Os links da Shopee já saem como links de afiliado; os do
Mercado Livre são links comuns do anúncio.

## O que cada API entrega

| Plataforma | Dados | Credencial |
| --- | --- | --- |
| Mercado Livre | Top 20 mais vendidos por categoria, 50 buscas em tendência da semana, preço do catálogo | App criado em developers.mercadolivre.com.br (App ID + Secret Key) |
| Shopee | Produtos com preço, vendas, avaliação, comissão e link de afiliado | Conta aprovada em affiliate.shopee.com.br (App ID + Secret da seção Open API) |
| TikTok Shop | Produtos abertos para afiliados, com preço e comissão | App aprovado em partner.tiktokshop.com + access token de criador |

Limites reais das APIs:

- **Mercado Livre** não informa quantidade vendida nos produtos de catálogo;
  o sinal de venda é a posição no ranking oficial.
- **Shopee** só lista produtos que participam do programa de afiliados.
- **TikTok Shop** não tem endpoint de "mais vendidos". A integração
  (`lib/tiktok.ts`) foi escrita pela documentação e **ainda não foi testada**
  com credenciais reais; pode precisar de ajuste no formato da resposta.

## Estado dos testes

O projeto foi escrito sem credenciais das plataformas, então nenhuma das três
integrações foi chamada de verdade ainda. Quando uma API recusar a consulta, a
mensagem original dela aparece na tela — mande essa mensagem para ajustar.

## Estrutura

```
app/page.tsx                    painel (menu lateral, cartões de produto)
app/painel.tsx                  painel de afiliado (primeira tela)
app/top.tsx                     Top 10 vendendo agora (última hora / último dia)
lib/vendas.ts                   vendas de afiliado: importação e totais
app/alertas.tsx                 aba de alertas
app/metricas.tsx                janela "Analisar métricas" com gráfico
lib/historico.ts                histórico por produto e cálculo das métricas
app/conexoes.tsx                tela de credenciais e grupos
lib/config.ts                   credenciais salvas pela tela
instrumentation.ts              agendador do monitor
lib/monitor.ts                  checagem, comparação e alertas
lib/telegram.ts                 envio para o Telegram
lib/whatsapp.ts                 envio para grupo de WhatsApp
lib/divulgacao.ts               escolha e envio das ofertas aos grupos
lib/ia.ts                       comentário opcional da IA
app/api/mais-vendidos/route.ts  ranking e tendências
app/api/comparar/route.ts       mesma busca nas três plataformas
app/api/categorias/route.ts     categorias do Mercado Livre
app/api/status/route.ts         quais plataformas estão conectadas
lib/meli.ts                     cliente Mercado Livre
lib/shopee.ts                   cliente Shopee Affiliate
lib/tiktok.ts                   cliente TikTok Shop (não testado)
lib/fees.ts                     taxas padrão e cálculo de lucro
```

As taxas de `lib/fees.ts` são aproximações de novembro de 2026 e são editáveis
na tela da calculadora.
