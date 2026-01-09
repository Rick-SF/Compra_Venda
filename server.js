const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const Database = require("better-sqlite3");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

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
        nacionalidade TEXT,
        estadoCivil TEXT,
        profissao TEXT,
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
    combustivel TEXT,
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
ensureColumn("clients", "nacionalidade", "TEXT");
ensureColumn("clients", "estadoCivil", "TEXT");
ensureColumn("clients", "profissao", "TEXT");
ensureColumn("operations", "combustivel", "TEXT");

app.use(cors());
app.use(express.json());

const staticPath = path.join(__dirname);
app.use(express.static(staticPath));

const mapOperationRow = (row) => ({
    ...row,
    valorCompra: row.valorCompra ?? 0,
    valorVenda: row.valorVenda ?? 0,
    custosExtras: row.custosExtras ?? 0,
    combustivel: row.combustivel || "",
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
            codigoCRVe, codigoCLAe, combustivel, codigoATPVe, valorCompra, valorVenda,
            custosExtras, observacoes
        ) VALUES (
            @id, @tipo, @data, @veiculo, @marca, @modelo, @cor, @anoFabricacao, @anoModelo,
            @placa, @cidade, @uf, @parceiro, @contato, @chassi, @renavan,
            @codigoCRVe, @codigoCLAe, @combustivel, @codigoATPVe, @valorCompra, @valorVenda,
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
            combustivel=@combustivel,
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
            id, nome, cpf, rg, cnh, endereco,
            nacionalidade, estadoCivil, profissao,
            contato, email, observacoes
        ) VALUES (
            @id, @nome, @cpf, @rg, @cnh, @endereco,
            @nacionalidade, @estadoCivil, @profissao,
            @contato, @email, @observacoes
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
            nacionalidade=@nacionalidade,
            estadoCivil=@estadoCivil,
            profissao=@profissao,
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

app.post("/api/contracts/generate", (req, res) => {
    try {
        const {
            operationId,
            clientId,
            installments: rawInstallments,
            paymentType: rawPaymentType,
            entryValue: rawEntryValue,
        } = req.body || {};
        if (!operationId || !clientId) {
            return res
                .status(400)
                .json({ message: "Venda e cliente são obrigatórios." });
        }
        const operation = db
            .prepare("SELECT * FROM operations WHERE id = ? AND tipo = 'Venda'")
            .get(operationId);
        if (!operation) {
            return res.status(404).json({ message: "Venda não encontrada." });
        }
        const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(clientId);
        if (!client) {
            return res.status(404).json({ message: "Cliente não encontrado." });
        }
        const saleValue = Number(operation.valorVenda) || 0;
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
        const paymentClause =
            paymentType === "parcelado"
                ? `${
                      entryValue > 0
                          ? `com um valor de entrada equivalente a ${formatCurrencyBR(
                                entryValue
                            )}, e `
                          : ""
                  }em ${installments} parcela(s) mensal(is), igual(is) e sucessiva(s) de ${formatCurrencyBR(
                      installmentValue
                  )} (${numberToCurrencyWords(
                      installmentValue
                  )}), a ser(em) paga(s) até o dia (inserir dia) de cada mês, ou dia útil seguinte, vencendo a primeira em (data) e a última em (data).`
                : "na forma de pagamento à vista.";

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
        console.error(error);
        if (!res.headersSent) {
            res.status(500).json({ message: "Erro ao gerar contrato." });
        }
    }
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
    sendPage(res, "historico.html");
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
