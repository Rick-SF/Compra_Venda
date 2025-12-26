# Painel de Compra e Venda de Veículos

Aplicação em Node.js + Express que serve o front-end (HTML/CSS/JS) e salva os dados em um banco SQLite (`data/app.db`). Abaixo estão os passos para usar localmente e publicar no Railway sem precisar entender todos os detalhes técnicos.

## Rodando na sua máquina

1. Instale o [Node.js 20 LTS](https://nodejs.org/) (ou use o `nvm`).
2. Dentro da pasta `VendaVeiculos`, execute `npm install` para baixar as dependências.
3. Garanta que exista o arquivo `.env` com:
   ```
   PORT=3000
   SQLITE_PATH=./data/app.db
   ```
4. Rode `npm start` e acesse `http://localhost:3000`. Todos os cadastros ficam no arquivo `data/app.db`.

> Deploy público: https://compra-e-venda-production.up.railway.app  
> Credenciais padrão: usuário `admin` e senha `123456`.

## Preparando o deploy no Railway (explicação simples)

1. **Criar conta e instalar o CLI**  
   - Acesse [railway.app](https://railway.app/) e crie uma conta.  
   - Instale o CLI com `npm i -g @railway/cli` e faça login pelo terminal com `railway login`.

2. **Iniciar o projeto no Railway**  
   - Na pasta do projeto, rode `railway init` para vincular o diretório ao Railway e depois `railway up` para criar o ambiente base.
   - No painel web, crie um novo serviço e escolha “Deploy from Repository” (conecte ao seu GitHub) ou “Deploy from Dockerfile” se preferir usar Docker.
   - Ajuste o comando de start para `npm start`.

3. **Configurar variáveis e port**  
   - No painel do serviço, adicione as variáveis:
     - `PORT = 3000`
     - `SQLITE_PATH = ./data/app.db`

4. **Garantir que o banco não se perca**  
   - Crie um “Volume” no Railway e monte-o no caminho `/app/data`. Esse volume é um armário que guarda o arquivo `app.db`, assim seus dados persistem entre reinicializações.

5. **Deploy automático**  
   - Toda vez que enviar um `git push` para a branch configurada, o Railway recompila e publica seu site usando o comando `npm start`.
   - Após o deploy, o painel mostra um link. Abra esse endereço e teste os cadastros; os dados continuarão salvos porque o arquivo `app.db` está no volume.

## Dicas extras

- Para fazer backup manual do banco, copie o arquivo `data/app.db`.
- Se quiser testar o container localmente antes de subir, crie um `Dockerfile` e rode `docker compose up`; o Railway aceita tanto modo “Node” quanto “Docker”.
- Caso precise limpar a base, basta apagar o arquivo `data/app.db` (com o servidor desligado) e subir novamente; as tabelas são recriadas automaticamente.
