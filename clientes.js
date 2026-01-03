const API_BASE = "/api";
const API_CLIENTS = `${API_BASE}/clients`;

const stateClients = {
    clients: [],
    loading: false,
};

const CLIENT_FORM_DRAFT_KEY = "veiculos-draft-client";

const stripNonDigits = (value, limit) => {
    const digits = value ? value.toString().replace(/\D/g, "") : "";
    return typeof limit === "number" ? digits.slice(0, limit) : digits;
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

const formatCpfDisplay = (value) => {
    const digits = stripNonDigits(value, 11);
    if (!digits) return "";
    if (digits.length <= 3) return digits;
    if (digits.length <= 6)
        return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9)
        return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(
            6
        )}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(
        6,
        9
    )}-${digits.slice(9, 11)}`;
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
    cpf: (input) => {
        if (!input || input.dataset.maskAttached === "true") return;
        const handle = () => {
            input.value = formatCpfDisplay(input.value);
        };
        input.addEventListener("input", handle);
        input.dataset.maskAttached = "true";
        handle();
    },
};

const applyClientMasks = (root = document) => {
    Object.entries(maskHandlers).forEach(([mask, handler]) => {
        root
            .querySelectorAll(`[data-mask='${mask}']`)
            .forEach((input) => handler(input));
    });
};

const normalizeClientRecord = (client = {}) => ({
    ...client,
    cpf: stripNonDigits(client.cpf, 11),
    contato: stripNonDigits(client.contato, 11),
});

window.auth?.ensureAuth?.();

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

const getClientStorage = () => {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
};

const loadClientDraft = () => {
    const storage = getClientStorage();
    if (!clientElements.form || !storage) return;
    const raw = storage.getItem(CLIENT_FORM_DRAFT_KEY);
    if (!raw) return;
    let data;
    try {
        data = JSON.parse(raw);
    } catch {
        return;
    }
    Object.entries(data).forEach(([name, value]) => {
        const field = clientElements.form.elements.namedItem(name);
        if (field && typeof field.value !== "undefined") {
            field.value = value ?? "";
        }
    });
    applyClientMasks(clientElements.form);
};

const saveClientDraft = () => {
    const storage = getClientStorage();
    if (!clientElements.form || !storage) return;
    const formData = new FormData(clientElements.form);
    const data = {};
    formData.forEach((value, name) => {
        data[name] = value;
    });
    storage.setItem(CLIENT_FORM_DRAFT_KEY, JSON.stringify(data));
};

const resetClientDraft = () => {
    if (clientElements.form) {
        clientElements.form.reset();
    }
    const storage = getClientStorage();
    storage?.removeItem(CLIENT_FORM_DRAFT_KEY);
};

const setupClientDraftPersistence = () => {
    if (!clientElements.form) return;
    loadClientDraft();
    clientElements.form.addEventListener("input", saveClientDraft);
    clientElements.form.addEventListener("change", saveClientDraft);
};

const trimValue = (value) => value?.toString().trim() || "";

const parseClientFormData = (formData) => ({
    nome: trimValue(formData.get("nome")),
    cpf: stripNonDigits(formData.get("cpf"), 11),
    rg: trimValue(formData.get("rg")),
    cnh: trimValue(formData.get("cnh")),
    endereco: trimValue(formData.get("endereco")),
    nacionalidade: trimValue(formData.get("nacionalidade")),
    estadoCivil: trimValue(formData.get("estadoCivil")),
    profissao: trimValue(formData.get("profissao")),
    contato: stripNonDigits(formData.get("contato"), 11),
    email: trimValue(formData.get("email")),
    observacoes: trimValue(formData.get("observacoes")),
});

const displayClientValue = (value) => {
    if (value === null || value === undefined) return "—";
    const text = value.toString().trim();
    return text.length ? text : "—";
};

const displayCpfValue = (value) => {
    const digits = stripNonDigits(value, 11);
    return digits || "—";
};
const clientModalFields = [
    { name: "nome", label: "Nome completo", type: "text", required: true },
    { name: "cpf", label: "CPF", type: "text", required: true, mask: "cpf" },
    { name: "rg", label: "RG", type: "text" },
    { name: "cnh", label: "CNH", type: "text" },
    { name: "endereco", label: "Endereço", type: "text", wide: true },
    { name: "nacionalidade", label: "Nacionalidade", type: "text" },
    { name: "estadoCivil", label: "Estado civil", type: "text" },
    { name: "profissao", label: "Profissão", type: "text" },
    { name: "contato", label: "Contato", type: "text", required: true, mask: "phone" },
    { name: "email", label: "E-mail", type: "email" },
    { name: "observacoes", label: "Observações", type: "textarea" },
];

const escapeClientValue = (value) =>
    value ? value.toString().replace(/"/g, "&quot;") : "";

const formatValueForMask = (mask, value) => {
    if (!mask) return value ?? "";
    if (mask === "phone") {
        return formatPhoneDisplay(value);
    }
    if (mask === "cpf") {
        return formatCpfDisplay(value);
    }
    return value ?? "";
};

const buildClientModalForm = (client = {}) => {
    const fields = clientModalFields
        .map((field) => {
            const required = field.required ? "required" : "";
            const formattedValue = formatValueForMask(
                field.mask,
                client[field.name]
            );
            const value = escapeClientValue(formattedValue || "");
            const maskAttr = field.mask ? ` data-mask="${field.mask}"` : "";
            if (field.type === "textarea") {
                return `
                <label class="${field.wide ? "wide" : ""}">
                    ${field.label}
                    <textarea name="${field.name}" rows="3" ${required}>${value}</textarea>
                </label>
            `;
            }
            return `
                <label class="${field.wide ? "wide" : ""}">
                    ${field.label}
                    <input type="${field.type}" name="${field.name}" value="${value}" ${required}${maskAttr}>
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
            '<tr class="placeholder"><td colspan="12">Carregando clientes...</td></tr>';
        return;
    }

    if (!stateClients.clients.length) {
        tbody.innerHTML =
            '<tr class="placeholder"><td colspan="12">Nenhum cliente cadastrado.</td></tr>';
        return;
    }

    stateClients.clients.forEach((client) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${displayClientValue(client.nome)}</td>
            <td>${displayCpfValue(client.cpf)}</td>
            <td>${displayClientValue(client.rg)}</td>
            <td>${displayClientValue(client.cnh)}</td>
            <td>${displayClientValue(client.endereco)}</td>
            <td>${displayClientValue(client.nacionalidade)}</td>
            <td>${displayClientValue(client.estadoCivil)}</td>
            <td>${displayClientValue(client.profissao)}</td>
            <td>${displayClientValue(formatPhoneDisplay(client.contato))}</td>
            <td>${displayClientValue(client.email)}</td>
            <td><span class="notes">${displayClientValue(client.observacoes)}</span></td>
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
    applyClientMasks(clientModal.form);
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
            client.id === clientModalId ? normalizeClientRecord(updated) : client
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

document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-clear-form='client']");
    if (!button) return;
    resetClientDraft();
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
    if (
        payload.cpf &&
        stateClients.clients.some(
            (client) => client.cpf && client.cpf === payload.cpf
        )
    ) {
        showClientToast("Já existe um cliente cadastrado com este CPF.", "error");
        return;
    }
    try {
        const created = await jsonRequest(API_CLIENTS, {
            method: "POST",
            body: payload,
        });
        stateClients.clients.unshift(normalizeClientRecord(created));
        renderClients();
        resetClientDraft();
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
        stateClients.clients = Array.isArray(clients)
            ? clients.map(normalizeClientRecord)
            : [];
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
        setupClientDraftPersistence();
        applyClientMasks(clientElements.form);
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
