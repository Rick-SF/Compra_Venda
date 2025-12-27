const API_OPERATIONS = "/api/operations";
const API_CLIENTS = "/api/clients";
const PENDING_EDIT_KEY = "veiculos-edit-pending";

const currency = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
});
const percentage = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const state = {
    transactions: [],
    clients: [],
};

window.auth?.ensureAuth?.();

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

const createId = () =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const elements = {
    purchaseForm: document.getElementById("purchase-form"),
    saleForm: document.getElementById("sale-form"),
    saleClientSelect: document.querySelector("[data-select='sale-client']"),
    tableBody: document.getElementById("transactions-body"),
    summary: {
        invested: document.querySelector("[data-summary='invested']"),
        sold: document.querySelector("[data-summary='sold']"),
        profit: document.querySelector("[data-summary='profit']"),
        count: document.querySelector("[data-summary='count']"),
        profitPercent: document.querySelector("[data-summary='profit-percent']"),
    },
};
const operationModal = {
    container: document.getElementById("operation-modal"),
    title: document.getElementById("operation-modal-title"),
    form: document.getElementById("operation-modal-form"),
    closeButtons: document.querySelectorAll("[data-close-modal]"),
};
const operationModalState = { id: null, tipo: null };
const confirmModal = {
    container: document.getElementById("confirm-modal"),
    message: document.getElementById("confirm-modal-message"),
    confirmBtn: document.querySelector("#confirm-modal [data-confirm='true']"),
    cancelBtn: document.querySelector("#confirm-modal [data-confirm='false']"),
    closeBtn: document.querySelector("[data-close-confirm]"),
};
let confirmModalCallback = null;
const toastElement = document.getElementById("toast");
let toastTimeout = null;

const getStorage = () => {
    try {
        return typeof window !== "undefined" && window.localStorage
            ? window.localStorage
            : null;
    } catch {
        return null;
    }
};

const loadTransactionsFromApi = async () => {
    try {
        const data = await jsonRequest(API_OPERATIONS);
        state.transactions = Array.isArray(data) ? data : [];
    } catch (error) {
        console.error(error);
        showToast("Erro ao carregar operações.", "error");
    }
};

const loadClientsFromApi = async () => {
    try {
        const data = await jsonRequest(API_CLIENTS);
        state.clients = Array.isArray(data) ? data : [];
    } catch (error) {
        console.error(error);
        state.clients = [];
        showToast("Erro ao carregar clientes.", "error");
    } finally {
        populateSaleClientOptions();
    }
};

const populateSaleClientOptions = () => {
    const select = elements.saleClientSelect;
    if (!select) return;
    select.innerHTML = "";
    if (!state.clients.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Cadastre um cliente";
        select.appendChild(option);
        select.disabled = true;
        return;
    }
    select.disabled = false;
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Selecione um cliente";
    select.appendChild(placeholder);
    state.clients.forEach((client) => {
        const option = document.createElement("option");
        option.value = client.nome || "";
        option.textContent = client.nome || "Cliente sem nome";
        select.appendChild(option);
    });
};

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

const purchaseModalFields = [
    { name: "data", label: "Data da Compra", type: "date", required: true },
    { name: "veiculo", label: "Veículo", type: "text", required: true },
    { name: "marca", label: "Marca", type: "text", required: true },
    { name: "modelo", label: "Modelo", type: "text", required: true },
    { name: "cor", label: "Cor", type: "text" },
    { name: "anoFabricacao", label: "Ano de Fabricação", type: "number" },
    { name: "anoModelo", label: "Ano do Modelo", type: "number" },
    { name: "placa", label: "Placa", type: "text", required: true },
    { name: "cidade", label: "Cidade", type: "text" },
    { name: "uf", label: "UF", type: "text" },
    { name: "parceiro", label: "Origem / Fornecedor", type: "text" },
    { name: "chassi", label: "Chassi", type: "text" },
    { name: "renavan", label: "Renavam", type: "text" },
    { name: "codigoCRVe", label: "Código CRVe", type: "text" },
    { name: "codigoCLAe", label: "Código CLAe", type: "text" },
    { name: "valorCompra", label: "Valor da Compra (R$)", type: "number", required: true },
    { name: "custosExtras", label: "Custos Extras (R$)", type: "number" },
    { name: "observacoes", label: "Observações", type: "textarea" },
];

const saleModalFields = [
    { name: "data", label: "Data da Venda", type: "date", required: true },
    {
        name: "parceiro",
        label: "Comprador",
        type: "select",
        required: true,
        options: () =>
            state.clients.map((client) => ({
                value: client.nome || "",
                label: client.nome || "Cliente sem nome",
            })),
    },
    { name: "contato", label: "Contato", type: "text" },
    { name: "modelo", label: "Modelo / Versão", type: "text", required: true },
    { name: "placa", label: "Placa", type: "text", required: true },
    { name: "valorCompra", label: "Valor da Compra (R$)", type: "number" },
    { name: "codigoATPVe", label: "Código ATPVe", type: "text" },
    { name: "custosExtras", label: "Custos Extras (R$)", type: "number" },
    { name: "valorVenda", label: "Valor da Venda (R$)", type: "number", required: true },
    { name: "observacoes", label: "Observações", type: "textarea" },
];

const escapeValue = (value) =>
    value === null || value === undefined
        ? ""
        : value.toString().replace(/"/g, "&quot;");

const getFieldOptions = (field) => {
    if (typeof field.options === "function") {
        return field.options();
    }
    return field.options || [];
};

const buildFieldMarkup = (field, value = "") => {
    const requiredAttr = field.required ? "required" : "";
    const currentValue = value ?? "";
    if (field.type === "select") {
        const options = getFieldOptions(field);
        const hasCurrent =
            currentValue &&
            !options.some((opt) => opt.value === currentValue || opt === currentValue);
        const optionMarkup = [
            '<option value="">Selecione um cliente</option>',
            ...options.map((opt) => {
                const optionValue = typeof opt === "string" ? opt : opt.value;
                const optionLabel = typeof opt === "string" ? opt : opt.label;
                const selected = optionValue === currentValue ? "selected" : "";
                return `<option value="${escapeValue(optionValue)}" ${selected}>${escapeValue(
                    optionLabel || optionValue
                )}</option>`;
            }),
            hasCurrent
                ? `<option value="${escapeValue(currentValue)}" selected>${escapeValue(
                      currentValue
                  )}</option>`
                : "",
        ].join("");
        return `
            <label>
                ${field.label}
                <select name="${field.name}" ${requiredAttr}>
                    ${optionMarkup}
                </select>
            </label>
        `;
    }
    if (field.type === "textarea") {
        return `
            <label class="wide">
                ${field.label}
                <textarea name="${field.name}" rows="2" ${requiredAttr}>${currentValue}</textarea>
            </label>
        `;
    }
    return `
        <label>
            ${field.label}
            <input type="${field.type}" name="${field.name}" value="${escapeValue(
        currentValue
    )}" ${requiredAttr}>
        </label>
    `;
};

const getPurchaseUpdatesFromForm = (data) => ({
    data: data.get("data"),
    veiculo: data.get("veiculo")?.trim(),
    marca: data.get("marca")?.trim(),
    modelo: data.get("modelo")?.trim(),
    cor: data.get("cor")?.trim(),
    anoFabricacao: data.get("anoFabricacao")?.trim(),
    anoModelo: data.get("anoModelo")?.trim(),
    placa: data.get("placa")?.toUpperCase().replace(/[^A-Z0-9]/g, "") || "",
    cidade: data.get("cidade")?.trim(),
    uf: data.get("uf")?.trim().toUpperCase() || "",
    parceiro: data.get("parceiro")?.trim(),
    chassi: data.get("chassi")?.trim(),
    renavan: data.get("renavan")?.trim(),
    codigoCRVe: data.get("codigoCRVe")?.trim(),
    codigoCLAe: data.get("codigoCLAe")?.trim(),
    valorCompra: toNumber(data.get("valorCompra")),
    custosExtras: toNumber(data.get("custosExtras")),
    observacoes: data.get("observacoes")?.trim(),
});

const getSaleUpdatesFromForm = (data) => ({
    data: data.get("data"),
    parceiro: data.get("parceiro")?.trim(),
    contato: data.get("contato")?.trim(),
    modelo: data.get("modelo")?.trim(),
    placa: data.get("placa")?.toUpperCase().replace(/[^A-Z0-9]/g, "") || "",
    valorCompra: toNumber(data.get("valorCompra")),
    codigoATPVe: data.get("codigoATPVe")?.trim(),
    custosExtras: toNumber(data.get("custosExtras")),
    valorVenda: toNumber(data.get("valorVenda")),
    observacoes: data.get("observacoes")?.trim(),
});

const normalizeISODate = (value) => {
    if (!value) return "";
    if (value.includes("/")) {
        const [day, month, year] = value.split("/");
        if (!year || !month || !day) return "";
        return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(
            2,
            "0"
        )}`;
    }
    const [year, month, day] = value.split("-");
    if (!year || !month || !day) return "";
    return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(
        2,
        "0"
    )}`;
};

const toNumber = (value) => Number(value) || 0;
const formatCurrency = (value) => currency.format(value || 0);
const formatPercent = (value) => `${percentage.format(value || 0)}%`;
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

const openOperationModal = (record) => {
    if (!operationModal.container || !operationModal.form) return;
    const fields =
        record.tipo === "Compra" ? purchaseModalFields : saleModalFields;
    operationModal.title.textContent =
        record.tipo === "Compra" ? "Editar compra" : "Editar venda";
    const fieldsMarkup = fields
        .map((field) => buildFieldMarkup(field, record[field.name]))
        .join("");
    operationModal.form.innerHTML = `
        ${fieldsMarkup}
        <div class="modal-actions">
            <button type="submit" class="primary">Salvar alterações</button>
        </div>
    `;
    operationModal.form.dataset.tipo = record.tipo;
    operationModalState.id = record.id;
    operationModalState.tipo = record.tipo;
    operationModal.container.classList.add("visible");
    document.body.style.overflow = "hidden";
};

const closeOperationModal = () => {
    if (!operationModal.container || !operationModal.form) return;
    operationModal.container.classList.remove("visible");
    operationModal.form.innerHTML = "";
    operationModal.form.dataset.tipo = "";
    document.body.style.overflow = "";
    operationModalState.id = null;
    operationModalState.tipo = null;
};

operationModal.closeButtons?.forEach((button) =>
    button.addEventListener("click", closeOperationModal)
);
operationModal.container?.addEventListener("click", (event) => {
    if (event.target === operationModal.container) {
        closeOperationModal();
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && operationModal.container?.classList.contains("visible")) {
        closeOperationModal();
    }
});

operationModal.form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!operationModalState.id || !operationModalState.tipo) return;
    const data = new FormData(operationModal.form);
    if (operationModalState.tipo === "Compra") {
        const updates = getPurchaseUpdatesFromForm(data);
        await updateTransaction(
            operationModalState.id,
            ensureVehicleFields({ ...updates })
        );
    } else {
        const updates = getSaleUpdatesFromForm(data);
        await updateTransaction(operationModalState.id, updates);
    }
    closeOperationModal();
});

const openConfirmModal = (message, callback) => {
    if (!confirmModal.container || !confirmModal.message) return;
    confirmModal.message.textContent = message;
    confirmModal.container.classList.add("visible");
    document.body.style.overflow = "hidden";
    confirmModalCallback = callback;
};

const closeConfirmModal = () => {
    if (!confirmModal.container) return;
    confirmModal.container.classList.remove("visible");
    document.body.style.overflow = "";
    confirmModalCallback = null;
};

confirmModal.confirmBtn?.addEventListener("click", () => {
    if (confirmModalCallback) {
        confirmModalCallback();
    }
    closeConfirmModal();
});
confirmModal.cancelBtn?.addEventListener("click", closeConfirmModal);
confirmModal.closeBtn?.addEventListener("click", closeConfirmModal);
confirmModal.container?.addEventListener("click", (event) => {
    if (event.target === confirmModal.container) closeConfirmModal();
});
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && confirmModal.container?.classList.contains("visible")) {
        closeConfirmModal();
    }
});

const showToast = (message, variant = "success") => {
    if (!toastElement) return;
    toastElement.textContent = message;
    toastElement.classList.remove("toast-error");
    if (variant === "error") {
        toastElement.classList.add("toast-error");
    } else {
        toastElement.classList.remove("toast-error");
    }
    toastElement.classList.add("visible");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toastElement.classList.remove("visible");
    }, 2500);
};

const addTransaction = async (record) => {
    try {
        const saved = await jsonRequest(API_OPERATIONS, {
            method: "POST",
            body: JSON.stringify(record),
        });
        state.transactions.unshift(saved);
        renderTransactions();
        updateSummary();
        showToast("Operação cadastrada com sucesso.");
    } catch (error) {
        console.error(error);
        showToast("Erro ao salvar operação.", "error");
    }
};

const updateTransaction = async (id, updates) => {
    const original = state.transactions.find((item) => item.id === id);
    if (!original) {
        showToast("Registro não encontrado.", "error");
        return;
    }
    const payload = {
        ...original,
        ...updates,
        id: original.id,
        tipo: original.tipo,
    };
    try {
        const updated = await jsonRequest(`${API_OPERATIONS}/${id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
        });
        state.transactions = state.transactions.map((item) =>
            item.id === id ? updated : item
        );
        renderTransactions();
        updateSummary();
        showToast("Operação atualizada.");
    } catch (error) {
        console.error(error);
        showToast("Erro ao atualizar operação.", "error");
    }
};

const removeTransaction = async (id) => {
    try {
        await jsonRequest(`${API_OPERATIONS}/${id}`, { method: "DELETE" });
        state.transactions = state.transactions.filter((item) => item.id !== id);
        renderTransactions();
        updateSummary();
        showToast("Operação excluída com sucesso.");
    } catch (error) {
        console.error(error);
        showToast("Erro ao excluir operação.", "error");
    }
};

const handlePurchaseSubmit = async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const record = {
        id: createId(),
        tipo: "Compra",
        data: data.get("data"),
        veiculo: data.get("veiculo")?.trim(),
        marca: data.get("marca")?.trim(),
        modelo: data.get("modelo")?.trim(),
        cor: data.get("cor")?.trim(),
        anoFabricacao: data.get("anoFabricacao")?.trim(),
        anoModelo: data.get("anoModelo")?.trim(),
        placa: data.get("placa")?.toUpperCase().replace(/[^A-Z0-9]/g, "") || "",
        cidade: data.get("cidade")?.trim(),
        uf: data.get("uf")?.trim().toUpperCase() || "",
        parceiro: data.get("parceiro")?.trim(),
        chassi: data.get("chassi")?.trim(),
        renavan: data.get("renavan")?.trim(),
        codigoCRVe: data.get("codigoCRVe")?.trim(),
        codigoCLAe: data.get("codigoCLAe")?.trim(),
        contato: "",
        valorCompra: toNumber(data.get("valorCompra")),
        valorVenda: 0,
        custosExtras: toNumber(data.get("custosExtras")),
        observacoes: data.get("observacoes")?.trim(),
    };
    await addTransaction(ensureVehicleFields(record));
    event.currentTarget.reset();
};

const handleSaleSubmit = async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const record = {
        id: createId(),
        tipo: "Venda",
        data: data.get("data"),
        veiculo: "",
        marca: "",
        modelo: data.get("modelo")?.trim(),
        cor: "",
        anoFabricacao: "",
        anoModelo: "",
        placa: data.get("placa")?.toUpperCase().replace(/[^A-Z0-9]/g, "") || "",
        cidade: "",
        uf: "",
        parceiro: data.get("parceiro")?.trim(),
        contato: data.get("contato")?.trim(),
        chassi: "",
        renavan: "",
        codigoCRVe: "",
        codigoCLAe: "",
        codigoATPVe: data.get("codigoATPVe")?.trim(),
        valorCompra: toNumber(data.get("valorCompra")),
        valorVenda: toNumber(data.get("valorVenda")),
        custosExtras: toNumber(data.get("custosExtras")),
        observacoes: data.get("observacoes")?.trim(),
    };
    await addTransaction(ensureVehicleFields(record));
    event.currentTarget.reset();
};

const startEditTransaction = (id) => {
    const record = state.transactions.find((item) => item.id === id);
    if (!record) return;
    openOperationModal(record);
};

const checkPendingEditRequest = () => {
    const pendingId = localStorage.getItem(PENDING_EDIT_KEY);
    if (!pendingId) return;
    localStorage.removeItem(PENDING_EDIT_KEY);
    startEditTransaction(pendingId);
};

const renderTransactions = () => {
    const tbody = elements.tableBody;
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!state.transactions.length) {
        tbody.innerHTML =
            '<tr class="placeholder"><td colspan="22">Nenhuma operação cadastrada ainda.</td></tr>';
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

const updateSummary = () => {
    const totals = state.transactions.reduce(
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
        {
            invested: 0,
            sold: 0,
            profit: 0,
        }
    );
    const profitPercent =
        totals.invested > 0 ? (totals.profit / totals.invested) * 100 : 0;

    elements.summary.invested.textContent = formatCurrency(totals.invested);
    elements.summary.sold.textContent = formatCurrency(totals.sold);
    elements.summary.profit.textContent = formatCurrency(totals.profit);
    elements.summary.count.textContent = state.transactions.length.toString();
    if (elements.summary.profitPercent) {
        elements.summary.profitPercent.textContent = formatPercent(profitPercent);
    }
};

const init = async () => {
    await loadClientsFromApi();
    await loadTransactionsFromApi();
    if (elements.purchaseForm) {
        elements.purchaseForm.addEventListener("submit", handlePurchaseSubmit);
    }
    if (elements.saleForm) {
        elements.saleForm.addEventListener("submit", handleSaleSubmit);
    }
    if (elements.tableBody) {
        elements.tableBody.addEventListener("click", (event) => {
            const button = event.target.closest("[data-action]");
            if (!button) return;
            const { id, action } = button.dataset;
            if (!id) return;
            if (action === "delete") {
                openConfirmModal(
                    "Deseja remover este registro? Essa ação não pode ser desfeita.",
                    () => removeTransaction(id)
                );
            } else if (action === "edit") {
                startEditTransaction(id);
            }
        });
    }
    renderTransactions();
    updateSummary();
    checkPendingEditRequest();
};

document.addEventListener("DOMContentLoaded", init);
