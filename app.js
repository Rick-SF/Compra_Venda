const STORAGE_KEY = "veiculos-transactions";

const currency = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
});

const state = {
    transactions: [],
};

const createId = () =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const elements = {
    purchaseForm: document.getElementById("purchase-form"),
    saleForm: document.getElementById("sale-form"),
    tableBody: document.getElementById("transactions-body"),
    summary: {
        invested: document.querySelector("[data-summary='invested']"),
        sold: document.querySelector("[data-summary='sold']"),
        profit: document.querySelector("[data-summary='profit']"),
        count: document.querySelector("[data-summary='count']"),
    },
};

const getStorage = () => {
    try {
        return typeof window !== "undefined" && window.localStorage
            ? window.localStorage
            : null;
    } catch {
        return null;
    }
};

const loadTransactions = () => {
    const storage = getStorage();
    if (!storage) return [];
    try {
        const raw = storage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const persistTransactions = () => {
    const storage = getStorage();
    if (!storage) return;
    try {
        storage.setItem(STORAGE_KEY, JSON.stringify(state.transactions));
    } catch {
        // Ignora erros de armazenamento (sem suporte ou sem espaço).
    }
};

const toNumber = (value) => Number(value) || 0;
const formatCurrency = (value) => currency.format(value || 0);
const formatDate = (isoDate) =>
    isoDate ? new Intl.DateTimeFormat("pt-BR").format(new Date(isoDate)) : "—";

const calculateProfit = (record) => {
    if (record.tipo !== "Venda") return null;
    const cost = (record.valorCompra || 0) + (record.custosExtras || 0);
    return record.valorVenda - cost;
};

const addTransaction = (record) => {
    state.transactions.unshift(record);
    persistTransactions();
    renderTransactions();
    updateSummary();
};

const removeTransaction = (id) => {
    state.transactions = state.transactions.filter((item) => item.id !== id);
    persistTransactions();
    renderTransactions();
    updateSummary();
};

const handlePurchaseSubmit = (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const record = {
        id: createId(),
        tipo: "Compra",
        data: data.get("data"),
        modelo: data.get("modelo")?.trim(),
        placa: data.get("placa")?.toUpperCase().replace(/[^A-Z0-9]/g, "") || "",
        parceiro: data.get("parceiro")?.trim(),
        ano: data.get("ano")?.trim(),
        contato: "",
        valorCompra: toNumber(data.get("valorCompra")),
        valorVenda: 0,
        custosExtras: toNumber(data.get("custosExtras")),
        observacoes: data.get("observacoes")?.trim(),
    };
    addTransaction(record);
    event.currentTarget.reset();
};

const handleSaleSubmit = (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const record = {
        id: createId(),
        tipo: "Venda",
        data: data.get("data"),
        modelo: data.get("modelo")?.trim(),
        placa: data.get("placa")?.toUpperCase().replace(/[^A-Z0-9]/g, "") || "",
        parceiro: data.get("parceiro")?.trim(),
        contato: data.get("contato")?.trim(),
        valorCompra: toNumber(data.get("valorCompra")),
        valorVenda: toNumber(data.get("valorVenda")),
        custosExtras: toNumber(data.get("custosExtras")),
        observacoes: data.get("observacoes")?.trim(),
    };
    addTransaction(record);
    event.currentTarget.reset();
};

const renderTransactions = () => {
    const tbody = elements.tableBody;
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!state.transactions.length) {
        tbody.innerHTML =
            '<tr class="placeholder"><td colspan="10">Nenhuma operação cadastrada ainda.</td></tr>';
        return;
    }

    state.transactions.forEach((record) => {
        const tr = document.createElement("tr");
        if (record.observacoes) {
            tr.title = record.observacoes;
        }

        const lucro = calculateProfit(record);
        const typeClass = record.tipo === "Venda" ? "tag-sale" : "tag-purchase";
        const profitClass =
            typeof lucro === "number"
                ? lucro >= 0
                    ? "profit-positive"
                    : "profit-negative"
                : "";

        tr.innerHTML = `
            <td>${formatDate(record.data)}</td>
            <td><span class="tag ${typeClass}">${record.tipo}</span></td>
            <td>${record.modelo || "—"} ${
            record.ano ? `<span class="muted-text">${record.ano}</span>` : ""
        }</td>
            <td>${record.placa || "—"}</td>
            <td>
                ${record.parceiro || "—"}
                ${
                    record.contato
                        ? `<span class="contact">${record.contato}</span>`
                        : ""
                }
            </td>
            <td>${record.valorCompra ? formatCurrency(record.valorCompra) : "—"}</td>
            <td>${record.valorVenda ? formatCurrency(record.valorVenda) : "—"}</td>
            <td>
                <span class="profit ${profitClass}">
                    ${
                        typeof lucro === "number"
                            ? formatCurrency(lucro)
                            : "—"
                    }
                </span>
            </td>
            <td>
                <span class="notes">${record.observacoes || "—"}</span>
            </td>
            <td class="actions-cell">
                <button class="table-button" data-action="delete" data-id="${record.id}">
                    Excluir
                </button>
            </td>
        `;

        tbody.appendChild(tr);
    });
};

const updateSummary = () => {
    const totals = state.transactions.reduce(
        (acc, record) => {
            if (record.tipo === "Compra") {
                acc.invested += record.valorCompra + record.custosExtras;
            }
            if (record.tipo === "Venda") {
                acc.sold += record.valorVenda;
                acc.profit += calculateProfit(record) || 0;
            }
            return acc;
        },
        {
            invested: 0,
            sold: 0,
            profit: 0,
        }
    );

    elements.summary.invested.textContent = formatCurrency(totals.invested);
    elements.summary.sold.textContent = formatCurrency(totals.sold);
    elements.summary.profit.textContent = formatCurrency(totals.profit);
    elements.summary.count.textContent = state.transactions.length.toString();
};

const init = () => {
    state.transactions = loadTransactions().map((record) =>
        record.id ? record : { ...record, id: createId() }
    );
    if (state.transactions.length) {
        persistTransactions();
    }
    if (elements.purchaseForm) {
        elements.purchaseForm.addEventListener("submit", handlePurchaseSubmit);
    }
    if (elements.saleForm) {
        elements.saleForm.addEventListener("submit", handleSaleSubmit);
    }
    if (elements.tableBody) {
        elements.tableBody.addEventListener("click", (event) => {
            const button = event.target.closest("[data-action='delete']");
            if (!button) return;
            const { id } = button.dataset;
            if (!id) return;
            const confirmed = window.confirm(
                "Deseja remover este registro? Essa ação não pode ser desfeita."
            );
            if (!confirmed) return;
            removeTransaction(id);
        });
    }
    renderTransactions();
    updateSummary();
};

document.addEventListener("DOMContentLoaded", init);
