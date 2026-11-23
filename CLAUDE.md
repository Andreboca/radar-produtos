# Radar de Produtos

App do André (`andrepostoolimpio`) para achar produtos em alta no TikTok Shop e
divulgá-los como afiliado, com painel de vendas e envio automático para Telegram.

## Como falar com ele

**Ele não é programador.** Nada de jargão. Passo a passo, uma etapa por vez, e
sempre dizendo onde clicar. Ele trabalha num posto de combustível e mexe nisto
nas horas vagas.

Regras que ele pediu e que valem sempre:

1. **Confira na documentação oficial antes de mandar ele fazer qualquer coisa.**
   Já perdeu uma noite inteira seguindo um caminho que não existia. Se não tiver
   certeza, diga que não tem certeza em vez de inventar.
2. **Mostre o resultado em prévia web clicável**, não só captura de tela.
3. **Ele prefere executar ele mesmo** para economizar o limite de uso. Passe o
   passo a passo; só execute o que ele disser que não sabe fazer.
4. **Nunca entre nas contas dele.** Senha, cartão, autorização de acesso e
   documento são com ele. Chaves e segredos ele cola direto no Railway — nunca
   peça para colar no chat.
5. **O Digisat não se toca.** É o sistema de nota fiscal do posto, roda no PC
   dele (serviço MongoDBDigisat). Nada nele pode ser modificado.
6. **Ele não quer Mercado Livre no projeto.** Já disse isso de forma clara.

## O que o app faz

- **Painel de afiliado** — faturamento e comissão do próprio André, atualizado sozinho
- **Produtos em alta** — ranking do TikTok Shop por país (BR, US, GB) e por
  critério (maior faturamento, mais unidades, maior crescimento)
- **Vídeos que vendem** — para cada produto, os vídeos que geraram venda, com
  selo de anúncio pago e filtro de orgânicos. É o que ele usa para modelar os
  próprios vídeos.
- **Monitor automático** — busca de tempos em tempos e posta no Telegram com
  foto, título, preço e cupons

## Stack

- Next.js 15 App Router, TypeScript, sem Tailwind (CSS próprio em `app/globals.css`)
- Hospedado no Railway, serviço `radar-produtos`, volume `radar-produtos-volume`
- Configuração em `data/config.json` via `lib/config.ts`; segredos por variável
  de ambiente no Railway

### Arquivos que importam

| Arquivo | O que faz |
|---|---|
| `lib/fastmoss.ts` | Ranking de produtos e vídeos do TikTok Shop (FastMoss) |
| `lib/tiktok.ts` | API oficial de criador afiliado do TikTok (bloqueada no Brasil) |
| `lib/tiktokContas.ts` | Tokens das contas de criador, com renovação automática |
| `lib/monitor.ts` | Checagem periódica que alimenta o Telegram |
| `lib/divulgacao.ts` | Monta e envia a oferta |
| `lib/shopee.ts`, `lib/meli.ts` | Outras plataformas |
| `app/page.tsx` | Tela principal, menu lateral azul à esquerda |
| `app/videos.tsx` | Janela dos vídeos que vendem |

## Estado atual (23/11/2026)

### Funcionando
- Site no ar, painel e aba de produtos em alta
- Código da FastMoss escrito e publicado, incluindo o monitor automático

### Travado esperando o André
- **Chave da FastMoss.** Ele precisa comprar duas APIs (US$ 18: produtos mais
  vendidos + vídeos associados ao produto) e colar a chave no Railway como
  `FASTMOSS_TOKEN`. **Sem ela o painel mostra 0 produtos.** É o próximo passo.
- **Deploy automático desligado** no Railway (Settings > Source > Enable). Sem
  isso todo commit precisa de "Check for updates > Update" na mão, e já aconteceu
  de o código ficar 8 dias parado sem ninguém perceber.
- **Plano do Railway**: o período de teste acaba e ele precisa decidir.

### Travado com terceiros
- **TikTok**: a API oficial de criador afiliado não é liberada no Brasil. O
  portal responde "Not available in your region" — os países aceitos são
  Indonésia, Irlanda, Malásia, Filipinas, Singapura, Tailândia, Reino Unido,
  Estados Unidos e Vietnã. Chamado aberto no Partner Center, ticket
  **2026111422120200001**, pedindo liberação do Brasil. **É isso que falta para
  o link de afiliado sair automático** — hoje o link que o app devolve é o da
  loja, não o dele.
  - App no Partner Center: `Radar de Produtos Afiliado`, service ID
    `7707570174632593158`, status Rascunhos. Para publicar falta o questionário
    de segurança e privacidade de dados (19 perguntas, em inglês).
- **Shopee**: conta de afiliado aprovada, mas sem acesso à Open API. Depende de
  completar dados fiscais e de pagamento no painel deles.

## Pendências de qualidade

- O token do Telegram está em `data/config.json`; deveria estar só em variável
  de ambiente.
- O site não tem login. Qualquer um com o endereço vê o painel.

## FastMoss — o que já foi verificado na documentação

- Base: `https://openapi.fastmoss.com`, cabeçalho `Authorization: Bearer <chave>`
- `POST /product/v1/rank/topSelling` — `filter.region` aceita BR, US, GB entre
  outros; `date_info` é obrigatório; ordena por `gmv`, `units_sold`,
  `total_units_sold`, `total_gmv`, `growth_rate`
- `POST /product/v1/videoList` — filtra por `product_id`, `days` e **`is_ad`**
  (0 orgânico, 1 anúncio pago); `orderby` aqui é objeto, não lista
- Cobrança: US$ 0,01 por chamada, lote mínimo de 1.000. **A cota é por lote de
  10 resultados** (`ceil(pagesize / 10)`), então `pagesize` fica em 10 de
  propósito. Busca vazia não é cobrada.
