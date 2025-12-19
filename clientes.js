const CLIENTS_KEY = "veiculos-clients";

const stateClients = {
    clients: [],
};

const clientElements = {
    form: document.getElementById("client-form"),
    tableBody: document.getElementById("clients-table"),
};
const clientModal = {
    container: document.getElementById("client-modal"),
    form: document.getElementById("client-modal-form"),
    title: document.getElementById("client-modal-title"),
    closeButtons: document.querySelectorAll("[data-close-client]"),
};
let clientModalId = null;
const clientConfirmModal = {
    container: document.getElementById("client-confirm-modal"),
    message: document.getElementById("client-confirm-message"),
    confirmBtn: document.querySelector("[data-client-confirm='true']"),
    cancelBtn: document.querySelector("[data-client-confirm='false']"),
    closeBtn: document.querySelector("[data-close-client-confirm]"),
};
let clientConfirmCallback = null;
const toastElement = document.getElementById("toast");
let toastTimeout = null;

const getClientStorage = () => {
    try {
        return typeof window !== "undefined" && window.localStorage
            ? window.localStorage
            : null;
    } catch {
        return null;
    }
};

const loadClients = () => {
    const storage = getClientStorage();
    if (!storage) return [];
    try {
        const raw = storage.getItem(CLIENTS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const persistClients = () => {
    const storage = getClientStorage();
    if (!storage) return;
    try {
        storage.setItem(CLIENTS_KEY, JSON.stringify(stateClients.clients));
    } catch {
        // ignore
    }
};

const formatDocument = (value) => value?.toString().trim() || "";

const clientModalFields = [
    { name: "nome", label: "Nome completo", type: "text", required: true },
    { name: "cpf", label: "CPF", type: "text", required: true },
    { name: "rg", label: "RG", type: "text" },
    { name: "cnh", label: "CNH", type: "text" },
    { name: "endereco", label: "Endereço", type: "text" },
    { name: "contato", label: "Contato", type: "text", required: true },
    { name: "email", label: "E-mail", type: "email" },
];

const escapeClientValue = (value) =>
    value ? value.toString().replace(/"/g, "&quot;") : "";

const buildClientModalForm = (client = {}) =>
    clientModalFields
        .map((field) => {
            const required = field.required ? "required" : "";
            return `
                <label class="${field.name === "endereco" ? "wide" : ""}">
                    ${field.label}
                    <input type="${field.type}" name="${field.name}" value="${escapeClientValue(
                client[field.name] || ""
            )}" ${required}>
                </label>
            `;
        })
        .join("");

const renderClients = () => {
    const tbody = clientElements.tableBody;
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!stateClients.clients.length) {
        tbody.innerHTML =
            '<tr class="placeholder"><td colspan="8">Nenhum cliente cadastrado.</td></tr>';
        return;
    }

    stateClients.clients.forEach((client) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${client.nome || "—"}</td>
            <td>${client.cpf || "—"}</td>
            <td>${client.rg || "—"}</td>
            <td>${client.cnh || "—"}</td>
            <td>${client.endereco || "—"}</td>
            <td>${client.contato || "—"}</td>
            <td>${client.email || "—"}</td>
            <td class="actions-cell">
                <button class="table-button edit" data-action="edit-client" data-id="${client.id}">
                    Editar
                </button>
                <button class="table-button delete" data-action="delete-client" data-id="${client.id}">
                    Excluir
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

const openClientModal = (client) => {
    if (!clientModal.container || !clientModal.form) return;
    clientModalId = client.id;
    clientModal.title.textContent = `Editar ${client.nome || "cliente"}`;
    clientModal.form.innerHTML = buildClientModalForm(client);
    clientModal.container.classList.add("visible");
    document.body.style.overflow = "hidden";
};

const closeClientModal = () => {
    if (!clientModal.container || !clientModal.form) return;
    clientModal.container.classList.remove("visible");
    clientModal.form.innerHTML = "";
    clientModalId = null;
    document.body.style.overflow = "";
};

clientModal.closeButtons?.forEach((button) =>
    button.addEventListener("click", closeClientModal)
);
clientModal.container?.addEventListener("click", (event) => {
    if (event.target === clientModal.container) {
        closeClientModal();
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && clientModal.container?.classList.contains("visible")) {
        closeClientModal();
    }
});

clientModal.form?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!clientModalId) return;
    const data = new FormData(clientModal.form);
    const updated = {
        nome: data.get("nome")?.trim(),
        cpf: formatDocument(data.get("cpf")),
        rg: formatDocument(data.get("rg")),
        cnh: formatDocument(data.get("cnh")),
        endereco: data.get("endereco")?.trim(),
        contato: data.get("contato")?.trim(),
        email: data.get("email")?.trim(),
    };
    stateClients.clients = stateClients.clients.map((client) =>
        client.id === clientModalId ? { ...client, ...updated } : client
    );
    persistClients();
    renderClients();
    closeClientModal();
});

const openClientConfirm = (message, callback) => {
    if (!clientConfirmModal.container || !clientConfirmModal.message) return;
    clientConfirmModal.message.textContent = message;
    clientConfirmModal.container.classList.add("visible");
    document.body.style.overflow = "hidden";
    clientConfirmCallback = callback;
};

const closeClientConfirm = () => {
    if (!clientConfirmModal.container) return;
    clientConfirmModal.container.classList.remove("visible");
    document.body.style.overflow = "";
    clientConfirmCallback = null;
};

clientConfirmModal.confirmBtn?.addEventListener("click", () => {
    if (clientConfirmCallback) clientConfirmCallback();
    closeClientConfirm();
});
clientConfirmModal.cancelBtn?.addEventListener("click", closeClientConfirm);
clientConfirmModal.closeBtn?.addEventListener("click", closeClientConfirm);
clientConfirmModal.container?.addEventListener("click", (event) => {
    if (event.target === clientConfirmModal.container) closeClientConfirm();
});
document.addEventListener("keydown", (event) => {
    if (
        event.key === "Escape" &&
        clientConfirmModal.container?.classList.contains("visible")
    ) {
        closeClientConfirm();
    }
});

const showClientToast = (message, variant = "success") => {
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

const handleClientSubmit = (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const client = {
        id: `${Date.now().toString(36)}-${Math.random()
            .toString(36)
            .slice(2, 8)}`,
        nome: data.get("nome")?.trim(),
        cpf: formatDocument(data.get("cpf")),
        rg: formatDocument(data.get("rg")),
        cnh: formatDocument(data.get("cnh")),
        endereco: data.get("endereco")?.trim(),
        contato: data.get("contato")?.trim(),
        email: data.get("email")?.trim(),
    };
    stateClients.clients.unshift(client);
    persistClients();
    renderClients();
    event.currentTarget.reset();
};

const deleteClient = (id) => {
    stateClients.clients = stateClients.clients.filter(
        (client) => client.id !== id
    );
    if (clientModalId === id) {
        closeClientModal();
    }
    persistClients();
    renderClients();
    showClientToast("Cliente excluído com sucesso.");
};

const initClients = () => {
    stateClients.clients = loadClients();
    if (clientElements.form) {
        clientElements.form.addEventListener("submit", handleClientSubmit);
    }
    if (clientElements.tableBody) {
        clientElements.tableBody.addEventListener("click", (event) => {
            const button = event.target.closest("[data-action]");
            if (!button) return;
            const { id, action } = button.dataset;
            if (!id) return;
            if (action === "delete-client") {
                openClientConfirm("Deseja remover este cliente da base?", () =>
                    deleteClient(id)
                );
            } else if (action === "edit-client") {
                const client = stateClients.clients.find(
                    (item) => item.id === id
                );
                if (client) {
                    openClientModal(client);
                }
            }
        });
    }
    renderClients();
};

document.addEventListener("DOMContentLoaded", initClients);
