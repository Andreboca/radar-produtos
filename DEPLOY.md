# Deploy do Radar de Produtos (Railway)

Tudo que o código precisa já está pronto (Dockerfile, railway.json). Estes são os únicos passos:

1. Crie um repositório privado no GitHub e envie o projeto.
2. No Railway, clique em "New Project" > "Deploy from GitHub repo" e escolha o repositório.
3. Em "Variables", adicione:
   - TELEGRAM_BOT_TOKEN (token novo do bot)
   - TELEGRAM_GRUPO_ID (-1004310881003)
   - ANTHROPIC_API_KEY (opcional, para o agente de imagem)
4. Em "Volumes", crie um volume montado em /app/data, para as configurações e o histórico não se perderem.
5. Em "Networking", gere um domínio público e acesse pelo navegador.

Nunca envie tokens em chat ou commits.
