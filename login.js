const AUTH_USER = "admin";
const AUTH_PASSWORD = "123456";

const loginForm = document.getElementById("login-form");
const feedback = document.getElementById("login-feedback");
const toastElement = document.getElementById("toast");
let toastTimeout = null;

const showFeedback = (message) => {
    if (feedback) {
        feedback.textContent = message;
    }
};

const showToast = (message) => {
    if (!toastElement) return;
    toastElement.textContent = message;
    toastElement.classList.remove("toast-error");
    toastElement.classList.add("visible");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toastElement.classList.remove("visible");
    }, 2000);
};

const redirectIfAuthenticated = () => {
    if (window.auth?.isAuthenticated?.()) {
        window.location.href = "index.html";
    }
};

const handleLoginSubmit = (event) => {
    event.preventDefault();
    const data = new FormData(loginForm);
    const username = data.get("username")?.trim();
    const password = data.get("password")?.trim();

    if (username === AUTH_USER && password === AUTH_PASSWORD) {
        window.auth?.login?.(username);
        showToast("Login realizado com sucesso.");
        setTimeout(() => {
            window.location.href = "historico.html";
        }, 400);
    } else {
        showFeedback("Usuário ou senha inválidos.");
    }
};

document.addEventListener("DOMContentLoaded", () => {
    redirectIfAuthenticated();
    loginForm?.addEventListener("submit", handleLoginSubmit);
});
