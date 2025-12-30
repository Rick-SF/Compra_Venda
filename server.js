const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const Database = require("better-sqlite3");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, "data", "app.db");

const resolvedDbPath = path.isAbsolute(DB_PATH)
    ? DB_PATH
    : path.join(__dirname, DB_PATH);
const dbDirectory = path.dirname(resolvedDbPath);
fs.mkdirSync(dbDirectory, { recursive: true });

const db = new Database(resolvedDbPath);

db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        cpf TEXT,
        rg TEXT,
        cnh TEXT,
        endereco TEXT,
        contato TEXT,
        email TEXT,
        observacoes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS operations (
        id TEXT PRIMARY KEY,
        tipo TEXT NOT NULL,
        data TEXT,
        veiculo TEXT,
        marca TEXT,
        modelo TEXT,
        cor TEXT,
        anoFabricacao TEXT,
        anoModelo TEXT,
        placa TEXT,
        cidade TEXT,
        uf TEXT,
        parceiro TEXT,
        contato TEXT,
        chassi TEXT,
        renavan TEXT,
        codigoCRVe TEXT,
        codigoCLAe TEXT,
        codigoATPVe TEXT,
        valorCompra REAL,
        valorVenda REAL,
        custosExtras REAL,
        observacoes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
`);

const ensureColumn = (table, column, definition) => {
    const info = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!info.some((col) => col.name === column)) {
        db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
    }
};

ensureColumn("clients", "observacoes", "TEXT");

app.use(cors());
app.use(express.json());

const staticPath = path.join(__dirname);
app.use(express.static(staticPath));

const mapOperationRow = (row) => ({
    ...row,
    valorCompra: row.valorCompra ?? 0,
    valorVenda: row.valorVenda ?? 0,
    custosExtras: row.custosExtras ?? 0,
});

app.get("/api/operations", (req, res) => {
    const stmt = db.prepare("SELECT * FROM operations ORDER BY datetime(created_at) DESC");
    const operations = stmt.all().map(mapOperationRow);
    res.json(operations);
});

app.post("/api/operations", (req, res) => {
    const record = req.body;
    if (!record.id) {
        return res.status(400).json({ message: "ID é obrigatório." });
    }
    const insert = db.prepare(`
        INSERT INTO operations (
            id, tipo, data, veiculo, marca, modelo, cor, anoFabricacao, anoModelo,
            placa, cidade, uf, parceiro, contato, chassi, renavan,
            codigoCRVe, codigoCLAe, codigoATPVe, valorCompra, valorVenda,
            custosExtras, observacoes
        ) VALUES (
            @id, @tipo, @data, @veiculo, @marca, @modelo, @cor, @anoFabricacao, @anoModelo,
            @placa, @cidade, @uf, @parceiro, @contato, @chassi, @renavan,
            @codigoCRVe, @codigoCLAe, @codigoATPVe, @valorCompra, @valorVenda,
            @custosExtras, @observacoes
        )
    `);
    insert.run(record);
    const row = db.prepare("SELECT * FROM operations WHERE id = ?").get(record.id);
    res.status(201).json(mapOperationRow(row));
});

app.put("/api/operations/:id", (req, res) => {
    const { id } = req.params;
    const record = { ...req.body, id };
    const stmt = db.prepare(`
        UPDATE operations SET
            tipo=@tipo,
            data=@data,
            veiculo=@veiculo,
            marca=@marca,
            modelo=@modelo,
            cor=@cor,
            anoFabricacao=@anoFabricacao,
            anoModelo=@anoModelo,
            placa=@placa,
            cidade=@cidade,
            uf=@uf,
            parceiro=@parceiro,
            contato=@contato,
            chassi=@chassi,
            renavan=@renavan,
            codigoCRVe=@codigoCRVe,
            codigoCLAe=@codigoCLAe,
            codigoATPVe=@codigoATPVe,
            valorCompra=@valorCompra,
            valorVenda=@valorVenda,
            custosExtras=@custosExtras,
            observacoes=@observacoes,
            updated_at=CURRENT_TIMESTAMP
        WHERE id=@id
    `);
    stmt.run(record);
    const row = db.prepare("SELECT * FROM operations WHERE id = ?").get(id);
    res.json(mapOperationRow(row));
});

app.delete("/api/operations/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM operations WHERE id = ?").run(id);
    res.status(204).end();
});

app.get("/api/clients", (req, res) => {
    const stmt = db.prepare("SELECT * FROM clients ORDER BY datetime(created_at) DESC");
    res.json(stmt.all());
});

app.post("/api/clients", (req, res) => {
    const client = req.body;
    if (!client.id) {
        return res.status(400).json({ message: "ID é obrigatório." });
    }
    const insert = db.prepare(`
        INSERT INTO clients (
            id, nome, cpf, rg, cnh, endereco, contato, email, observacoes
        ) VALUES (
            @id, @nome, @cpf, @rg, @cnh, @endereco, @contato, @email, @observacoes
        )
    `);
    insert.run(client);
    const row = db.prepare("SELECT * FROM clients WHERE id = ?").get(client.id);
    res.status(201).json(row);
});

app.put("/api/clients/:id", (req, res) => {
    const { id } = req.params;
    const stmt = db.prepare(`
        UPDATE clients SET
            nome=@nome,
            cpf=@cpf,
            rg=@rg,
            cnh=@cnh,
            endereco=@endereco,
            contato=@contato,
            email=@email,
            observacoes=@observacoes,
            updated_at=CURRENT_TIMESTAMP
        WHERE id=@id
    `);
    stmt.run({ ...req.body, id });
    const row = db.prepare("SELECT * FROM clients WHERE id = ?").get(id);
    res.json(row);
});

app.delete("/api/clients/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM clients WHERE id = ?").run(id);
    res.status(204).end();
});

const sendPage = (res, page) => {
    res.sendFile(path.join(staticPath, page));
};

app.get("/", (req, res) => {
    sendPage(res, "historico.html");
});

app.get("/historico.html", (req, res) => {
    sendPage(res, "historico.html");
});

app.get("/index.html", (req, res) => {
    sendPage(res, "index.html");
});

app.get("/clientes.html", (req, res) => {
    sendPage(res, "clientes.html");
});

app.get("/login.html", (req, res) => {
    sendPage(res, "login.html");
});

app.get("*", (req, res) => {
    sendPage(res, "historico.html");
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
