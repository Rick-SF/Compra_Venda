const API_OPERATIONS = "/api/operations";
const API_CLIENTS = "/api/clients";
const API_CONTRACT = "/api/contracts/generate";
const MAX_INSTALLMENTS = 20;

const stateContract = {
    operations: [],
    clients: [],
};

const getClientById = (id) => {
    if (!id) return null;
    return stateContract.clients.find((client) => client.id === id) || null;
};

const contractElements = {
    form: document.getElementById("contract-form"),
    operationSelect: document.getElementById("contract-operation"),
    clientSelect: document.getElementById("contract-client"),
    preview: document.getElementById("preview-content"),
    installmentsSelect: document.getElementById("contract-installments"),
    installmentNote: document.getElementById("installment-note"),
    paymentType: document.getElementById("contract-payment-type"),
    paymentValueInput: document.getElementById("contract-payment-value"),
    paymentValueLabel: document.getElementById("payment-value-label"),
    totalValueInput: document.getElementById("contract-total-value"),
    installmentsWrapper: document.querySelector(
        "[data-contract-section='installments']"
    ),
    totalWrapper: document.querySelector("[data-contract-section='total']"),
    dueWrapper: document.querySelector("[data-contract-section='due-details']"),
    dueDayInput: document.getElementById("contract-due-day"),
    firstDueInput: document.getElementById("contract-first-due"),
    witness1Name: document.getElementById("contract-witness1-name"),
    witness1Cpf: document.getElementById("contract-witness1-cpf"),
    witness2Name: document.getElementById("contract-witness2-name"),
    witness2Cpf: document.getElementById("contract-witness2-cpf"),
};

const toastContract = document.getElementById("toast");
let toastTimeout;

const showContractToast = (message, variant = "success") => {
    if (!toastContract) return;
    toastContract.textContent = message;
    toastContract.classList.remove("toast-error");
    if (variant === "error") {
        toastContract.classList.add("toast-error");
    }
    toastContract.classList.add("visible");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toastContract.classList.remove("visible");
    }, 2500);
};

const formatCurrency = (value) =>
    new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(value || 0);
const currencyInputFormatter = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});
const formatCurrencyInput = (value) =>
    currencyInputFormatter.format(value || 0);

const formatDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        const [day, month, year] = value.split("/");
        if (day && month && year) {
            return `${day}/${month}/${year}`;
        }
        return value;
    }
    return date.toLocaleDateString("pt-BR");
};

const parseCurrencyValue = (value) => {
    if (typeof value === "number") return value;
    if (!value) return 0;
    const cleaned = value
        .toString()
        .replace(/\s/g, "")
        .replace(/[R$\u00A0]/gi, "")
        .replace(/\./g, "")
        .replace(",", ".");
    return Number(cleaned) || 0;
};

const clampInstallmentsValue = (value) => {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 1) return 1;
    if (parsed > MAX_INSTALLMENTS) return MAX_INSTALLMENTS;
    return parsed;
};

const getPaymentType = () =>
    contractElements.paymentType?.value === "parcelado" ? "parcelado" : "vista";

const stripNonDigits = (value) =>
    value ? value.toString().replace(/\D/g, "") : "";

const formatCpfDisplay = (value) => {
    const digits = stripNonDigits(value).slice(0, 11);
    if (!digits) return "";
    if (digits.length <= 3) return digits;
    if (digits.length <= 6)
        return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9)
        return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(
        6,
        9
    )}-${digits.slice(9, 11)}`;
};

const getWitnessData = () => ({
    witness1Name: contractElements.witness1Name?.value.trim() || "",
    witness1Cpf: stripNonDigits(contractElements.witness1Cpf?.value || ""),
    witness2Name: contractElements.witness2Name?.value.trim() || "",
    witness2Cpf: stripNonDigits(contractElements.witness2Cpf?.value || ""),
});

const attachCpfMask = (input) => {
    if (!input) return;
    const handler = () => {
        input.value = formatCpfDisplay(input.value);
    };
    input.addEventListener("input", handler);
    handler();
};

const loadOperations = async () => {
    const response = await fetch(API_OPERATIONS);
    if (!response.ok) throw new Error("Erro ao carregar vendas");
    const data = await response.json();
    stateContract.operations = Array.isArray(data)
        ? data.filter((item) => item.tipo === "Venda")
        : [];
};

const loadClients = async () => {
    const response = await fetch(API_CLIENTS);
    if (!response.ok) throw new Error("Erro ao carregar clientes");
    const data = await response.json();
    stateContract.clients = Array.isArray(data) ? data : [];
};

const populateOperationSelect = () => {
    const select = contractElements.operationSelect;
    if (!select) return;
    select.innerHTML = "";
    if (!stateContract.operations.length) {
        select.disabled = true;
        select.innerHTML =
            '<option value="">Cadastre uma venda</option>';
        return;
    }
    select.disabled = false;
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Selecione uma venda";
    select.appendChild(placeholder);

    stateContract.operations.forEach((operation) => {
        const option = document.createElement("option");
        const value = operation.id;
        const labelParts = [
            operation.placa || "Sem placa",
            operation.modelo || operation.veiculo || "Modelo não informado",
            formatCurrency(operation.valorVenda || 0),
        ];
        option.value = value;
        option.textContent = labelParts.join(" • ");
        const partnerName =
            getClientById(operation.clientId)?.nome || operation.parceiro || "";
        option.dataset.partner = partnerName;
        select.appendChild(option);
    });
};

const populateClientSelect = () => {
    const select = contractElements.clientSelect;
    if (!select) return;
    select.innerHTML = "";
    if (!stateContract.clients.length) {
        select.disabled = true;
        select.innerHTML =
            '<option value="">Cadastre um cliente</option>';
        return;
    }
    select.disabled = false;
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Selecione um cliente";
    select.appendChild(placeholder);

    stateContract.clients.forEach((client) => {
        const option = document.createElement("option");
        option.value = client.id;
        option.textContent = client.nome || "Cliente sem nome";
        option.dataset.cpf = client.cpf || "";
        select.appendChild(option);
    });
};

const normalizeText = (value) =>
    value
        ? value
              .toString()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase()
              .trim()
        : "";

const autofillClient = () => {
    const operationSelect = contractElements.operationSelect;
    const clientSelect = contractElements.clientSelect;
    if (!operationSelect || !clientSelect) return;
    const selectedOperation = stateContract.operations.find(
        (operation) => operation.id === operationSelect.value
    );
    if (!selectedOperation) return;
    if (selectedOperation.clientId) {
        const clientExists = getClientById(selectedOperation.clientId);
        if (clientExists) {
            clientSelect.value = selectedOperation.clientId;
            return;
        }
    }
    const partnerName = normalizeText(
        selectedOperation.parceiro || ""
    );
    if (!partnerName) return;

    const matchingOption = Array.from(clientSelect.options).find(
        (opt) => normalizeText(opt.textContent) === partnerName
    );
    if (matchingOption) {
        clientSelect.value = matchingOption.value;
    }
};

const getSelectedOperation = () => {
    const operationId = contractElements.operationSelect?.value;
    if (!operationId) return null;
    return stateContract.operations.find((item) => item.id === operationId) || null;
};

const getSaleValue = () => Number(getSelectedOperation()?.valorVenda) || 0;

const getSelectedInstallments = () => {
    if (getPaymentType() !== "parcelado") return 1;
    return clampInstallmentsValue(contractElements.installmentsSelect?.value || 1);
};

const getEntryValue = () => {
    const paymentType = getPaymentType();
    const saleValue = getSaleValue();
    if (paymentType !== "parcelado") return saleValue;
    const raw = contractElements.paymentValueInput?.dataset.rawValue;
    if (!raw) return 0;
    const typed = Number(raw);
    if (!Number.isFinite(typed) || typed <= 0) return 0;
    if (typed >= saleValue) return saleValue;
    return typed;
};

const getFinancedValue = () => {
    const saleValue = getSaleValue();
    const entry = getEntryValue();
    const remaining = saleValue - entry;
    return remaining > 0 ? remaining : 0;
};

const getInstallmentValue = () => {
    if (getPaymentType() !== "parcelado") return getSaleValue();
    const financed = getFinancedValue();
    const installments = getSelectedInstallments();
    if (!installments) return financed;
    return financed / installments;
};

const toggleSection = (element, visible) => {
    if (!element) return;
    element.classList.toggle("is-hidden", !visible);
};

const getDueDayValue = () => {
    const value = Number(contractElements.dueDayInput?.value);
    if (!Number.isFinite(value)) return "";
    if (value < 1 || value > 31) return "";
    return value;
};

const getDueDateValue = (input) => {
    const value = input?.value?.trim();
    if (!value) return "";
    return value;
};

const addMonthsToDate = (isoDate, months) => {
    if (!isoDate) return "";
    const [year, month, day] = isoDate.split("-").map(Number);
    if (!year || !month || !day) return isoDate;
    const baseDate = new Date(year, month - 1, day);
    baseDate.setMonth(baseDate.getMonth() + months);
    const resultYear = baseDate.getFullYear();
    const resultMonth = String(baseDate.getMonth() + 1).padStart(2, "0");
    const resultDay = String(baseDate.getDate()).padStart(2, "0");
    return `${resultYear}-${resultMonth}-${resultDay}`;
};

const updateInstallmentNote = () => {
    const note = contractElements.installmentNote;
    if (!note) return;
    if (!getSelectedOperation()) {
        note.textContent = "Selecione uma venda para calcular.";
        return;
    }
    const saleValue = getSaleValue();
    if (getPaymentType() !== "parcelado") {
        note.textContent = saleValue
            ? `Pagamento à vista no valor de ${formatCurrency(saleValue)}.`
            : "Pagamento à vista. Informe o valor da venda.";
        return;
    }
    const parcels = getSelectedInstallments() || 1;
    const financed = getFinancedValue();
    const perValue = parcels ? financed / parcels : financed;
    note.textContent = financed
        ? `${parcels}x de ${formatCurrency(perValue)} (restante ${formatCurrency(
              financed
          )})`
        : `${parcels}x (sem saldo a parcelar)`;
};

const updateInstallmentOptions = () => {
    const select = contractElements.installmentsSelect;
    if (!select) return;
    const paymentType = getPaymentType();
    const previousValue = select.value || "1";
    const fragment = document.createDocumentFragment();

    if (paymentType !== "parcelado") {
        const singleOption = document.createElement("option");
        singleOption.value = "1";
        singleOption.textContent = "1x";
        fragment.appendChild(singleOption);
        select.innerHTML = "";
        select.appendChild(fragment);
        select.value = "1";
        select.disabled = true;
        updateInstallmentNote();
        return;
    }

    select.disabled = false;
    const financed = getFinancedValue();
    for (let i = 1; i <= MAX_INSTALLMENTS; i += 1) {
        const option = document.createElement("option");
        option.value = String(i);
        const perValue = financed ? financed / i : 0;
        option.textContent = financed
            ? `${i}x de ${formatCurrency(perValue)}`
            : `${i}x`;
        if (previousValue === option.value) {
            option.selected = true;
        }
        fragment.appendChild(option);
    }
    select.innerHTML = "";
    select.appendChild(fragment);
    if (!select.value) {
        select.value = clampInstallmentsValue(previousValue).toString();
    }
    updateInstallmentNote();
};

const updateTotalField = () => {
    if (!contractElements.totalValueInput) return;
    const saleValue = getSaleValue();
    contractElements.totalValueInput.value = saleValue
        ? formatCurrency(saleValue)
        : "";
};

const updatePaymentFieldState = () => {
    const paymentType = getPaymentType();
    const saleValue = getSaleValue();
    const label = contractElements.paymentValueLabel;
    const input = contractElements.paymentValueInput;
    if (label && input) {
        const previousMode = input.dataset.mode;
        if (paymentType === "parcelado") {
            label.textContent = "Valor da entrada";
            input.readOnly = false;
            const typed =
                previousMode === "parcelado"
                    ? parseCurrencyValue(input.value || "0")
                    : 0;
            const current = Math.min(Math.max(typed, 0), saleValue);
            input.value =
                saleValue && current > 0 ? formatCurrency(current) : "";
            input.dataset.rawValue = current > 0 ? current.toString() : "";
            input.dataset.mode = "parcelado";
        } else {
            label.textContent = "Valor total";
            input.readOnly = true;
            input.dataset.mode = "vista";
            input.value = saleValue ? formatCurrency(saleValue) : "";
            input.dataset.rawValue = saleValue ? saleValue.toString() : "";
        }
    }
    toggleSection(contractElements.installmentsWrapper, paymentType === "parcelado");
    toggleSection(contractElements.totalWrapper, paymentType === "parcelado");
    toggleSection(contractElements.dueWrapper, paymentType === "parcelado");
    updateTotalField();
    updateInstallmentOptions();
};

const renderPreview = () => {
    const container = contractElements.preview;
    if (!container) return;
    const operationId = contractElements.operationSelect?.value;
    const clientId = contractElements.clientSelect?.value;
    const operation = stateContract.operations.find(
        (item) => item.id === operationId
    );
    const client = stateContract.clients.find((item) => item.id === clientId);
    if (!operation || !client) {
        container.innerHTML =
            "<p>Selecione uma venda e um cliente para visualizar os detalhes.</p>";
        return;
    }
    const paymentType = getPaymentType();
    const saleValue = getSaleValue();
    const entryValue = getEntryValue();
    const installments = getSelectedInstallments() || 1;
    const installmentValue = getInstallmentValue();
    const financed = getFinancedValue();
    const dueDayValue = getDueDayValue();
    const firstDue = getDueDateValue(contractElements.firstDueInput);
    const lastDue =
        firstDue && installments > 0
            ? addMonthsToDate(firstDue, installments - 1)
            : "";
    const parcelLabel =
        paymentType === "parcelado"
            ? `${installments}x de ${formatCurrency(installmentValue)}`
            : "Pagamento à vista";
    const {
        witness1Name,
        witness1Cpf,
        witness2Name,
        witness2Cpf,
    } = getWitnessData();
    const witnessDetails = [];
    if (witness1Name || witness1Cpf) {
        witnessDetails.push(
            `<li><strong>Testemunha 1:</strong> ${
                witness1Name || "-"
            }${witness1Cpf ? ` — CPF: ${formatCpfDisplay(witness1Cpf)}` : ""}</li>`
        );
    }
    if (witness2Name || witness2Cpf) {
        witnessDetails.push(
            `<li><strong>Testemunha 2:</strong> ${
                witness2Name || "-"
            }${witness2Cpf ? ` — CPF: ${formatCpfDisplay(witness2Cpf)}` : ""}</li>`
        );
    }
    container.innerHTML = `
        <div>
            <h3>Venda selecionada</h3>
            <ul>
                <li><strong>Data:</strong> ${formatDate(operation.data)}</li>
                <li><strong>Placa:</strong> ${operation.placa || "-"}</li>
                <li><strong>Modelo:</strong> ${operation.modelo || operation.veiculo || "-"}</li>
                <li><strong>Valor da venda:</strong> ${formatCurrency(operation.valorVenda || 0)}</li>
                <li><strong>Valor da compra:</strong> ${formatCurrency(operation.valorCompra || 0)}</li>
                <li><strong>Forma de pagamento:</strong> ${
                    paymentType === "parcelado" ? "Parcelado" : "À vista"
                }</li>
                <li><strong>Entrada:</strong> ${formatCurrency(entryValue)}</li>
                <li><strong>Parcelamento:</strong> ${parcelLabel}</li>
                ${
                    paymentType === "parcelado"
                        ? `
                            <li><strong>Saldo parcelado:</strong> ${formatCurrency(
                                financed
                            )}</li>
                            <li><strong>Dia de vencimento:</strong> ${
                                dueDayValue || "—"
                            }</li>
                            <li><strong>1ª parcela:</strong> ${
                                firstDue ? formatDate(firstDue) : "—"
                            }</li>
                            <li><strong>Última parcela:</strong> ${
                                lastDue ? formatDate(lastDue) : "—"
                            }</li>
                          `
                        : ""
                }
            </ul>
        </div>
        <div>
            <h3>Cliente selecionado</h3>
            <ul>
                <li><strong>Nome:</strong> ${client.nome || "-"}</li>
                <li><strong>CPF:</strong> ${client.cpf || "-"}</li>
                <li><strong>RG:</strong> ${client.rg || "-"}</li>
                <li><strong>Contato:</strong> ${client.contato || "-"}</li>
                <li><strong>Endereço:</strong> ${client.endereco || "-"}</li>
            </ul>
        </div>
        ${
            witnessDetails.length
                ? `<div><h3>Testemunhas</h3><ul>${witnessDetails.join("")}</ul></div>`
                : ""
        }
    `;
};

const handleOperationChange = () => {
    updatePaymentFieldState();
    autofillClient();
    renderPreview();
};

const handleClientChange = () => {
    renderPreview();
};

const handleInstallmentChange = () => {
    updateInstallmentNote();
    renderPreview();
};

const handlePaymentTypeChange = () => {
    updatePaymentFieldState();
    renderPreview();
};

const handleEntryInput = () => {
    if (getPaymentType() !== "parcelado") return;
    const input = contractElements.paymentValueInput;
    if (!input) return;
    const cleaned = input.value.replace(/[^\d]/g, "");
    const saleValue = getSaleValue();
    let numeric = Number(cleaned) / 100;
    numeric = Math.min(Math.max(numeric, 0), saleValue);
    input.dataset.rawValue = numeric > 0 ? numeric.toString() : "";
    input.value = numeric > 0 ? formatCurrencyInput(numeric) : "";
    updateInstallmentOptions();
    renderPreview();
};

const handleEntryBlur = () => {
    if (getPaymentType() !== "parcelado") return;
    if (!contractElements.paymentValueInput) return;
    const entry = getEntryValue();
    contractElements.paymentValueInput.dataset.rawValue =
        entry > 0 ? entry.toString() : "";
    contractElements.paymentValueInput.value =
        entry > 0 ? formatCurrency(entry) : "";
    updateInstallmentOptions();
    renderPreview();
};

const handleDueInputsChange = (event) => {
    if (getPaymentType() !== "parcelado") return;
    renderPreview();
};

const handleFormSubmit = async (event) => {
    event.preventDefault();
    const operationId = contractElements.operationSelect?.value;
    const clientId = contractElements.clientSelect?.value;
    const installments = getSelectedInstallments();
    const paymentType = getPaymentType();
    const entryValue = getEntryValue();
    const dueDay = getDueDayValue();
    const firstDueDate = getDueDateValue(contractElements.firstDueInput);
    const lastDueDate =
        firstDueDate && installments > 0
            ? addMonthsToDate(firstDueDate, installments - 1)
            : "";
    const witnessData = getWitnessData();
    if (!operationId || !clientId) {
        showContractToast("Selecione uma venda e um cliente.", "error");
        return;
    }
    try {
        const response = await fetch(API_CONTRACT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                operationId,
                clientId,
                installments,
                paymentType,
                entryValue,
                dueDay,
                firstDueDate,
                lastDueDate,
                ...witnessData,
            }),
        });
        if (!response.ok) {
            throw new Error("Falha ao gerar contrato.");
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const operation = stateContract.operations.find(
            (item) => item.id === operationId
        );
        const fileName = `contrato-${
            operation?.placa || "venda"
        }.docx`.replace(/\s+/g, "-");
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showContractToast("Contrato gerado com sucesso.");
    } catch (error) {
        console.error(error);
        showContractToast("Erro ao gerar contrato.", "error");
    }
};

const initContractPage = async () => {
    try {
        await Promise.all([loadOperations(), loadClients()]);
        populateOperationSelect();
        populateClientSelect();
        updatePaymentFieldState();
        renderPreview();
    } catch (error) {
        console.error(error);
        showContractToast(error.message || "Erro ao iniciar a página.", "error");
    }

    contractElements.operationSelect?.addEventListener(
        "change",
        handleOperationChange
    );
    contractElements.clientSelect?.addEventListener(
        "change",
        handleClientChange
    );
    contractElements.installmentsSelect?.addEventListener(
        "change",
        handleInstallmentChange
    );
    contractElements.paymentType?.addEventListener(
        "change",
        handlePaymentTypeChange
    );
    contractElements.paymentValueInput?.addEventListener("input", handleEntryInput);
    contractElements.paymentValueInput?.addEventListener("blur", handleEntryBlur);
    contractElements.dueDayInput?.addEventListener("input", handleDueInputsChange);
    contractElements.firstDueInput?.addEventListener(
        "change",
        handleDueInputsChange
    );
    [
        contractElements.witness1Name,
        contractElements.witness1Cpf,
        contractElements.witness2Name,
        contractElements.witness2Cpf,
    ].forEach((input) => {
        input?.addEventListener("input", renderPreview);
    });
    contractElements.form?.addEventListener("submit", handleFormSubmit);
};

document.addEventListener("DOMContentLoaded", initContractPage);
    attachCpfMask(contractElements.witness1Cpf);
    attachCpfMask(contractElements.witness2Cpf);
