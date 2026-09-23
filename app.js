const SUPABASE_URL = "https://skrbmtanugilgxfzflyf.supabase.co";
const SUPABASE_KEY = "sb_publishable_Acs-wmNpLpDCoiORLlUZtg_7oVBvHfd";

const REST_URL = SUPABASE_URL + "/rest/v1";
const AUTH_URL = SUPABASE_URL + "/auth/v1";
const STORAGE_URL = SUPABASE_URL + "/storage/v1";

const SESSION_KEY = "system_silence_supabase_session";

let currentUser = null;
let currentSession = null;
let currentAdmin = false;
let plugins = [];
let loginMode = "login";

const loginButton = document.getElementById("loginButton");
const logoutButton = document.getElementById("logoutButton");
const userEmail = document.getElementById("userEmail");

const loginModal = document.getElementById("loginModal");
const closeLogin = document.getElementById("closeLogin");
const authForm = document.getElementById("authForm");
const authTitle = document.getElementById("authTitle");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authSubmit = document.getElementById("authSubmit");
const switchAuth = document.getElementById("switchAuth");

const publishButton = document.getElementById("publishButton");
const publishModal = document.getElementById("publishModal");
const closeModal = document.getElementById("closeModal");
const pluginForm = document.getElementById("pluginForm");
const pluginsContainer = document.getElementById("plugins");
const searchInput = document.getElementById("search");
const countElement = document.getElementById("count");
const toast = document.getElementById("toast");

function publicHeaders() {
    return {
        "apikey": SUPABASE_KEY,
        "Content-Type": "application/json"
    };
}

function authHeaders() {
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": "Bearer " + currentSession.access_token,
        "Content-Type": "application/json"
    };
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

function openModal(element) {
    element.classList.remove("hidden");
}

function closeModalWindow(element) {
    element.classList.add("hidden");
}

function saveSession(session) {
    if (session) {
        localStorage.setItem(
            SESSION_KEY,
            JSON.stringify(session)
        );
    } else {
        localStorage.removeItem(SESSION_KEY);
    }
}

function getSavedSession() {
    try {
        const saved = localStorage.getItem(SESSION_KEY);

        if (!saved) {
            return null;
        }

        return JSON.parse(saved);
    } catch {
        localStorage.removeItem(SESSION_KEY);
        return null;
    }
}

async function authRequest(path, options = {}) {
    const headers = {
        "apikey": SUPABASE_KEY,
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    const response = await fetch(
        AUTH_URL + path,
        {
            ...options,
            headers
        }
    );

    let data = null;

    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        const message =
            data?.msg ||
            data?.message ||
            data?.error_description ||
            data?.error ||
            "Erro de autenticação.";

        throw new Error(message);
    }

    return data;
}

async function signIn(email, password) {
    const data = await authRequest(
        "/token?grant_type=password",
        {
            method: "POST",
            body: JSON.stringify({
                email,
                password
            })
        }
    );

    currentSession = data;
    currentUser = data.user;

    saveSession(data);

    await updateUser();

    closeModalWindow(loginModal);

    authForm.reset();

    showToast("Login realizado com sucesso.");

    await loadPlugins();
}

async function signUp(email, password) {
    const data = await authRequest(
        "/signup",
        {
            method: "POST",
            body: JSON.stringify({
                email,
                password
            })
        }
    );

    if (data.access_token) {
        currentSession = data;
        currentUser = data.user;

        saveSession(data);

        await updateUser();

        closeModalWindow(loginModal);

        authForm.reset();

        showToast("Conta criada com sucesso.");

        await loadPlugins();
    } else {
        showToast(
            "Conta criada. Verifique seu email para confirmar a conta."
        );

        switchLoginMode();
    }
}

async function signOut() {
    if (currentSession?.access_token) {
        try {
            await fetch(
                AUTH_URL + "/logout",
                {
                    method: "POST",
                    headers: {
                        "apikey": SUPABASE_KEY,
                        "Authorization":
                            "Bearer " + currentSession.access_token
                    }
                }
            );
        } catch {
        }
    }

    currentSession = null;
    currentUser = null;
    currentAdmin = false;

    saveSession(null);

    updateUserUI();

    showToast("Você saiu da conta.");
}

async function refreshSession() {
    if (!currentSession?.refresh_token) {
        return false;
    }

    try {
        const data = await authRequest(
            "/token?grant_type=refresh_token",
            {
                method: "POST",
                body: JSON.stringify({
                    refresh_token: currentSession.refresh_token
                })
            }
        );

        currentSession = data;
        currentUser = data.user;

        saveSession(data);

        return true;
    } catch {
        currentSession = null;
        currentUser = null;
        currentAdmin = false;

        saveSession(null);

        return false;
    }
}

async function loadSession() {
    const saved = getSavedSession();

    if (!saved) {
        updateUserUI();
        return;
    }

    currentSession = saved;
    currentUser = saved.user || null;

    if (
        currentSession.expires_at &&
        Date.now() / 1000 >= currentSession.expires_at - 60
    ) {
        const refreshed = await refreshSession();

        if (!refreshed) {
            updateUserUI();
            return;
        }
    }

    updateUserUI();

    await updateUser();
}

async function updateUser() {
    if (!currentSession?.access_token) {
        currentUser = null;
        currentAdmin = false;
        updateUserUI();
        return;
    }

    try {
        const response = await fetch(
            AUTH_URL + "/user",
            {
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization":
                        "Bearer " + currentSession.access_token
                }
            }
        );

        if (!response.ok) {
            const refreshed = await refreshSession();

            if (!refreshed) {
                currentUser = null;
                currentAdmin = false;
                updateUserUI();
                return;
            }

            return await updateUser();
        }

        currentUser = await response.json();

        currentAdmin = false;

        try {
            const profileResponse = await fetch(
                REST_URL +
                "/profiles?id=eq." +
                encodeURIComponent(currentUser.id) +
                "&select=is_admin",
                {
                    headers: authHeaders()
                }
            );

            if (profileResponse.ok) {
                const profiles = await profileResponse.json();

                if (
                    profiles.length > 0 &&
                    profiles[0].is_admin === true
                ) {
                    currentAdmin = true;
                }
            }
        } catch {
            currentAdmin = false;
        }

        updateUserUI();

        renderPlugins();
    } catch {
        currentAdmin = false;
        updateUserUI();
    }
}

function updateUserUI() {
    if (currentUser) {
        userEmail.textContent =
            currentUser.email || "Usuário";

        loginButton.classList.add("hidden");
        logoutButton.classList.remove("hidden");
    } else {
        userEmail.textContent = "";

        loginButton.classList.remove("hidden");
        logoutButton.classList.add("hidden");
    }
}

function switchLoginMode() {
    if (loginMode === "login") {
        loginMode = "signup";

        authTitle.textContent = "Criar conta";
        authSubmit.textContent = "Criar conta";
        switchAuth.textContent = "Já tenho uma conta";
    } else {
        loginMode = "login";

        authTitle.textContent = "Login";
        authSubmit.textContent = "Entrar";
        switchAuth.textContent = "Criar uma conta";
    }
}

loginButton.onclick = function () {
    loginMode = "login";

    authTitle.textContent = "Login";
    authSubmit.textContent = "Entrar";
    switchAuth.textContent = "Criar uma conta";

    authEmail.value = "";
    authPassword.value = "";

    openModal(loginModal);
};

closeLogin.onclick = function () {
    closeModalWindow(loginModal);
};

switchAuth.onclick = function () {
    switchLoginMode();
};

loginModal.onclick = function (event) {
    if (event.target === loginModal) {
        closeModalWindow(loginModal);
    }
};

authForm.onsubmit = async function (event) {
    event.preventDefault();

    const email = authEmail.value.trim();
    const password = authPassword.value;

    if (!email || !password) {
        showToast("Preencha email e senha.");
        return;
    }

    authSubmit.disabled = true;
    authSubmit.textContent =
        loginMode === "login"
            ? "Entrando..."
            : "Criando...";

    try {
        if (loginMode === "login") {
            await signIn(email, password);
        } else {
            await signUp(email, password);
        }
    } catch (error) {
        let message = error.message;

        if (
            message.toLowerCase().includes("invalid login credentials")
        ) {
            message = "Email ou senha incorretos.";
        }

        if (
            message.toLowerCase().includes("email not confirmed")
        ) {
            message = "Confirme seu email antes de entrar.";
        }

        if (
            message.toLowerCase().includes("user already registered")
        ) {
            message = "Este email já possui uma conta.";
        }

        showToast(message);
    } finally {
        authSubmit.disabled = false;

        authSubmit.textContent =
            loginMode === "login"
                ? "Entrar"
                : "Criar conta";
    }
};

logoutButton.onclick = async function () {
    logoutButton.disabled = true;

    await signOut();

    logoutButton.disabled = false;
};

publishButton.onclick = function () {
    if (!currentUser) {
        openModal(loginModal);
        showToast("Faça login para publicar um plugin.");
        return;
    }

    openModal(publishModal);
};

closeModal.onclick = function () {
    closeModalWindow(publishModal);
};

publishModal.onclick = function (event) {
    if (event.target === publishModal) {
        closeModalWindow(publishModal);
    }
};

async function loadPlugins() {
    pluginsContainer.innerHTML = `
        <div class="loading">
            Carregando plugins...
        </div>
    `;

    try {
        const response = await fetch(
            REST_URL +
            "/plugins?select=*&order=created_at.desc",
            {
                headers: publicHeaders()
            }
        );

        if (!response.ok) {
            throw new Error(
                "Não foi possível carregar os plugins."
            );
        }

        plugins = await response.json();

        renderPlugins();
    } catch (error) {
        pluginsContainer.innerHTML = `
            <div class="loading">
                ${escapeHTML(error.message)}
            </div>
        `;

        countElement.textContent = "0 plugins";
    }
}

function renderPlugins() {
    const search = searchInput.value
        .trim()
        .toLowerCase();

    const filtered = plugins.filter(plugin => {
        const name = String(plugin.name || "")
            .toLowerCase();

        const description = String(plugin.description || "")
            .toLowerCase();

        return (
            name.includes(search) ||
            description.includes(search)
        );
    });

    countElement.textContent =
        filtered.length +
        (filtered.length === 1 ? " plugin" : " plugins");

    if (filtered.length === 0) {
        pluginsContainer.innerHTML = `
            <div class="loading">
                Nenhum plugin encontrado.
            </div>
        `;

        return;
    }

    pluginsContainer.innerHTML = "";

    for (const plugin of filtered) {
        const card = document.createElement("div");

        card.className = "pluginCard";

        const name = escapeHTML(
            plugin.name || "Plugin sem nome"
        );

        const description = escapeHTML(
            plugin.description || "Sem descrição."
        );

        const version = escapeHTML(
            plugin.version || "1.0.0"
        );

        const owner = escapeHTML(
            plugin.owner_email || "Desconhecido"
        );

        card.innerHTML = `
            <div class="pluginTop">
                <div>
                    <h3>${name}</h3>
                    <span class="version">
                        v${version}
                    </span>
                </div>
            </div>

            <p>${description}</p>

            <div class="pluginOwner">
                Publicado por ${owner}
            </div>

            <button
                class="installButton"
                type="button"
            >
                Instalar
            </button>
        `;

        const install = card.querySelector(
            ".installButton"
        );

        install.onclick = function () {
            installPlugin(plugin);
        };

        if (
            currentUser &&
            (
                currentAdmin ||
                currentUser.id === plugin.owner_id
            )
        ) {
            const deleteButton =
                document.createElement("button");

            deleteButton.className = "deleteButton";
            deleteButton.type = "button";
            deleteButton.textContent = "Excluir plugin";

            deleteButton.onclick = function () {
                deletePlugin(plugin);
            };

            card.appendChild(deleteButton);
        }

        pluginsContainer.appendChild(card);
    }
}

async function installPlugin(plugin) {
    if (!plugin.file_path) {
        showToast("Arquivo do plugin não encontrado.");
        return;
    }

    try {
        showToast("Baixando plugin...");

        const response = await fetch(
            STORAGE_URL +
            "/object/public/plugins/" +
            plugin.file_path
        );

        if (!response.ok) {
            throw new Error(
                "Não foi possível baixar o plugin."
            );
        }

        const blob = await response.blob();

        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");

        link.href = url;

        link.download =
            plugin.file_name ||
            "plugin.js";

        document.body.appendChild(link);

        link.click();

        link.remove();

        URL.revokeObjectURL(url);

        await increaseDownloads(plugin);

        showToast("Plugin baixado.");
    } catch (error) {
        showToast(error.message);
    }
}

async function increaseDownloads(plugin) {
    if (!plugin.id) {
        return;
    }

    const currentDownloads =
        Number(plugin.downloads || 0);

    try {
        const response = await fetch(
            REST_URL +
            "/plugins?id=eq." +
            encodeURIComponent(plugin.id),
            {
                method: "PATCH",
                headers: publicHeaders(),
                body: JSON.stringify({
                    downloads: currentDownloads + 1
                })
            }
        );

        if (response.ok) {
            plugin.downloads =
                currentDownloads + 1;
        }
    } catch {
    }
}

async function deletePlugin(plugin) {
    if (!currentUser) {
        showToast("Faça login primeiro.");
        return;
    }

    const isOwner =
        currentUser.id === plugin.owner_id;

    if (!isOwner && !currentAdmin) {
        showToast(
            "Você não pode excluir este plugin."
        );
        return;
    }

    const confirmed = confirm(
        'Excluir o plugin "' +
        (plugin.name || "sem nome") +
        '"?'
    );

    if (!confirmed) {
        return;
    }

    try {
        showToast("Excluindo plugin...");

        if (plugin.file_path) {
            const storageResponse = await fetch(
                STORAGE_URL + "/object/plugins",
                {
                    method: "DELETE",
                    headers: authHeaders(),
                    body: JSON.stringify({
                        prefixes: [
                            plugin.file_path
                        ]
                    })
                }
            );

            if (
                !storageResponse.ok &&
                storageResponse.status !== 404
            ) {
                let storageError = "";

                try {
                    const data =
                        await storageResponse.json();

                    storageError =
                        data.message ||
                        data.error ||
                        "";
                } catch {
                }

                throw new Error(
                    storageError ||
                    "Não foi possível excluir o arquivo."
                );
            }
        }

        const response = await fetch(
            REST_URL +
            "/plugins?id=eq." +
            encodeURIComponent(plugin.id),
            {
                method: "DELETE",
                headers: authHeaders()
            }
        );

        if (!response.ok) {
            let errorMessage =
                "Não foi possível excluir o plugin.";

            try {
                const data =
                    await response.json();

                errorMessage =
                    data.message ||
                    data.error ||
                    errorMessage;
            } catch {
            }

            throw new Error(errorMessage);
        }

        plugins =
            plugins.filter(
                item => item.id !== plugin.id
            );

        renderPlugins();

        showToast("Plugin excluído.");
    } catch (error) {
        showToast(error.message);
    }
}

pluginForm.onsubmit = async function (event) {
    event.preventDefault();

    if (!currentUser || !currentSession) {
        showToast("Faça login para publicar.");
        return;
    }

    const name =
        document.getElementById("pluginName")
            .value.trim();

    const description =
        document.getElementById("pluginDescription")
            .value.trim();

    const version =
        document.getElementById("pluginVersion")
            .value.trim();

    const fileInput =
        document.getElementById("pluginFile");

    const file = fileInput.files[0];

    if (!file) {
        showToast("Selecione um arquivo .js.");
        return;
    }

    if (!file.name.toLowerCase().endsWith(".js")) {
        showToast("O arquivo precisa ser JavaScript.");
        return;
    }

    if (file.size > 1024 * 1024) {
        showToast(
            "O plugin não pode ter mais de 1 MB."
        );
        return;
    }

    const submitButton =
        document.getElementById("submitButton");

    submitButton.disabled = true;
    submitButton.textContent = "Publicando...";

    let uploadedPath = null;

    try {
        const safeFileName =
            file.name
                .replace(/[^a-zA-Z0-9._-]/g, "_")
                .replace(/\.{2,}/g, ".");

        const folder =
            currentUser.id +
            "/" +
            crypto.randomUUID();

        uploadedPath =
            folder +
            "/" +
            Date.now() +
            "-" +
            safeFileName;

        const uploadResponse = await fetch(
            STORAGE_URL +
            "/object/plugins/" +
            uploadedPath,
            {
                method: "POST",
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization":
                        "Bearer " +
                        currentSession.access_token,
                    "Content-Type":
                        file.type ||
                        "application/javascript",
                    "x-upsert": "false"
                },
                body: file
            }
        );

        if (!uploadResponse.ok) {
            let message =
                "Não foi possível enviar o arquivo.";

            try {
                const data =
                    await uploadResponse.json();

                message =
                    data.message ||
                    data.error ||
                    message;
            } catch {
            }

            throw new Error(message);
        }

        const insertResponse = await fetch(
            REST_URL + "/plugins",
            {
                method: "POST",
                headers: {
                    ...authHeaders(),
                    "Prefer": "return=representation"
                },
                body: JSON.stringify({
                    name,
                    description,
                    version,
                    category: "community",
                    file_path: uploadedPath,
                    file_name: file.name,
                    downloads: 0,
                    owner_id: currentUser.id,
                    owner_email: currentUser.email
                })
            }
        );

        if (!insertResponse.ok) {
            let message =
                "Não foi possível salvar o plugin.";

            try {
                const data =
                    await insertResponse.json();

                message =
                    data.message ||
                    data.error ||
                    message;
            } catch {
            }

            throw new Error(message);
        }

        closeModalWindow(publishModal);

        pluginForm.reset();

        showToast("Plugin publicado com sucesso.");

        await loadPlugins();
    } catch (error) {
        if (uploadedPath) {
            try {
                await fetch(
                    STORAGE_URL +
                    "/object/plugins",
                    {
                        method: "DELETE",
                        headers: authHeaders(),
                        body: JSON.stringify({
                            prefixes: [
                                uploadedPath
                            ]
                        })
                    }
                );
            } catch {
            }
        }

        showToast(error.message);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Publicar";
    }
};

searchInput.oninput = function () {
    renderPlugins();
};

function escapeHTML(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

async function start() {
    await loadSession();
    await loadPlugins();
}

start();
