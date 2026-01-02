const AUTH_STORAGE_KEY = "veiculos-auth-session";

const safeLocalStorage = () => {
    try {
        return typeof window !== "undefined" ? window.localStorage : null;
    } catch {
        return null;
    }
};

const readSession = () => {
    const storage = safeLocalStorage();
    if (!storage) return null;
    try {
        const raw = storage.getItem(AUTH_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

const writeSession = (payload) => {
    const storage = safeLocalStorage();
    if (!storage) return;
    try {
        storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
    } catch {
        // ignore quota errors
    }
};

const clearSession = () => {
    const storage = safeLocalStorage();
    if (!storage) return;
    try {
        storage.removeItem(AUTH_STORAGE_KEY);
    } catch {
        // ignore
    }
};

const auth = {
    isAuthenticated: () => Boolean(readSession()),
    ensureAuth: () => {
        if (window.location.pathname.endsWith("login.html")) return;
        if (!auth.isAuthenticated()) {
            window.location.href = "login.html";
        }
    },
    login: (username) => {
        writeSession({
            username,
            loggedAt: new Date().toISOString(),
        });
    },
    logout: () => {
        clearSession();
        window.location.href = "login.html";
    },
};

const logoutModal = {
    container: null,
    confirmBtn: null,
    cancelBtn: null,
    closeBtn: null,
    resolve: null,
};

const ensureLogoutModal = () => {
    if (logoutModal.container) return;
    const container = document.createElement("div");
    container.className = "modal";
    container.id = "logout-modal";
    container.setAttribute("aria-hidden", "true");
    container.innerHTML = `
        <div class="modal-box confirm-box">
            <div class="modal-header">
                <h3>Deseja sair?</h3>
                <button class="modal-close" type="button" data-logout-close>&times;</button>
            </div>
            <p>Você realmente deseja encerrar a sessão atual?</p>
            <div class="confirm-actions">
                <button class="table-button edit" type="button" data-logout-action="cancel">
                    Continuar utilizando
                </button>
                <button class="table-button delete" type="button" data-logout-action="confirm">
                    Sair
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(container);
    logoutModal.container = container;
    logoutModal.confirmBtn = container.querySelector("[data-logout-action='confirm']");
    logoutModal.cancelBtn = container.querySelector("[data-logout-action='cancel']");
    logoutModal.closeBtn = container.querySelector("[data-logout-close]");

    const handleDecision = (confirmed) => {
        if (!logoutModal.container) return;
        logoutModal.container.classList.remove("visible");
        logoutModal.container.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
        if (logoutModal.resolve) {
            logoutModal.resolve(confirmed);
            logoutModal.resolve = null;
        }
    };

    logoutModal.confirmBtn?.addEventListener("click", () => handleDecision(true));
    logoutModal.cancelBtn?.addEventListener("click", () => handleDecision(false));
    logoutModal.closeBtn?.addEventListener("click", () => handleDecision(false));
    container.addEventListener("click", (event) => {
        if (event.target === container) {
            handleDecision(false);
        }
    });

    document.addEventListener("keydown", (event) => {
        if (
            event.key === "Escape" &&
            logoutModal.container?.classList.contains("visible")
        ) {
            handleDecision(false);
        }
    });

    logoutModal.handleDecision = handleDecision;
};

const openLogoutModal = () =>
    new Promise((resolve) => {
        ensureLogoutModal();
        logoutModal.resolve = resolve;
        logoutModal.container?.classList.add("visible");
        logoutModal.container?.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    });

const attachLogoutHandlers = () => {
    document.querySelectorAll("[data-logout]").forEach((button) => {
        button.addEventListener("click", async (event) => {
            event.preventDefault();
            const confirmed = await openLogoutModal();
            if (confirmed) {
                auth.logout();
            }
        });
    });
};

document.addEventListener("DOMContentLoaded", attachLogoutHandlers);

window.auth = auth;
