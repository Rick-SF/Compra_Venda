const API_OPERATIONS = "/api/operations";
const API_CLIENTS = "/api/clients";
const API_CONTRACT = "/api/contracts/generate";

const stateContract = {
    operations: [],
    clients: [],
};

const contractElements = {
    form: document.getElementById("contract-form"),
    operationSelect: document.getElementById("contract-operation"),
    clientSelect: document.getElementById("contract-client"),
    preview: document.getElementById("preview-content"),
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
            '<option value="">Cadastre uma venda antes de gerar o contrato</option>';
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
        option.dataset.partner = operation.parceiro || "";
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
            '<option value="">Cadastre um cliente para gerar contratos</option>';
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
    const partnerName = normalizeText(selectedOperation.parceiro);
    if (!partnerName) return;

    const matchingOption = Array.from(clientSelect.options).find(
        (opt) => normalizeText(opt.textContent) === partnerName
    );
    if (matchingOption) {
        clientSelect.value = matchingOption.value;
    }
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
    container.innerHTML = `
        <div>
            <h3>Venda selecionada</h3>
            <ul>
                <li><strong>Data:</strong> ${formatDate(operation.data)}</li>
                <li><strong>Placa:</strong> ${operation.placa || "-"}</li>
                <li><strong>Modelo:</strong> ${operation.modelo || operation.veiculo || "-"}</li>
                <li><strong>Valor da venda:</strong> ${formatCurrency(operation.valorVenda || 0)}</li>
                <li><strong>Valor da compra:</strong> ${formatCurrency(operation.valorCompra || 0)}</li>
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
    `;
};

const handleOperationChange = () => {
    autofillClient();
    renderPreview();
};

const handleClientChange = () => {
    renderPreview();
};

const handleFormSubmit = async (event) => {
    event.preventDefault();
    const operationId = contractElements.operationSelect?.value;
    const clientId = contractElements.clientSelect?.value;
    if (!operationId || !clientId) {
        showContractToast("Selecione uma venda e um cliente.", "error");
        return;
    }
    try {
        const response = await fetch(API_CONTRACT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operationId, clientId }),
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
    contractElements.form?.addEventListener("submit", handleFormSubmit);
};

document.addEventListener("DOMContentLoaded", initContractPage);
