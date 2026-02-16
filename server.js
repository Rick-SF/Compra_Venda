const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mysql = require("mysql2/promise");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const DB_CONFIG = {
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "vendaveiculos",
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONN_LIMIT || 10),
    charset: "utf8mb4_unicode_ci",
};

let pool;

const ensureDatabaseExists = async () => {
    const { database, ...connectionConfig } = DB_CONFIG;
    const connection = await mysql.createConnection(connectionConfig);
    await connection.query(
        `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await connection.end();
};

const query = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
};

const execute = (sql, params = []) => pool.execute(sql, params);

const createTables = async () => {
    await execute(`
        CREATE TABLE IF NOT EXISTS clients (
            id VARCHAR(64) PRIMARY KEY,
            nome VARCHAR(255) NOT NULL,
            cpf VARCHAR(32),
            rg VARCHAR(32),
            cnh VARCHAR(32),
            endereco VARCHAR(255),
            nacionalidade VARCHAR(100),
            estadoCivil VARCHAR(100),
            profissao VARCHAR(150),
            contato VARCHAR(100),
            email VARCHAR(150),
            observacoes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await execute(`
        CREATE TABLE IF NOT EXISTS operations (
            id VARCHAR(64) PRIMARY KEY,
            tipo VARCHAR(20) NOT NULL,
            data DATE,
            veiculo VARCHAR(255),
            marca VARCHAR(255),
            modelo VARCHAR(255),
            cor VARCHAR(100),
            anoFabricacao VARCHAR(10),
            anoModelo VARCHAR(10),
            placa VARCHAR(16),
            cidade VARCHAR(120),
            uf VARCHAR(4),
            clientId VARCHAR(64),
            parceiro VARCHAR(255),
            contato VARCHAR(100),
            chassi VARCHAR(120),
            renavan VARCHAR(120),
            codigoCRVe VARCHAR(120),
            codigoCLAe VARCHAR(120),
            combustivel VARCHAR(60),
            quilometragem VARCHAR(60),
            codigoATPVe VARCHAR(120),
            valorCompra DECIMAL(15,2) DEFAULT 0,
            valorVenda DECIMAL(15,2) DEFAULT 0,
            custosExtras DECIMAL(15,2) DEFAULT 0,
            observacoes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
};

const ensureColumn = async (table, column, definition) => {
    const rows = await query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [DB_CONFIG.database, table, column]
    );
    if (!rows.length) {
        await execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
};

const initDatabase = async () => {
    await ensureDatabaseExists();
    pool = mysql.createPool(DB_CONFIG);
    await createTables();
    await ensureColumn("clients", "nacionalidade", "VARCHAR(100)");
    await ensureColumn("clients", "estadoCivil", "VARCHAR(100)");
    await ensureColumn("clients", "profissao", "VARCHAR(150)");
    await ensureColumn("clients", "observacoes", "TEXT");
    await ensureColumn("operations", "clientId", "VARCHAR(64)");
    await ensureColumn("operations", "combustivel", "VARCHAR(60)");
    await ensureColumn("operations", "quilometragem", "VARCHAR(60)");
};

app.use(cors());
app.use(express.json());

const staticPath = path.join(__dirname);
app.use(express.static(staticPath));

const numericOrZero = (value) =>
    value === null || typeof value === "undefined" ? 0 : Number(value) || 0;

const mapOperationRow = (row) => ({
    ...row,
    valorCompra: numericOrZero(row.valorCompra),
    valorVenda: numericOrZero(row.valorVenda),
    custosExtras: numericOrZero(row.custosExtras),
    combustivel: row.combustivel || "",
    quilometragem: row.quilometragem || "",
});

const formatCurrencyBR = (value) =>
    new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(value || 0);

const formatDateBR = (value) => {
    if (!value) return "-";
    const asDate = new Date(value);
    if (!Number.isNaN(asDate.getTime())) {
        return asDate.toLocaleDateString("pt-BR");
    }
    if (value.includes("-")) {
        const [year, month, day] = value.split("-");
        if (year && month && day) {
            return `${day}/${month}/${year}`;
        }
    }
    return value;
};

const SELLER_INFO = {
    name: process.env.SELLER_NAME || "Revenda de Veículos",
    document: process.env.SELLER_DOCUMENT || "Documento não informado",
    address: process.env.SELLER_ADDRESS || "Endereço não informado",
    city: process.env.SELLER_CITY || "",
};
const MAX_INSTALLMENTS = 20;
const CONTRACT_TEMPLATE_PATH = path.join(
    __dirname,
    "logo e doc",
    "Contrato de compra venda.docx"
);
const UNITS = [
    "",
    "um",
    "dois",
    "tres",
    "quatro",
    "cinco",
    "seis",
    "sete",
    "oito",
    "nove",
];
const TEENS = [
    "dez",
    "onze",
    "doze",
    "treze",
    "catorze",
    "quinze",
    "dezesseis",
    "dezessete",
    "dezoito",
    "dezenove",
];
const TENS = [
    "",
    "",
    "vinte",
    "trinta",
    "quarenta",
    "cinquenta",
    "sessenta",
    "setenta",
    "oitenta",
    "noventa",
];
const HUNDREDS = [
    "",
    "cento",
    "duzentos",
    "trezentos",
    "quatrocentos",
    "quinhentos",
    "seiscentos",
    "setecentos",
    "oitocentos",
    "novecentos",
];
const SCALE = [
    { singular: "", plural: "" },
    { singular: "mil", plural: "mil" },
    { singular: "milhao", plural: "milhoes" },
    { singular: "bilhao", plural: "bilhoes" },
    { singular: "trilhao", plural: "trilhoes" },
];
const formatLabeledInfo = (label, value) => {
    const normalized =
        typeof value === "number"
            ? value.toString()
            : (value || "").toString().trim();
    return `${label}: ${normalized || "—"}`;
};
const formatCurrencyInfo = (label, value) =>
    `${label}: ${formatCurrencyBR(value || 0)}`;
const chunkToWords = (number) => {
    if (number === 0) return "";
    if (number === 100) return "cem";
    const hundred = Math.floor(number / 100);
    const remainder = number % 100;
    const parts = [];
    if (hundred) {
        parts.push(HUNDREDS[hundred]);
    }
    if (remainder) {
        if (remainder < 10) {
            parts.push(UNITS[remainder]);
        } else if (remainder < 20) {
            parts.push(TEENS[remainder - 10]);
        } else {
            const tens = Math.floor(remainder / 10);
            const units = remainder % 10;
            if (units) {
                parts.push(`${TENS[tens]} e ${UNITS[units]}`);
            } else {
                parts.push(TENS[tens]);
            }
        }
    }
    return parts.join(" e ");
};
const joinSegments = (segments) => {
    if (!segments.length) return "";
    return segments.reduce((acc, segment, index) => {
        if (!acc) return segment;
        const isLast = index === segments.length - 1;
        return `${acc}${isLast ? " e " : " "}${segment}`;
    }, "");
};
const numberToWords = (value) => {
    if (value === 0) return "zero";
    const segments = [];
    let remaining = value;
    let scaleIndex = 0;
    while (remaining > 0) {
        const chunk = remaining % 1000;
        if (chunk) {
            let chunkWords = chunkToWords(chunk);
            if (scaleIndex === 1) {
                chunkWords =
                    chunk === 1 ? "mil" : `${chunkWords} mil`;
            } else if (scaleIndex > 1) {
                const scaleWord =
                    chunk === 1
                        ? SCALE[scaleIndex].singular
                        : SCALE[scaleIndex].plural;
                chunkWords = `${chunkWords} ${scaleWord}`;
            }
            segments.unshift(chunkWords);
        }
        remaining = Math.floor(remaining / 1000);
        scaleIndex += 1;
    }
    return joinSegments(segments);
};
const numberToCurrencyWords = (value) => {
    const normalized = Math.round(Math.abs(Number(value) || 0) * 100);
    const integer = Math.floor(normalized / 100);
    const cents = normalized % 100;
    const integerText =
        integer === 0
            ? ""
            : `${numberToWords(integer)} ${
                  integer === 1 ? "real" : "reais"
              }`;
    const centsText =
        cents === 0
            ? ""
            : `${numberToWords(cents)} ${
                  cents === 1 ? "centavo" : "centavos"
              }`;
    let result;
    if (integerText && centsText) {
        result = `${integerText} e ${centsText}`;
    } else {
        result = integerText || centsText || "zero real";
    }
    if (value < 0) {
        result = `menos ${result}`;
    }
    return result;
};
const clampInstallments = (value) =>
    Math.min(Math.max(parseInt(value, 10) || 1, 1), MAX_INSTALLMENTS);
const onlyDigits = (value = "") => value.toString().replace(/\D/g, "");
const formatCpf = (value) => {
    const digits = onlyDigits(value);
    if (digits.length !== 11) return value || "";
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(
        6,
        9
    )}-${digits.slice(9)}`;
};
const formatRg = (value) => {
    const digits = onlyDigits(value);
    if (digits.length < 8) return value || "";
    const body = digits.slice(0, digits.length - 1);
    const check = digits.slice(-1);
    return `${body.slice(0, 2)}.${body.slice(2, 5)}.${body.slice(
        5
    )}-${check}`;
};
const formatCnh = (value) => {
    const digits = onlyDigits(value);
    if (digits.length !== 11) return value || "";
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(
        6,
        9
    )}-${digits.slice(9)}`;
};

const OPERATION_COLUMNS = [
    "id",
    "tipo",
    "data",
    "veiculo",
    "marca",
    "modelo",
    "cor",
    "anoFabricacao",
    "anoModelo",
    "placa",
    "cidade",
    "uf",
    "clientId",
    "parceiro",
    "contato",
    "chassi",
    "renavan",
    "codigoCRVe",
    "codigoCLAe",
    "combustivel",
    "quilometragem",
    "codigoATPVe",
    "valorCompra",
    "valorVenda",
    "custosExtras",
    "observacoes",
];

const CLIENT_COLUMNS = [
    "id",
    "nome",
    "cpf",
    "rg",
    "cnh",
    "endereco",
    "nacionalidade",
    "estadoCivil",
    "profissao",
    "contato",
    "email",
    "observacoes",
];

const handleError = (res, error, message = "Erro interno do servidor.") => {
    console.error(error);
    if (!res.headersSent) {
        res.status(500).json({ message });
    }
};

app.get("/api/operations", async (req, res) => {
    try {
        const rows = await query("SELECT * FROM operations ORDER BY created_at DESC");
        res.json(rows.map(mapOperationRow));
    } catch (error) {
        handleError(res, error, "Erro ao carregar operações.");
    }
});

app.post("/api/operations", async (req, res) => {
    try {
        const record = req.body || {};
        if (!record.id) {
            return res.status(400).json({ message: "ID é obrigatório." });
        }
        const placeholders = OPERATION_COLUMNS.map(() => "?").join(",");
        await execute(
            `INSERT INTO operations (${OPERATION_COLUMNS.join(",")}) VALUES (${placeholders})`,
            OPERATION_COLUMNS.map((column) => record[column] ?? null)
        );
        const rows = await query("SELECT * FROM operations WHERE id = ?", [record.id]);
        res.status(201).json(mapOperationRow(rows[0]));
    } catch (error) {
        handleError(res, error, "Erro ao salvar operação.");
    }
});

app.put("/api/operations/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const columns = OPERATION_COLUMNS.filter((column) => column !== "id");
        const setClause = columns.map((column) => `${column} = ?`).join(", ");
        const params = columns.map((column) => (req.body || {})[column] ?? null);
        params.push(id);
        await execute(
            `UPDATE operations SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            params
        );
        const rows = await query("SELECT * FROM operations WHERE id = ?", [id]);
        if (!rows.length) {
            return res.status(404).json({ message: "Operação não encontrada." });
        }
        res.json(mapOperationRow(rows[0]));
    } catch (error) {
        handleError(res, error, "Erro ao atualizar operação.");
    }
});

app.delete("/api/operations/:id", async (req, res) => {
    try {
        await execute("DELETE FROM operations WHERE id = ?", [req.params.id]);
        res.status(204).end();
    } catch (error) {
        handleError(res, error, "Erro ao excluir operação.");
    }
});

app.get("/api/clients", async (req, res) => {
    try {
        const rows = await query("SELECT * FROM clients ORDER BY created_at DESC");
        res.json(rows);
    } catch (error) {
        handleError(res, error, "Erro ao carregar clientes.");
    }
});

app.post("/api/clients", async (req, res) => {
    try {
        const client = req.body || {};
        if (!client.id) {
            return res.status(400).json({ message: "ID é obrigatório." });
        }
        const placeholders = CLIENT_COLUMNS.map(() => "?").join(",");
        await execute(
            `INSERT INTO clients (${CLIENT_COLUMNS.join(",")}) VALUES (${placeholders})`,
            CLIENT_COLUMNS.map((column) => client[column] ?? null)
        );
        const rows = await query("SELECT * FROM clients WHERE id = ?", [client.id]);
        res.status(201).json(rows[0]);
    } catch (error) {
        handleError(res, error, "Erro ao cadastrar cliente.");
    }
});

app.put("/api/clients/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const columns = CLIENT_COLUMNS.filter((column) => column !== "id");
        const setClause = columns.map((column) => `${column} = ?`).join(", ");
        const params = columns.map((column) => (req.body || {})[column] ?? null);
        params.push(id);
        await execute(
            `UPDATE clients SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            params
        );
        const rows = await query("SELECT * FROM clients WHERE id = ?", [id]);
        if (!rows.length) {
            return res.status(404).json({ message: "Cliente não encontrado." });
        }
        res.json(rows[0]);
    } catch (error) {
        handleError(res, error, "Erro ao atualizar cliente.");
    }
});

app.delete("/api/clients/:id", async (req, res) => {
    try {
        await execute("DELETE FROM clients WHERE id = ?", [req.params.id]);
        res.status(204).end();
    } catch (error) {
        handleError(res, error, "Erro ao excluir cliente.");
    }
});

app.post("/api/contracts/generate", async (req, res) => {
    try {
        const {
            operationId,
            clientId,
            installments: rawInstallments,
            paymentType: rawPaymentType,
            entryValue: rawEntryValue,
            dueDay: rawDueDay,
            firstDueDate,
            lastDueDate,
            witness1Name,
            witness1Cpf,
            witness2Name,
            witness2Cpf,
        } = req.body || {};
        if (!operationId || !clientId) {
            return res
                .status(400)
                .json({ message: "Venda e cliente são obrigatórios." });
        }
        const operationRows = await query(
            "SELECT * FROM operations WHERE id = ? AND tipo = 'Venda'",
            [operationId]
        );
        const operation = operationRows[0];
        if (!operation) {
            return res.status(404).json({ message: "Venda não encontrada." });
        }
        const clientRows = await query("SELECT * FROM clients WHERE id = ?", [clientId]);
        const client = clientRows[0];
        if (!client) {
            return res.status(404).json({ message: "Cliente não encontrado." });
        }
        const saleValue = numericOrZero(operation.valorVenda);
        const paymentType =
            typeof rawPaymentType === "string" &&
            rawPaymentType.toLowerCase() === "parcelado"
                ? "parcelado"
                : "vista";
        let installments = clampInstallments(rawInstallments);
        let entryValue = saleValue;
        let financedValue = 0;
        let installmentValue = saleValue;

        if (paymentType === "parcelado") {
            entryValue = Math.min(
                Math.max(Number(rawEntryValue) || 0, 0),
                saleValue
            );
            financedValue = Math.max(saleValue - entryValue, 0);
            installments = clampInstallments(rawInstallments);
            installmentValue =
                installments > 0 ? financedValue / installments : financedValue;
        } else {
            installments = 1;
            entryValue = saleValue;
            financedValue = 0;
            installmentValue = saleValue;
        }
        const dueDayValue = Number(rawDueDay);
        const dueDayText =
            Number.isFinite(dueDayValue) && dueDayValue >= 1 && dueDayValue <= 31
                ? `dia ${String(dueDayValue).padStart(2, "0")}`
                : "dia a definir";
        const firstDueText = firstDueDate
            ? formatDateBR(firstDueDate)
            : "data a definir";
        const lastDueText = lastDueDate
            ? formatDateBR(lastDueDate)
            : "data a definir";
        const paymentClause =
            paymentType === "parcelado"
                ? `${entryValue > 0 ? `com um valor de entrada equivalente a ${formatCurrencyBR(entryValue)}, e ` : ""}em ${installments} parcela(s) mensal(is), igual(is) e sucessiva(s) de ${formatCurrencyBR(installmentValue)} (${numberToCurrencyWords(installmentValue)}), a ser(em) paga(s) até o ${dueDayText} de cada mês, ou dia útil seguinte, vencendo a primeira em ${firstDueText} e a última em ${lastDueText}.`
                : "na forma de pagamento à vista.";
        const safeWitness1Name = (witness1Name || "").toString().trim();
        const safeWitness2Name = (witness2Name || "").toString().trim();
        const safeWitness1Cpf = witness1Cpf || "";
        const safeWitness2Cpf = witness2Cpf || "";
        const witnessTemplateData = {
            testemunha1_nome: safeWitness1Name,
            testemunha1_cpf: formatCpf(safeWitness1Cpf),
            testemunha_1_nome: safeWitness1Name,
            testemunha_1_cpf: formatCpf(safeWitness1Cpf),
            nome_testemunha1: safeWitness1Name,
            cpf_testemunha1: formatCpf(safeWitness1Cpf),
            nome_testemunha_1: safeWitness1Name,
            cpf_testemunha_1: formatCpf(safeWitness1Cpf),
            testemunha2_nome: safeWitness2Name,
            testemunha2_cpf: formatCpf(safeWitness2Cpf),
            testemunha_2_nome: safeWitness2Name,
            testemunha_2_cpf: formatCpf(safeWitness2Cpf),
            nome_testemunha2: safeWitness2Name,
            cpf_testemunha2: formatCpf(safeWitness2Cpf),
            nome_testemunha_2: safeWitness2Name,
            cpf_testemunha_2: formatCpf(safeWitness2Cpf),
        };

        let templateBinary;
        try {
            templateBinary = fs.readFileSync(CONTRACT_TEMPLATE_PATH, "binary");
        } catch {
            return res
                .status(500)
                .json({ message: "Arquivo de contrato base não encontrado." });
        }

        let doc;
        try {
            const zip = new PizZip(templateBinary);
            doc = new Docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true,
                delimiters: { start: "{", end: "}" },
            });
        } catch (error) {
            console.error(error);
            return res
                .status(500)
                .json({ message: "Não foi possível carregar o contrato base." });
        }

        doc.setData({
            nome_comprador: client.nome || "",
            nacionalidade_comprador: client.nacionalidade || "",
            estado_civil_comprador: client.estadoCivil || "",
            profissao_comprador: client.profissao || "",
            "profissão_comprador": client.profissao || "",
            cpf_comprador: formatCpf(client.cpf),
            rg_comprador: formatRg(client.rg),
            cnh_comprador: formatCnh(client.cnh),
            endereco_comprador: client.endereco || "",
            "endereço_comprador": client.endereco || "",
            contato_comprador: client.contato || "",
            email_comprador: client.email || "",
            observacoes_comprador: client.observacoes || "",
            quantidade_parcelas: `${installments}x`,
            valor_parcela: formatCurrencyBR(installmentValue),
            valor_parcelas: formatCurrencyBR(installmentValue),
            valor_total_venda: formatCurrencyBR(saleValue),
            valor_total_veiculo: formatCurrencyBR(saleValue),
            valor_total_extenso: `(${numberToCurrencyWords(saleValue)})`,
            valor_parcela_extenso: `(${numberToCurrencyWords(installmentValue)})`,
            valor_entrada: formatCurrencyBR(entryValue),
            valor_entrada_extenso: `(${numberToCurrencyWords(entryValue)})`,
            valor_restante: formatCurrencyBR(financedValue),
            valor_restante_extenso: `(${numberToCurrencyWords(financedValue)})`,
            tipo_pagamento:
                paymentType === "parcelado" ? "Parcelado" : "À vista",
            clausula_pagamento: paymentClause,
            tipo_veiculo: formatLabeledInfo("Tipo", operation.veiculo),
            marca_veiculo: formatLabeledInfo("Marca", operation.marca),
            modelo_veiculo: formatLabeledInfo(
                "Modelo",
                operation.modelo || operation.veiculo
            ),
            cor_veiculo: formatLabeledInfo("Cor", operation.cor),
            quilometragem_veiculo: formatLabeledInfo(
                "Quilometragem",
                operation.quilometragem
            ),
            ano_modelo_veiculo: formatLabeledInfo(
                "Ano do modelo",
                operation.anoModelo
            ),
            chassi_veiculo: formatLabeledInfo("Chassi", operation.chassi),
            renavam_veiculo: formatLabeledInfo("Renavam", operation.renavan),
            placa_veiculo: formatLabeledInfo("Placa", operation.placa),
            combustivel_veiculo: formatLabeledInfo(
                "Combustível",
                operation.combustivel
            ),
            ...witnessTemplateData,
        });

        try {
            doc.render();
        } catch (error) {
            console.error(error);
            return res
                .status(500)
                .json({ message: "Erro ao preencher o contrato." });
        }

        const buffer = doc.getZip().generate({ type: "nodebuffer" });
        const filename = `contrato-${operation.placa || "venda"}.docx`.replace(
            /\s+/g,
            "-"
        );

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        );
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.send(buffer);
    } catch (error) {
        handleError(res, error, "Erro ao gerar contrato.");
    }
});

const sendPage = (res, page) => {
    res.sendFile(path.join(staticPath, page));
};

app.get("/", (req, res) => {
    sendPage(res, "login.html");
});

app.get("/historico.html", (req, res) => {
    sendPage(res, "historico.html");
});

app.get("/index.html", (req, res) => {
    sendPage(res, "index.html");
});

app.get("/registrar-vendas.html", (req, res) => {
    sendPage(res, "registrar-vendas.html");
});

app.get("/clientes.html", (req, res) => {
    sendPage(res, "clientes.html");
});

app.get("/login.html", (req, res) => {
    sendPage(res, "login.html");
});

app.get("*", (req, res) => {
    sendPage(res, "login.html");
});

const startServer = async () => {
    try {
        await initDatabase();
        app.listen(PORT, () => {
            console.log(`Servidor rodando em http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Falha ao iniciar o servidor:", error);
        process.exit(1);
    }
};

startServer();
