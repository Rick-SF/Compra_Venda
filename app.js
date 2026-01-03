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

const FORM_DRAFT_KEYS = {
    purchase: "veiculos-draft-purchase",
    sale: "veiculos-draft-sale",
};

const pageContext =
    typeof document !== "undefined" ? document.body?.dataset.page || "" : "";

const stripNonDigits = (value, limit) => {
    const digits = value ? value.toString().replace(/\D/g, "") : "";
    return typeof limit === "number" ? digits.slice(0, limit) : digits;
};

const normalizePlate = (value) =>
    value?.toUpperCase().replace(/[^A-Z0-9]/g, "") || "";

const currencyInputFormatter = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const formatCurrencyInput = (value) => {
    if (typeof value === "number") {
        return currencyInputFormatter.format(value);
    }
    const digits = stripNonDigits(value);
    if (!digits) return "";
    const number = Number(digits) / 100;
    return currencyInputFormatter.format(number);
};

const formatPhoneDisplay = (value) => {
    const digits = stripNonDigits(value, 11);
    if (!digits) return "";
    const ddd = digits.slice(0, 2);
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 6) {
        return `(${ddd}) ${digits.slice(2)}`;
    }
    if (digits.length <= 10) {
        return `(${ddd}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return `(${ddd}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

const maskHandlers = {
    phone: (input) => {
        if (!input || input.dataset.maskAttached === "true") return;
        const handle = () => {
            input.value = formatPhoneDisplay(input.value);
        };
        input.addEventListener("input", handle);
        input.dataset.maskAttached = "true";
        handle();
    },
    currency: (input) => {
        if (!input || input.dataset.maskAttached === "true") return;
        const handle = () => {
            input.value = formatCurrencyInput(input.value);
        };
        input.addEventListener("input", handle);
        input.dataset.maskAttached = "true";
        handle();
    },
};

const applyInputMasks = (root = document) => {
    Object.entries(maskHandlers).forEach(([mask, handler]) => {
        root
            .querySelectorAll(`[data-mask='${mask}']`)
            .forEach((input) => handler(input));
    });
};

const filterTransactionsForPage = (records) => {
    if (!Array.isArray(records)) return [];
    if (pageContext === "compras") {
        return records.filter((item) => item.tipo === "Compra");
    }
    if (pageContext === "vendas") {
        return records.filter((item) => item.tipo === "Venda");
    }
    return records;
};

const hasPurchaseWithPlate = (plate) => {
    const normalized = normalizePlate(plate);
    if (!normalized) return false;
    return state.transactions.some(
        (item) =>
            item.tipo === "Compra" && normalizePlate(item.placa) === normalized
    );
};

const hasSaleWithPlate = (plate) => {
    const normalized = normalizePlate(plate);
    if (!normalized) return false;
    return state.transactions.some(
        (item) =>
            item.tipo === "Venda" && normalizePlate(item.placa) === normalized
    );
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
    saleContactInput: document.querySelector("[data-sale-contact]"),
    salePlateSelect: document.querySelector("[data-select='sale-plate']"),
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

const getSafeFieldSelector = (name) => {
    if (typeof CSS !== "undefined" && CSS.escape) {
        return CSS.escape(name);
    }
    return name.replace(/"/g, '\\"');
};

const applyFieldValue = (form, name, value) => {
    if (!form) return;
    const safeName = getSafeFieldSelector(name);
    const field = form.querySelector(`[name="${safeName}"]`);
    if (!field) return;
    if (field.tagName === "SELECT") {
        field.value = value ?? "";
        if (value && field.value !== value) {
            field.dataset.pendingValue = value;
        } else {
            delete field.dataset.pendingValue;
        }
    } else if (field.type === "checkbox") {
        field.checked = Boolean(value);
    } else if (field.type === "radio") {
        const option = form.querySelector(
            `[name="${safeName}"][value="${value}"]`
        );
        if (option) option.checked = true;
    } else {
        field.value = value ?? "";
    }
};

const saveFormDraft = (form, key) => {
    const storage = getStorage();
    if (!form || !storage) return;
    const data = {};
    const formData = new FormData(form);
    formData.forEach((formValue, formName) => {
        data[formName] = formValue;
    });
    storage.setItem(key, JSON.stringify(data));
};

const loadFormDraft = (form, key) => {
    const storage = getStorage();
    if (!form || !storage) return;
    const raw = storage.getItem(key);
    if (!raw) return;
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return;
    }
    Object.entries(parsed).forEach(([name, value]) =>
        applyFieldValue(form, name, value)
    );
    if (form === elements.saleForm) {
        handleSaleClientChange();
        handleSalePlateChange();
    }
};

const clearFormDraftStorage = (key) => {
    const storage = getStorage();
    storage?.removeItem(key);
};

const resetFormDraft = (form, key) => {
    if (!form) return;
    clearFormDraftStorage(key);
    form.reset();
    if (form === elements.saleForm) {
        if (elements.saleClientSelect) {
            delete elements.saleClientSelect.dataset.pendingValue;
        }
        if (elements.salePlateSelect) {
            delete elements.salePlateSelect.dataset.pendingValue;
        }
        handleSaleClientChange();
        handleSalePlateChange();
    }
};

const setupFormDraftPersistence = () => {
    if (elements.purchaseForm) {
        loadFormDraft(elements.purchaseForm, FORM_DRAFT_KEYS.purchase);
        const handler = () =>
            saveFormDraft(elements.purchaseForm, FORM_DRAFT_KEYS.purchase);
        elements.purchaseForm.addEventListener("input", handler);
        elements.purchaseForm.addEventListener("change", handler);
    }
    if (elements.saleForm) {
        loadFormDraft(elements.saleForm, FORM_DRAFT_KEYS.sale);
        const handler = () =>
            saveFormDraft(elements.saleForm, FORM_DRAFT_KEYS.sale);
        elements.saleForm.addEventListener("input", handler);
        elements.saleForm.addEventListener("change", handler);
    }
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

const loadTransactionsFromApi = async () => {
    try {
        const data = await jsonRequest(API_OPERATIONS);
        state.transactions = Array.isArray(data) ? data : [];
        populateSalePlateOptions();
    } catch (error) {
        console.error(error);
        showToast("Erro ao carregar operações.", "error");
    }
};

const loadClientsFromApi = async () => {
    try {
        const data = await jsonRequest(API_CLIENTS);
        state.clients = Array.isArray(data)
            ? data.map((client) => ({
                  ...client,
                  contato: stripNonDigits(client.contato || ""),
                  cpf: stripNonDigits(client.cpf || ""),
              }))
            : [];
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
    const previousValue =
        select.dataset.pendingValue || select.value || "";
    select.innerHTML = "";
    if (!state.clients.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Cadastre um cliente";
        select.appendChild(option);
        select.disabled = true;
        if (previousValue) {
            select.dataset.pendingValue = previousValue;
        }
        if (elements.saleContactInput) {
            elements.saleContactInput.value = "";
        }
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
        option.dataset.contact = stripNonDigits(client.contato || "");
        option.textContent = client.nome || "Cliente sem nome";
        select.appendChild(option);
    });
    if (previousValue) {
        select.value = previousValue;
    }
    if (previousValue && select.value !== previousValue) {
        select.dataset.pendingValue = previousValue;
    } else {
        delete select.dataset.pendingValue;
    }
    const shouldAutofill =
        !elements.saleContactInput || !elements.saleContactInput.value;
    if (shouldAutofill) {
        handleSaleClientChange();
    }
    handleSalePlateChange();
};

const findPurchaseByPlate = (plateValue) => {
    if (!plateValue) return null;
    const normalized = normalizePlate(plateValue);
    return state.transactions.find(
        (item) =>
            item.tipo === "Compra" &&
            normalizePlate(item.placa) === normalized
    );
};

const populateSalePlateOptions = () => {
    const select = elements.salePlateSelect;
    if (!select) return;
    const previousValue = select.dataset.pendingValue || select.value || "";
    select.innerHTML = "";
    const purchases = state.transactions.filter(
        (item) =>
            item.tipo === "Compra" &&
            item.placa &&
            !hasSaleWithPlate(item.placa)
    );
    if (!purchases.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Cadastre uma compra";
        select.appendChild(option);
        select.disabled = true;
        if (previousValue) {
            select.dataset.pendingValue = previousValue;
        }
        return;
    }
    select.disabled = false;
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Selecione uma placa comprada";
    select.appendChild(placeholder);
    const seen = new Set();
    purchases.forEach((purchase) => {
        const plate = purchase.placa;
        if (!plate || seen.has(plate)) return;
        seen.add(plate);
        const option = document.createElement("option");
        option.value = plate;
        option.dataset.purchaseId = purchase.id;
        const labelParts = [plate];
        if (purchase.modelo) {
            labelParts.push(purchase.modelo);
        } else if (purchase.veiculo) {
            labelParts.push(purchase.veiculo);
        }
        option.textContent = labelParts.join(" · ");
        select.appendChild(option);
    });
    if (previousValue) {
        select.value = previousValue;
    }
    if (previousValue && select.value !== previousValue) {
        select.dataset.pendingValue = previousValue;
    } else {
        delete select.dataset.pendingValue;
    }

    const shouldAutofill =
        !elements.saleContactInput || !elements.saleContactInput.value;
    if (shouldAutofill) {
        handleSaleClientChange();
    }
};
const handleSaleClientChange = () => {
    const select = elements.saleClientSelect;
    const contactInput = elements.saleContactInput;
    if (!select || !contactInput) return;
    const selectedOption = select.options[select.selectedIndex];
    const contact = stripNonDigits(selectedOption?.dataset.contact || "");
    contactInput.value = formatPhoneDisplay(contact);
};

const handleSalePlateChange = () => {
    const select = elements.salePlateSelect;
    if (!select || !elements.saleForm) return;
    const selectedPlate = select.value;
    const modelInput = elements.saleForm.querySelector("input[name='modelo']");
    const valueCompraInput = elements.saleForm.querySelector(
        "input[name='valorCompra']"
    );
    if (!selectedPlate) {
        if (modelInput) modelInput.value = "";
        if (valueCompraInput) valueCompraInput.value = "";
        saveFormDraft(elements.saleForm, FORM_DRAFT_KEYS.sale);
        return;
    }
    const purchase = findPurchaseByPlate(selectedPlate);
    if (!purchase) return;
    if (modelInput) {
        modelInput.value = purchase.modelo || purchase.veiculo || "";
    }
    if (valueCompraInput) {
        valueCompraInput.value =
            purchase.valorCompra !== undefined && purchase.valorCompra !== null
                ? formatCurrencyInput(purchase.valorCompra)
                : "";
    }
    saveFormDraft(elements.saleForm, FORM_DRAFT_KEYS.sale);
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

const purchaseDetailFields = [
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
    { name: "valorCompra", label: "Valor da Compra (R$)", type: "text", required: true, mask: "currency" },
    { name: "custosExtras", label: "Custos Extras (R$)", type: "text", mask: "currency" },
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
    { name: "contato", label: "Contato", type: "text", mask: "phone" },
    { name: "modelo", label: "Modelo / Versão", type: "text", required: true },
    { name: "placa", label: "Placa", type: "text", required: true },
    { name: "valorCompra", label: "Valor da Compra (R$)", type: "text", mask: "currency" },
    { name: "codigoATPVe", label: "Código ATPVe", type: "text" },
    { name: "custosExtras", label: "Custos Extras (R$)", type: "text", mask: "currency" },
    { name: "valorVenda", label: "Valor da Venda (R$)", type: "text", required: true, mask: "currency" },
    { name: "observacoes", label: "Observações", type: "textarea" },
];

const escapeValue = (value) =>
    value === null || value === undefined
        ? ""
        : value.toString().replace(/"/g, "&quot;");

const formatValueByMask = (mask, value) => {
    if (!mask) return value ?? "";
    if (mask === "phone") {
        return formatPhoneDisplay(value);
    }
    if (mask === "currency") {
        if (value === null || value === undefined) return "";
        return formatCurrencyInput(value);
    }
    return value ?? "";
};

const getFieldOptions = (field) => {
    if (typeof field.options === "function") {
        return field.options();
    }
    return field.options || [];
};

const buildFieldMarkup = (field, value = "") => {
    const requiredAttr = field.required ? "required" : "";
    const currentValue = field.mask
        ? formatValueByMask(field.mask, value)
        : value ?? "";
    const maskAttr = field.mask ? ` data-mask="${field.mask}"` : "";
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
            )}" ${requiredAttr}${maskAttr}>
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
    placa: normalizePlate(data.get("placa")),
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
    contato: stripNonDigits(data.get("contato")),
    modelo: data.get("modelo")?.trim(),
    placa: normalizePlate(data.get("placa")),
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

const toNumber = (value) => {
    if (typeof value === "string") {
        const cleaned = value
            .replace(/\s/g, "")
            .replace(/\./g, "")
            .replace(",", ".")
            .replace(/[^0-9.-]/g, "");
        return Number(cleaned) || 0;
    }
    return Number(value) || 0;
};
const formatCurrency = (value) => currency.format(value || 0);
const formatPercent = (value) => `${percentage.format(value || 0)}%`;
const formatDate = (value) => {
    const isoDate = normalizeISODate(value);
    if (!isoDate) return "-";
    const [year, month, day] = isoDate.split("-");
    return `${day}/${month}/${year}`;
};

const getPurchaseExtrasForRecord = (record) => {
    if (record.tipo === "Compra") {
        return record.custosExtras || 0;
    }
    const purchase = findPurchaseByPlate(record.placa);
    return purchase ? purchase.custosExtras || 0 : 0;
};

const getSaleExtrasForRecord = (record) =>
    record.tipo === "Venda" ? record.custosExtras || 0 : 0;

const calculateProfit = (record) => {
    if (record.tipo !== "Venda") return null;
    const saleExtras = getSaleExtrasForRecord(record);
    const purchaseExtras = getPurchaseExtrasForRecord(record);
    const purchase = findPurchaseByPlate(record.placa);
    const purchaseValue = purchase
        ? purchase.valorCompra || record.valorCompra || 0
        : record.valorCompra || 0;
    const revenue = (record.valorVenda || 0) + saleExtras;
    const cost = purchaseValue + purchaseExtras;
    return revenue - cost;
};

const getContactCellContent = (record) => {
    const contactDisplay = formatPhoneDisplay(record.contato);
    return `
        ${record.parceiro || "-"}
        ${
            contactDisplay
                ? `<span class="contact">${contactDisplay}</span>`
                : ""
        }
    `.trim();
};

const columnRenderers = {
    data: (record) => `<td>${formatDate(record.data)}</td>`,
    tipo: (record) => {
        const typeClass = record.tipo === "Venda" ? "tag-sale" : "tag-purchase";
        return `<td><span class="tag ${typeClass}">${record.tipo}</span></td>`;
    },
    veiculo: (record) => `<td>${record.veiculo || "-"}</td>`,
    marca: (record) => `<td>${record.marca || "-"}</td>`,
    modelo: (record) => `<td>${record.modelo || "-"}</td>`,
    cor: (record) => `<td>${record.cor || "-"}</td>`,
    anoFabricacao: (record) => `<td>${record.anoFabricacao || "-"}</td>`,
    anoModelo: (record) => `<td>${record.anoModelo || "-"}</td>`,
    cidade: (record) => `<td>${record.cidade || "-"}</td>`,
    uf: (record) => `<td>${record.uf || "-"}</td>`,
    placa: (record) => `<td>${record.placa || "-"}</td>`,
    contraparte: (record) => `<td>${getContactCellContent(record)}</td>`,
    chassi: (record) => `<td>${record.chassi || "-"}</td>`,
    renavam: (record) => `<td>${record.renavan || "-"}</td>`,
    codigoCRVe: (record) => `<td>${record.codigoCRVe || "-"}</td>`,
    codigoCLAe: (record) => `<td>${record.codigoCLAe || "-"}</td>`,
    codigoATPVe: (record) => `<td>${record.codigoATPVe || "-"}</td>`,
    valorCompra: (record) => {
        const value = record.valorCompra ? formatCurrency(record.valorCompra) : "-";
        const extras = getPurchaseExtrasForRecord(record);
        const extrasText = extras
            ? `<span class="muted-text">Custos extras: ${formatCurrency(extras)}</span>`
            : "";
        return `<td>${value}${extrasText ? `<br>${extrasText}` : ""}</td>`;
    },
    valorVenda: (record) => {
        const value = record.valorVenda ? formatCurrency(record.valorVenda) : "-";
        const extras = getSaleExtrasForRecord(record);
        const extrasText =
            record.tipo === "Venda" && extras
                ? `<span class="muted-text">Custos extras: ${formatCurrency(extras)}</span>`
                : "";
        return `<td>${value}${extrasText ? `<br>${extrasText}` : ""}</td>`;
    },
    observacoes: (record) =>
        `<td><span class="notes">${record.observacoes || "-"}</span></td>`,
    actions: (record) => `
        <td class="actions-cell">
            <button class="table-button edit" data-action="edit" data-id="${record.id}">
                Editar
            </button>
            <button class="table-button delete" data-action="delete" data-id="${record.id}">
                Excluir
            </button>
        </td>
    `,
};

const TABLE_COLUMNS = {
    compras: [
        "data",
        "tipo",
        "veiculo",
        "marca",
        "modelo",
        "cor",
        "anoFabricacao",
        "anoModelo",
        "cidade",
        "uf",
        "placa",
        "contraparte",
        "chassi",
        "renavam",
        "codigoCRVe",
        "codigoCLAe",
        "valorCompra",
        "observacoes",
        "actions",
    ],
    vendas: [
        "data",
        "tipo",
        "veiculo",
        "marca",
        "modelo",
        "cor",
        "anoFabricacao",
        "anoModelo",
        "cidade",
        "uf",
        "placa",
        "contraparte",
        "codigoATPVe",
        "valorVenda",
        "observacoes",
        "actions",
    ],
};

const getActiveColumns = () =>
    TABLE_COLUMNS[pageContext] || TABLE_COLUMNS.compras;

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
    applyInputMasks(operationModal.form);
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

document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-clear-form]");
    if (!button) return;
    const target = button.dataset.clearForm;
    if (target === "purchase") {
        resetFormDraft(elements.purchaseForm, FORM_DRAFT_KEYS.purchase);
    } else if (target === "sale") {
        resetFormDraft(elements.saleForm, FORM_DRAFT_KEYS.sale);
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
        if (record.tipo === "Compra") {
            resetFormDraft(elements.purchaseForm, FORM_DRAFT_KEYS.purchase);
        } else if (record.tipo === "Venda") {
            resetFormDraft(elements.saleForm, FORM_DRAFT_KEYS.sale);
        }
        state.transactions.unshift(saved);
        populateSalePlateOptions();
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
        populateSalePlateOptions();
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
        populateSalePlateOptions();
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
    const normalizedPlate = normalizePlate(data.get("placa"));
    if (!normalizedPlate) {
        showToast("Informe uma placa válida.", "error");
        return;
    }
    if (hasPurchaseWithPlate(normalizedPlate)) {
        showToast(
            "Já existe uma compra cadastrada para essa placa.",
            "error"
        );
        return;
    }
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
        placa: normalizedPlate,
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
};

const handleSaleSubmit = async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const normalizedPlate = normalizePlate(data.get("placa"));
    if (!normalizedPlate) {
        showToast("Selecione uma placa válida.", "error");
        return;
    }
    if (hasSaleWithPlate(normalizedPlate)) {
        showToast("Essa placa já possui uma venda registrada.", "error");
        return;
    }
    const purchaseReference = findPurchaseByPlate(normalizedPlate);
    if (!purchaseReference) {
        showToast(
            "Cadastre a compra desse veículo antes de registrar a venda.",
            "error"
        );
        return;
    }
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
        placa: normalizedPlate,
        cidade: "",
        uf: "",
        parceiro: data.get("parceiro")?.trim(),
        contato: stripNonDigits(data.get("contato")),
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
    purchaseDetailFields.forEach((field) => {
        if (purchaseReference[field]) {
            record[field] = purchaseReference[field];
        }
    });
    if (!record.modelo) {
        record.modelo = purchaseReference.modelo || "";
    }
    if (!record.valorCompra) {
        record.valorCompra = toNumber(purchaseReference.valorCompra);
    }
    await addTransaction(ensureVehicleFields(record));
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

    const visibleRecords = filterTransactionsForPage(state.transactions);
    const columns = getActiveColumns();
    const placeholderCols = columns.length;

    if (!visibleRecords.length) {
        tbody.innerHTML = `<tr class="placeholder"><td colspan="${placeholderCols}">Nenhuma operação cadastrada ainda.</td></tr>`;
        return;
    }

    visibleRecords.forEach((record) => {
        const tr = document.createElement("tr");
        if (record.observacoes) {
            tr.title = record.observacoes;
        }

        tr.innerHTML = columns
            .map((key) => columnRenderers[key]?.(record) || "<td>—</td>")
            .join("");

        tbody.appendChild(tr);
    });
};

const updateSummary = () => {
    const totals = state.transactions.reduce(
        (acc, record) => {
            if (record.tipo === "Compra") {
                acc.invested +=
                    (record.valorCompra || 0) +
                    (getPurchaseExtrasForRecord(record) || 0);
            }
            if (record.tipo === "Venda") {
                acc.sold +=
                    (record.valorVenda || 0) +
                    (getSaleExtrasForRecord(record) || 0);
            }
            return acc;
        },
        {
            invested: 0,
            sold: 0,
        }
    );
    const totalProfit = totals.sold - totals.invested;
    const profitPercent =
        totals.invested > 0 ? (totalProfit / totals.invested) * 100 : 0;

    if (elements.summary.invested) {
        elements.summary.invested.textContent = formatCurrency(totals.invested);
    }
    if (elements.summary.sold) {
        elements.summary.sold.textContent = formatCurrency(totals.sold);
    }
    if (elements.summary.profit) {
        elements.summary.profit.textContent = formatCurrency(totalProfit);
    }
    if (elements.summary.count) {
        elements.summary.count.textContent = state.transactions.length.toString();
    }
    if (elements.summary.profitPercent) {
        elements.summary.profitPercent.textContent = formatPercent(profitPercent);
    }
};

const init = async () => {
    setupFormDraftPersistence();
    applyInputMasks();
    await loadClientsFromApi();
    await loadTransactionsFromApi();
    if (elements.purchaseForm) {
        elements.purchaseForm.addEventListener("submit", handlePurchaseSubmit);
    }
    if (elements.saleForm) {
        elements.saleForm.addEventListener("submit", handleSaleSubmit);
    }
    elements.saleClientSelect?.addEventListener("change", handleSaleClientChange);
    elements.salePlateSelect?.addEventListener("change", handleSalePlateChange);
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
