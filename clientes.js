const API_BASE = "/api";
const API_CLIENTS = `${API_BASE}/clients`;

const stateClients = {
    clients: [],
    loading: false,
};

const generateClientId = () =>
    typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const jsonRequest = async (url, options = {}) => {
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {}),
    };

    const config = {
        method: options.method || "GET",
        headers,
    };

    if (options.body !== undefined) {
        config.body =
            typeof options.body === "string"
                ? options.body
                : JSON.stringify(options.body);
    }

    const response = await fetch(url, config);
    if (!response.ok) {
        let message = "Erro ao comunicar com o servidor.";
        try {
            const error = await response.json();
            if (error?.message) message = error.message;
        } catch {
            // ignore JSON parse errors
        }
        throw new Error(message);
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
};

const fetchClients = () => jsonRequest(API_CLIENTS);

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

const formatDocument = (value) => value?.toString().trim() || "";

const parseClientFormData = (formData) => ({
    nome: formData.get("nome")?.trim(),
    cpf: formatDocument(formData.get("cpf")),
    rg: formatDocument(formData.get("rg")),
    cnh: formatDocument(formData.get("cnh")),
    endereco: formData.get("endereco")?.trim(),
    contato: formData.get("contato")?.trim(),
    email: formData.get("email")?.trim(),
});

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

const buildClientModalForm = (client = {}) => {
    const fields = clientModalFields
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

    return `
        ${fields}
        <div class="modal-actions">
            <button type="submit" class="primary">Salvar alterações</button>
        </div>
    `;
};

const renderClients = () => {
    const tbody = clientElements.tableBody;
    if (!tbody) return;
    tbody.innerHTML = "";

    if (stateClients.loading) {
        tbody.innerHTML =
            '<tr class="placeholder"><td colspan="8">Carregando clientes...</td></tr>';
        return;
    }

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

clientModal.form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!clientModalId) return;
    const formData = new FormData(clientModal.form);
    const payload = parseClientFormData(formData);
    try {
        const updated = await jsonRequest(`${API_CLIENTS}/${clientModalId}`, {
            method: "PUT",
            body: payload,
        });
        stateClients.clients = stateClients.clients.map((client) =>
            client.id === clientModalId ? updated : client
        );
        renderClients();
        showClientToast("Cliente atualizado com sucesso.");
        closeClientModal();
    } catch (error) {
        showClientToast(error.message, "error");
    }
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

clientConfirmModal.confirmBtn?.addEventListener("click", async () => {
    if (clientConfirmCallback) {
        try {
            await clientConfirmCallback();
        } catch (error) {
            showClientToast(error.message, "error");
        }
    }
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

const handleClientSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
        id: generateClientId(),
        ...parseClientFormData(data),
    };
    try {
        const created = await jsonRequest(API_CLIENTS, {
            method: "POST",
            body: payload,
        });
        stateClients.clients.unshift(created);
        renderClients();
        if (form?.reset) form.reset();
        showClientToast("Cliente cadastrado com sucesso.");
    } catch (error) {
        showClientToast(error.message, "error");
    }
};

const deleteClient = async (id) => {
    try {
        await jsonRequest(`${API_CLIENTS}/${id}`, { method: "DELETE" });
        stateClients.clients = stateClients.clients.filter(
            (client) => client.id !== id
        );
        if (clientModalId === id) {
            closeClientModal();
        }
        renderClients();
        showClientToast("Cliente excluído com sucesso.");
    } catch (error) {
        showClientToast(error.message, "error");
    }
};

const refreshClients = async () => {
    stateClients.loading = true;
    renderClients();
    try {
        const clients = await fetchClients();
        stateClients.clients = Array.isArray(clients) ? clients : [];
    } catch (error) {
        stateClients.clients = [];
        showClientToast(error.message, "error");
    } finally {
        stateClients.loading = false;
        renderClients();
    }
};

const initClients = async () => {
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
    await refreshClients();
};

document.addEventListener("DOMContentLoaded", () => {
    initClients().catch((error) => {
        console.error(error);
        showClientToast(error.message, "error");
    });
});
