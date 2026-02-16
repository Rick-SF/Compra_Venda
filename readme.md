# Painel de Compra e Venda de Veículos

Aplicação Node.js + Express que serve as páginas HTML/CSS/JS e persiste os cadastros em um MySQL usando o driver `mysql2/promise`. O servidor cria o banco (se tiver permissão), garante as tabelas `clients` e `operations` e fornece os endpoints usados pelo front-end.

## Rodando na sua máquina

1. Instale o [Node.js 20 LTS](https://nodejs.org/) (ou use `nvm`).
2. Dentro da pasta `Compra_Venda`, execute `npm install`.
3. Disponibilize um MySQL (local com XAMPP/Docker ou remoto). Crie um usuário com permissão de criar banco/tabelas.
4. Ajuste o `.env` com as credenciais:
   ```
   PORT=3000
   DB_HOST=seu-host.mysql.com
   DB_PORT=3306
   DB_USER=usuario
   DB_PASSWORD=senha
   DB_NAME=vendaveiculos
   DB_CONN_LIMIT=10
   ```
5. Rode `npm start` e abra `http://localhost:3000`. Na primeira execução o backend garante o schema e passa a responder às páginas do diretório.

## Usando o banco da HostingMachine (cPanel)

1. Entre no cPanel → **MySQL Databases** e crie o banco + usuário. Guarde host, usuário, senha e nome do banco.
2. Em **Remote MySQL**, autorize o IP do servidor onde o Node irá rodar (sua máquina local ou outro host). Sem essa liberação o firewall bloqueia conexões externas.
3. Se o provedor exigir SSL, baixe os certificados e ative a flag correspondente no ambiente (por exemplo exporte `NODE_EXTRA_CA_CERTS` ou ajuste o código para `ssl: { rejectUnauthorized: false }`).
4. Atualize o `.env` com os dados reais da HostingMachine (host costuma ser algo como `mysql.seudominio.com` e não `localhost`).
5. Publique o backend: no próprio cPanel use **Setup Node.js App** apontando para esta pasta (entry point `server.js`) ou hospede o Node em outro serviço (Railway, VPS etc.) e deixe apenas o front em `public_html`. O importante é que o processo Node tenha acesso à porta da HostingMachine e às mesmas variáveis de ambiente.

## Notas úteis

- Os cadastros são expostos via `/api/operations` e `/api/clients`. Se o front estiver em outro domínio, habilite CORS para esse domínio ou use um proxy.
- Para testar a conexão com o banco antes do deploy use `mysql -h <host> -P <porta> -u <user> -p`.
- Backups podem ser feitos com `mysqldump -h <host> -P <porta> -u <user> -p <db> > backup.sql`.
- Se precisar resetar o ambiente rapidamente, execute `DROP DATABASE vendaveiculos;` (ou limpe as tabelas) e reinicie o servidor; o schema será recriado automaticamente.
