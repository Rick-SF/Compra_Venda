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

const attachLogoutHandlers = () => {
    document.querySelectorAll("[data-logout]").forEach((button) => {
        button.addEventListener("click", (event) => {
            event.preventDefault();
            auth.logout();
        });
    });
};

document.addEventListener("DOMContentLoaded", attachLogoutHandlers);

window.auth = auth;
