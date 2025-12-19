const CLIENTS_KEY = "veiculos-clients";

const stateClients = {
    clients: [],
};

const clientElements = {
    form: document.getElementById("client-form"),
    tableBody: document.getElementById("clients-table"),
};

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
                <button class="table-button" data-action="delete-client" data-id="${client.id}">
                    Excluir
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
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
    persistClients();
    renderClients();
};

const initClients = () => {
    stateClients.clients = loadClients();
    if (clientElements.form) {
        clientElements.form.addEventListener("submit", handleClientSubmit);
    }
    if (clientElements.tableBody) {
        clientElements.tableBody.addEventListener("click", (event) => {
            const button = event.target.closest("[data-action='delete-client']");
            if (!button) return;
            const { id } = button.dataset;
            if (!id) return;
            const confirmed = window.confirm(
                "Deseja remover este cliente da base?"
            );
            if (!confirmed) return;
            deleteClient(id);
        });
    }
    renderClients();
};

document.addEventListener("DOMContentLoaded", initClients);
