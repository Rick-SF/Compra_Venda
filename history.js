const STORAGE_KEY = "veiculos-transactions";

const currency = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
});

const state = {
    transactions: [],
    filters: {
        modelo: "",
        placa: "",
        comprador: "",
    },
};

const elements = {
    filterForm: document.getElementById("history-filter"),
    tableBody: document.getElementById("history-body"),
    summary: {
        invested: document.querySelector("[data-summary='invested']"),
        sold: document.querySelector("[data-summary='sold']"),
        profit: document.querySelector("[data-summary='profit']"),
        count: document.querySelector("[data-summary='count']"),
    },
    resultText: document.querySelector("[data-results-count]"),
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

const createId = () =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const persistTransactions = () => {
    const storage = getStorage();
    if (!storage) return;
    try {
        storage.setItem(STORAGE_KEY, JSON.stringify(state.transactions));
    } catch {
        // Ignora falhas silenciosamente
    }
};

const formatCurrency = (value) => currency.format(value || 0);
const formatDate = (isoDate) =>
    isoDate ? new Intl.DateTimeFormat("pt-BR").format(new Date(isoDate)) : "—";

const calculateProfit = (record) => {
    if (record.tipo !== "Venda") return null;
    const cost = (record.valorCompra || 0) + (record.custosExtras || 0);
    return record.valorVenda - cost;
};

const normalizeText = (value) => value?.toString().trim().toLowerCase() || "";
const normalizePlate = (value) =>
    value?.toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || "";

const applyFilters = () => {
    const { modelo, placa, comprador } = state.filters;
    return state.transactions.filter((record) => {
        const matchModel = modelo
            ? (record.modelo || "").toLowerCase().includes(modelo)
            : true;
        const matchPlate = placa
            ? (record.placa || "")
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, "")
                  .includes(placa)
            : true;
        const matchBuyer = comprador
            ? (record.parceiro || "").toLowerCase().includes(comprador)
            : true;
        return matchModel && matchPlate && matchBuyer;
    });
};

const renderTable = (records) => {
    const tbody = elements.tableBody;
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!records.length) {
        tbody.innerHTML =
            '<tr class="placeholder"><td colspan="12">Nenhuma operação encontrada para o filtro informado.</td></tr>';
        return;
    }

    records.forEach((record) => {
        const tr = document.createElement("tr");
        if (record.observacoes) {
            tr.title = record.observacoes;
        }
        const lucro = calculateProfit(record);
        const totalInvestido =
            (record.valorCompra || 0) + (record.custosExtras || 0);
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
            <td>${record.modelo || "—"}</td>
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
            <td>${record.custosExtras ? formatCurrency(record.custosExtras) : "—"}</td>
            <td>${totalInvestido ? formatCurrency(totalInvestido) : "—"}</td>
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

const updateSummary = (records) => {
    const totals = records.reduce(
        (acc, record) => {
            if (record.tipo === "Compra") {
                acc.invested += (record.valorCompra || 0) + (record.custosExtras || 0);
            }
            if (record.tipo === "Venda") {
                acc.sold += record.valorVenda || 0;
                acc.profit += calculateProfit(record) || 0;
            }
            return acc;
        },
        { invested: 0, sold: 0, profit: 0 }
    );

    elements.summary.invested.textContent = formatCurrency(totals.invested);
    elements.summary.sold.textContent = formatCurrency(totals.sold);
    elements.summary.profit.textContent = formatCurrency(totals.profit);
    elements.summary.count.textContent = records.length.toString();
};

const updateResultText = (recordsLength) => {
    if (!elements.resultText) return;
    const total = state.transactions.length;
    elements.resultText.textContent = recordsLength
        ? `${recordsLength} de ${total} operação(ões) correspondem ao filtro.`
        : `Nenhuma operação encontrada entre ${total} registro(s).`;
};

const render = () => {
    const filtered = applyFilters();
    renderTable(filtered);
    updateSummary(filtered);
    updateResultText(filtered.length);
};

const handleFilterInput = (event) => {
    const target = event.target;
    if (!target?.name || !(target.name in state.filters)) return;
    if (target.name === "placa") {
        state.filters.placa = normalizePlate(target.value);
    } else {
        state.filters[target.name] = normalizeText(target.value);
    }
    render();
};

const handleTableClick = (event) => {
    const button = event.target.closest("[data-action='delete']");
    if (!button) return;
    const { id } = button.dataset;
    if (!id) return;
    const confirmed = window.confirm(
        "Deseja remover este registro? Essa ação não pode ser desfeita."
    );
    if (!confirmed) return;
    state.transactions = state.transactions.filter((item) => item.id !== id);
    persistTransactions();
    render();
};

const init = () => {
    state.transactions = loadTransactions().map((record) =>
        record.id ? record : { ...record, id: createId() }
    );
    if (state.transactions.length) {
        persistTransactions();
    }
    if (elements.filterForm) {
        elements.filterForm.addEventListener("input", handleFilterInput);
    }
    if (elements.tableBody) {
        elements.tableBody.addEventListener("click", handleTableClick);
    }
    render();
};

document.addEventListener("DOMContentLoaded", init);
