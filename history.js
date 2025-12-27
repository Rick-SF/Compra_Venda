const API_OPERATIONS = "/api/operations";
const API_CLIENTS = "/api/clients";
const PENDING_EDIT_KEY = "veiculos-edit-pending";

const currency = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
});

const state = {
    transactions: [],
    clients: [],
    filters: {
        modelo: "",
        placa: "",
        comprador: "",
        dataInicio: "",
        dataFim: "",
    },
};

window.auth?.ensureAuth?.();

const elements = {
    filterForm: document.getElementById("history-filter"),
    tableBody: document.getElementById("history-body"),
    clientFilterSelect: document.querySelector("[data-select='history-client']"),
    summary: {
        invested: document.querySelector("[data-summary='invested']"),
        sold: document.querySelector("[data-summary='sold']"),
        profit: document.querySelector("[data-summary='profit']"),
        count: document.querySelector("[data-summary='count']"),
    },
    resultText: document.querySelector("[data-results-count]"),
    clearButton: document.getElementById("clear-filters"),
    confirmModal: {
        container: document.getElementById("confirm-modal"),
        message: document.getElementById("confirm-modal-message"),
        confirmBtn: document.querySelector("#confirm-modal [data-confirm='true']"),
        cancelBtn: document.querySelector("#confirm-modal [data-confirm='false']"),
        closeBtn: document.querySelector("[data-close-confirm]"),
    },
};
let confirmCallback = null;
const toastElement = document.getElementById("toast");
let toastTimeout = null;

const jsonRequest = async (url, options = {}) => {
    const response = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...options,
    });
    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Erro ao comunicar com o servidor.");
    }
    if (response.status === 204) return null;
    return response.json();
};

const loadTransactions = () => jsonRequest(API_OPERATIONS);
const loadClients = () => jsonRequest(API_CLIENTS);

const createId = () =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const formatCurrency = (value) => currency.format(value || 0);
const normalizeText = (value) => value?.toString().trim().toLowerCase() || "";
const normalizePlate = (value) =>
    value?.toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || "";
const vehicleFields = [
    "veiculo",
    "marca",
    "cor",
    "anoFabricacao",
    "anoModelo",
    "cidade",
    "uf",
    "chassi",
    "renavan",
    "codigoCRVe",
    "codigoCLAe",
    "codigoATPVe",
];
const ensureVehicleFields = (record = {}) => {
    const normalized = { ...record };
    vehicleFields.forEach((field) => {
        if (
            typeof normalized[field] === "undefined" ||
            normalized[field] === null
        ) {
            normalized[field] = "";
        }
    });
    return normalized;
};

const normalizeISODate = (value) => {
    if (!value) return "";
    if (value.includes("/")) {
        const [day, month, year] = value.split("/");
        if (!year || !month || !day) return "";
        return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
    const [year, month, day] = value.split("-");
    if (!year || !month || !day) return "";
    return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

const formatDate = (value) => {
    const isoDate = normalizeISODate(value);
    if (!isoDate) return "—";
    const [year, month, day] = isoDate.split("-");
    return `${day}/${month}/${year}`;
};

const calculateProfit = (record) => {
    if (record.tipo !== "Venda") return null;
    const cost = (record.valorCompra || 0) + (record.custosExtras || 0);
    return record.valorVenda - cost;
};

const applyFilters = () => {
    const { modelo, placa, comprador, dataInicio, dataFim } = state.filters;
    const startValue = normalizeISODate(dataInicio);
    const endValue = normalizeISODate(dataFim);

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
        const recordDateValue = normalizeISODate(record.data);
        if ((startValue || endValue) && !recordDateValue) {
            return false;
        }
        const matchStart = startValue ? recordDateValue >= startValue : true;
        const matchEnd = endValue ? recordDateValue <= endValue : true;
        return matchModel && matchPlate && matchBuyer && matchStart && matchEnd;
    });
};

const renderTable = (records) => {
    const tbody = elements.tableBody;
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!records.length) {
        tbody.innerHTML =
            '<tr class="placeholder"><td colspan="22">Nenhuma operação encontrada para o filtro informado.</td></tr>';
        return;
    }

    records.forEach((record) => {
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
            <td>${record.veiculo || "—"}</td>
            <td>${record.marca || "—"}</td>
            <td>${record.modelo || "—"}</td>
            <td>${record.cor || "—"}</td>
            <td>${record.anoFabricacao || "—"}</td>
            <td>${record.anoModelo || "—"}</td>
            <td>${record.cidade || "—"}</td>
            <td>${record.uf || "—"}</td>
            <td>${record.placa || "—"}</td>
            <td>
                ${record.parceiro || "—"}
                ${
                    record.contato
                        ? `<span class="contact">${record.contato}</span>`
                        : ""
                }
            </td>
            <td>${record.chassi || "—"}</td>
            <td>${record.renavan || "—"}</td>
            <td>${record.codigoCRVe || "—"}</td>
            <td>${record.codigoCLAe || "—"}</td>
            <td>${record.codigoATPVe || "—"}</td>
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
                <button class="table-button edit" data-action="edit" data-id="${record.id}">
                    Editar
                </button>
                <button class="table-button delete" data-action="delete" data-id="${record.id}">
                    Excluir
                </button>
            </td>
        `;

        tbody.appendChild(tr);
    });
};

const openConfirm = (message, callback) => {
    const modal = elements.confirmModal;
    if (!modal.container || !modal.message) return;
    modal.message.textContent = message;
    modal.container.classList.add("visible");
    document.body.style.overflow = "hidden";
    confirmCallback = callback;
};

const closeConfirm = () => {
    const modal = elements.confirmModal;
    if (!modal.container) return;
    modal.container.classList.remove("visible");
    document.body.style.overflow = "";
    confirmCallback = null;
};

elements.confirmModal?.confirmBtn?.addEventListener("click", () => {
    if (confirmCallback) confirmCallback();
    closeConfirm();
});
elements.confirmModal?.cancelBtn?.addEventListener("click", closeConfirm);
elements.confirmModal?.closeBtn?.addEventListener("click", closeConfirm);
elements.confirmModal?.container?.addEventListener("click", (event) => {
    if (event.target === elements.confirmModal.container) closeConfirm();
});
document.addEventListener("keydown", (event) => {
    if (
        event.key === "Escape" &&
        elements.confirmModal.container?.classList.contains("visible")
    ) {
        closeConfirm();
    }
});

const showToast = (message, variant = "success") => {
    if (!toastElement) return;
    toastElement.textContent = message;
    toastElement.classList.remove("toast-error");
    if (variant === "error") {
        toastElement.classList.add("toast-error");
    }
    toastElement.classList.add("visible");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toastElement.classList.remove("visible");
    }, 2500);
};

const updateSummary = (records) => {
    const totals = records.reduce(
        (acc, record) => {
            if (record.tipo === "Compra") {
                acc.invested += record.valorCompra || 0;
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
    } else if (target.type === "date") {
        state.filters[target.name] = target.value;
    } else {
        state.filters[target.name] = normalizeText(target.value);
    }
    render();
};

const clearFilters = () => {
    state.filters = {
        modelo: "",
        placa: "",
        comprador: "",
        dataInicio: "",
        dataFim: "",
    };
    if (elements.filterForm) {
        elements.filterForm.reset();
    }
    render();
};

const handleTableClick = (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const { id, action } = button.dataset;
    if (!id) return;
    if (action === "delete") {
        openConfirm("Deseja remover este registro? Essa ação não pode ser desfeita.", () => {
            state.transactions = state.transactions.filter(
                (item) => item.id !== id
            );
            persistTransactions();
            render();
            showToast("Operação excluída com sucesso.");
        });
    } else if (action === "edit") {
        localStorage.setItem(PENDING_EDIT_KEY, id);
        window.location.href = "index.html";
    }
};

const init = async () => {
    try {
        const clients = await loadClients();
        state.clients = Array.isArray(clients) ? clients : [];
        populateClientFilter();
    } catch (error) {
        console.error(error);
        state.clients = [];
    }
    try {
        const data = await loadTransactions();
        state.transactions = Array.isArray(data)
            ? data.map((entry) => ensureVehicleFields(entry))
            : [];
    } catch (error) {
        console.error(error);
        showToast("Erro ao carregar histórico.", "error");
    }
    if (elements.filterForm) {
        elements.filterForm.addEventListener("input", handleFilterInput);
    }
    if (elements.clearButton) {
        elements.clearButton.addEventListener("click", clearFilters);
    }
    if (elements.tableBody) {
        elements.tableBody.addEventListener("click", handleTableClick);
    }
    render();
};

document.addEventListener("DOMContentLoaded", init);
const populateClientFilter = () => {
    const select = elements.clientFilterSelect;
    if (!select) return;
    select.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Todos os clientes/fornecedores";
    select.appendChild(placeholder);

    if (!state.clients.length) {
        select.disabled = true;
        return;
    }
    select.disabled = false;
    state.clients.forEach((client) => {
        const option = document.createElement("option");
        option.value = client.nome || "";
        option.textContent = client.nome || "Cliente sem nome";
        select.appendChild(option);
    });
};
