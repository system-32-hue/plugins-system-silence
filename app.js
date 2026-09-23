const SUPABASE_URL = "https://skrbmtanugilgxfzflyf.supabase.co";
const SUPABASE_KEY = "sb_publishable_Acs-wmNpLpDCoiORLlUZtg_7oVBvHfd";

const ADMIN_ID = "fe205ac8-20a3-4076-9c7b-a75b64f213bf";

const REST_URL = SUPABASE_URL + "/rest/v1";
const AUTH_URL = SUPABASE_URL + "/auth/v1";
const STORAGE_URL = SUPABASE_URL + "/storage/v1";

const SESSION_KEY = "system_silence_session";

let currentSession = null;
let currentUser = null;
let currentAdmin = false;
let plugins = [];
let loginMode = "login";
let editingPlugin = null;

const loginModal = document.getElementById("loginModal");
const publishModal = document.getElementById("publishModal");

const loginButton = document.getElementById("loginButton");
const logoutButton = document.getElementById("logoutButton");
const userEmail = document.getElementById("userEmail");

const authForm = document.getElementById("authForm");
const authTitle = document.getElementById("authTitle");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authSubmit = document.getElementById("authSubmit");
const switchAuth = document.getElementById("switchAuth");

const publishButton = document.getElementById("publishButton");
const pluginForm = document.getElementById("pluginForm");
const submitButton = document.getElementById("submitButton");

const searchInput = document.getElementById("search");
const pluginsContainer = document.getElementById("plugins");
const countElement = document.getElementById("count");
const toast = document.getElementById("toast");

window.openLoginModal = function () {
    loginMode = "login";

    authTitle.textContent = "Login";
    authSubmit.textContent = "Entrar";
    switchAuth.textContent = "Criar uma conta";

    authEmail.value = "";
    authPassword.value = "";

    loginModal.classList.remove("hidden");

    setTimeout(function () {
        authEmail.focus();
    }, 50);
};

window.closeLoginModal = function () {
    loginModal.classList.add("hidden");
};

window.closePublishModal = function () {
    publishModal.classList.add("hidden");
    editingPlugin = null;
};

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(function () {
        toast.classList.remove("show");
    }, 4000);
}

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
        const value = localStorage.getItem(SESSION_KEY);

        if (!value) {
            return null;
        }

        return JSON.parse(value);
    } catch {
        localStorage.removeItem(SESSION_KEY);
        return null;
    }
}

async function authRequest(path, options) {
    options = options || {};

    const response = await fetch(
        AUTH_URL + path,
        {
            method: options.method || "GET",
            headers: {
                "apikey": SUPABASE_KEY,
                "Content-Type": "application/json",
                "Accept": "application/json",
                ...(options.headers || {})
            },
            body: options.body
        }
    );

    const text = await response.text();

    let data = {};

    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = {
            message: text
        };
    }

    if (!response.ok) {
        const code =
            data.code ||
            data.error_code ||
            "";

        const message =
            data.msg ||
            data.message ||
            data.error_description ||
            data.error ||
            "";

        if (code === "email_provider_disabled") {
            throw new Error(
                "O login por email está desativado no Supabase."
            );
        }

        if (code === "signup_disabled") {
            throw new Error(
                "O cadastro está desativado no Supabase."
            );
        }

        if (
            code === "email_exists" ||
            message.toLowerCase().includes(
                "user already registered"
            )
        ) {
            throw new Error(
                "Este email já possui uma conta."
            );
        }

        if (code === "email_not_confirmed") {
            throw new Error(
                "Confirme o email da conta antes de fazer login."
            );
        }

        throw new Error(
            message ||
            "Erro HTTP " + response.status
        );
    }

    return data;
}

async function login(email, password) {
    const data = await authRequest(
        "/token?grant_type=password",
        {
            method: "POST",
            body: JSON.stringify({
                email: email,
                password: password
            })
        }
    );

    currentSession = data;
    currentUser = data.user;

    saveSession(data);

    updateAdminStatus();
    updateUserUI();

    window.closeLoginModal();

    authForm.reset();

    showToast(
        "Login realizado com sucesso."
    );

    await loadPlugins();
}

async function register(email, password) {
    const data = await authRequest(
        "/signup",
        {
            method: "POST",
            body: JSON.stringify({
                email: email,
                password: password
            })
        }
    );

    if (data.access_token) {
        currentSession = data;
        currentUser = data.user;

        saveSession(data);

        updateAdminStatus();
        updateUserUI();

        window.closeLoginModal();

        authForm.reset();

        showToast(
            "Conta criada com sucesso."
        );

        await loadPlugins();

        return;
    }

    authForm.reset();

    showToast(
        "Conta criada. Verifique seu email para confirmar."
    );
}

function updateAdminStatus() {
    currentAdmin =
        !!currentUser &&
        currentUser.id === ADMIN_ID;
}

async function logout() {
    if (currentSession?.access_token) {
        try {
            await fetch(
                AUTH_URL + "/logout",
                {
                    method: "POST",
                    headers: {
                        "apikey": SUPABASE_KEY,
                        "Authorization":
                            "Bearer " +
                            currentSession.access_token
                    }
                }
            );
        } catch {
        }
    }

    currentSession = null;
    currentUser = null;
    currentAdmin = false;
    editingPlugin = null;

    saveSession(null);

    updateUserUI();
    renderPlugins();

    showToast(
        "Você saiu da conta."
    );
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
                    refresh_token:
                        currentSession.refresh_token
                })
            }
        );

        currentSession = data;
        currentUser = data.user;

        saveSession(data);

        updateAdminStatus();

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
        Date.now() / 1000 >=
        currentSession.expires_at - 60
    ) {
        const refreshed = await refreshSession();

        if (!refreshed) {
            updateUserUI();
            return;
        }
    }

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
        let response = await fetch(
            AUTH_URL + "/user",
            {
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization":
                        "Bearer " +
                        currentSession.access_token
                }
            }
        );

        if (!response.ok) {
            const refreshed =
                await refreshSession();

            if (!refreshed) {
                currentUser = null;
                currentAdmin = false;

                updateUserUI();

                return;
            }

            response = await fetch(
                AUTH_URL + "/user",
                {
                    headers: {
                        "apikey": SUPABASE_KEY,
                        "Authorization":
                            "Bearer " +
                            currentSession.access_token
                    }
                }
            );
        }

        if (!response.ok) {
            throw new Error(
                "Sessão inválida."
            );
        }

        currentUser = await response.json();

        updateAdminStatus();
        updateUserUI();
        renderPlugins();
    } catch {
        currentUser = null;
        currentAdmin = false;

        saveSession(null);

        updateUserUI();
    }
}

function updateUserUI() {
    if (currentUser) {
        userEmail.textContent =
            currentUser.email || "";

        loginButton.classList.add(
            "hidden"
        );

        logoutButton.classList.remove(
            "hidden"
        );
    } else {
        userEmail.textContent = "";

        loginButton.classList.remove(
            "hidden"
        );

        logoutButton.classList.add(
            "hidden"
        );
    }
}

loginButton.onclick = function () {
    window.openLoginModal();
};

logoutButton.onclick = function () {
    logout();
};

document.getElementById(
    "closeLogin"
).onclick = function () {
    window.closeLoginModal();
};

document.getElementById(
    "closeModal"
).onclick = function () {
    window.closePublishModal();
};

loginModal.onclick = function (event) {
    if (event.target === loginModal) {
        window.closeLoginModal();
    }
};

publishModal.onclick = function (event) {
    if (event.target === publishModal) {
        window.closePublishModal();
    }
};

switchAuth.onclick = function () {
    if (loginMode === "login") {
        loginMode = "signup";

        authTitle.textContent =
            "Criar conta";

        authSubmit.textContent =
            "Criar conta";

        switchAuth.textContent =
            "Já tenho uma conta";
    } else {
        loginMode = "login";

        authTitle.textContent =
            "Login";

        authSubmit.textContent =
            "Entrar";

        switchAuth.textContent =
            "Criar uma conta";
    }
};

authForm.onsubmit = async function (event) {
    event.preventDefault();

    const email =
        authEmail.value.trim();

    const password =
        authPassword.value;

    if (!email) {
        showToast(
            "Digite seu email."
        );
        return;
    }

    if (!password) {
        showToast(
            "Digite sua senha."
        );
        return;
    }

    if (password.length < 6) {
        showToast(
            "A senha precisa ter pelo menos 6 caracteres."
        );
        return;
    }

    authSubmit.disabled = true;

    authSubmit.textContent =
        loginMode === "login"
            ? "Entrando..."
            : "Criando...";

    try {
        if (loginMode === "login") {
            await login(
                email,
                password
            );
        } else {
            await register(
                email,
                password
            );
        }
    } catch (error) {
        let message =
            error.message ||
            "Ocorreu um erro.";

        const lower =
            message.toLowerCase();

        if (
            lower.includes(
                "invalid login credentials"
            )
        ) {
            message =
                "Email ou senha incorretos.";
        }

        if (
            lower.includes(
                "email not confirmed"
            )
        ) {
            message =
                "Confirme seu email antes de entrar.";
        }

        if (
            lower.includes(
                "user already registered"
            )
        ) {
            message =
                "Este email já possui uma conta.";
        }

        if (
            lower.includes(
                "password should be at least"
            )
        ) {
            message =
                "A senha precisa ter pelo menos 6 caracteres.";
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

publishButton.onclick = function () {
    if (!currentUser) {
        window.openLoginModal();

        showToast(
            "Faça login para publicar um plugin."
        );

        return;
    }

    editingPlugin = null;

    document.getElementById(
        "pluginName"
    ).value = "";

    document.getElementById(
        "pluginDescription"
    ).value = "";

    document.getElementById(
        "pluginVersion"
    ).value = "1.0.0";

    document.getElementById(
        "pluginFile"
    ).value = "";

    submitButton.textContent =
        "Publicar";

    publishModal.classList.remove(
        "hidden"
    );
};

async function loadPlugins() {
    try {
        const response = await fetch(
            REST_URL +
            "/plugins?select=*&order=created_at.desc",
            {
                headers:
                    publicHeaders()
            }
        );

        if (!response.ok) {
            const text =
                await response.text();

            throw new Error(
                text ||
                "Não foi possível carregar os plugins."
            );
        }

        plugins =
            await response.json();

        renderPlugins();
    } catch (error) {
        pluginsContainer.innerHTML =
            '<div class="loading">' +
            escapeHTML(
                error.message
            ) +
            "</div>";

        countElement.textContent =
            "0 plugins";
    }
}

function renderPlugins() {
    const search =
        searchInput.value
            .trim()
            .toLowerCase();

    const filtered =
        plugins.filter(
            function (plugin) {
                const name =
                    String(
                        plugin.name || ""
                    ).toLowerCase();

                const description =
                    String(
                        plugin.description || ""
                    ).toLowerCase();

                const owner =
                    String(
                        plugin.owner_email || ""
                    ).toLowerCase();

                return (
                    name.includes(search) ||
                    description.includes(search) ||
                    owner.includes(search)
                );
            }
        );

    countElement.textContent =
        filtered.length +
        (
            filtered.length === 1
                ? " plugin"
                : " plugins"
        );

    if (filtered.length === 0) {
        pluginsContainer.innerHTML =
            '<div class="loading">' +
            "Nenhum plugin encontrado." +
            "</div>";

        return;
    }

    pluginsContainer.innerHTML = "";

    filtered.forEach(
        function (plugin) {
            const card =
                document.createElement(
                    "div"
                );

            card.className =
                "pluginCard";

            const name =
                escapeHTML(
                    plugin.name ||
                    "Plugin sem nome"
                );

            const description =
                escapeHTML(
                    plugin.description ||
                    "Sem descrição."
                );

            const version =
                escapeHTML(
                    plugin.version ||
                    "1.0.0"
                );

            const owner =
                escapeHTML(
                    plugin.owner_email ||
                    "Desconhecido"
                );

            card.innerHTML =
                "<div class=\"pluginTop\">" +
                    "<div>" +
                        "<h3>" +
                            name +
                        "</h3>" +
                        "<span class=\"version\">" +
                            "v" +
                            version +
                        "</span>" +
                    "</div>" +
                "</div>" +

                "<p>" +
                    description +
                "</p>" +

                "<div class=\"pluginOwner\">" +
                    "Publicado por " +
                    owner +
                "</div>" +

                "<button class=\"installButton\" type=\"button\">" +
                    "Instalar" +
                "</button>";

            const install =
                card.querySelector(
                    ".installButton"
                );

            install.onclick =
                function () {
                    installPlugin(
                        plugin
                    );
                };

            const isOwner =
                !!currentUser &&
                plugin.owner_id ===
                currentUser.id;

            if (
                currentUser &&
                (
                    currentAdmin ||
                    isOwner
                )
            ) {
                const editButton =
                    document.createElement(
                        "button"
                    );

                editButton.className =
                    "editButton";

                editButton.type =
                    "button";

                editButton.textContent =
                    "Editar";

                editButton.onclick =
                    function () {
                        editPlugin(
                            plugin
                        );
                    };

                card.appendChild(
                    editButton
                );

                const deleteButton =
                    document.createElement(
                        "button"
                    );

                deleteButton.className =
                    "deleteButton";

                deleteButton.type =
                    "button";

                deleteButton.textContent =
                    "Excluir";

                deleteButton.onclick =
                    function () {
                        deletePlugin(
                            plugin
                        );
                    };

                card.appendChild(
                    deleteButton
                );
            }

            if (currentAdmin) {
                const whoMadeButton =
                    document.createElement(
                        "button"
                    );

                whoMadeButton.className =
                    "editButton";

                whoMadeButton.type =
                    "button";

                whoMadeButton.textContent =
                    "Edit who made this";

                whoMadeButton.onclick =
                    async function () {
                        const newOwner =
                            prompt(
                                "Digite quem fez este plugin:",
                                plugin.owner_email || ""
                            );

                        if (
                            newOwner === null
                        ) {
                            return;
                        }

                        const value =
                            newOwner.trim();

                        if (!value) {
                            showToast(
                                "Digite quem fez o plugin."
                            );
                            return;
                        }

                        try {
                            showToast(
                                "Alterando..."
                            );

                            const response =
                                await fetch(
                                    REST_URL +
                                    "/plugins?id=eq." +
                                    encodeURIComponent(
                                        plugin.id
                                    ),
                                    {
                                        method:
                                            "PATCH",
                                        headers: {
                                            ...authHeaders(),
                                            "Prefer":
                                                "return=representation"
                                        },
                                        body:
                                            JSON.stringify({
                                                owner_email:
                                                    value
                                            })
                                    }
                                );

                            if (
                                !response.ok
                            ) {
                                const text =
                                    await response.text();

                                throw new Error(
                                    text ||
                                    "Não foi possível alterar quem fez o plugin."
                                );
                            }

                            plugin.owner_email =
                                value;

                            renderPlugins();

                            showToast(
                                "Quem fez o plugin foi alterado."
                            );
                        } catch (error) {
                            showToast(
                                error.message
                            );
                        }
                    };

                card.appendChild(
                    whoMadeButton
                );

                const adminLabel =
                    document.createElement(
                        "div"
                    );

                adminLabel.className =
                    "adminLabel";

                adminLabel.textContent =
                    "ADMIN";

                card.appendChild(
                    adminLabel
                );
            }

            pluginsContainer.appendChild(
                card
            );
        }
    );
}

function editPlugin(plugin) {
    if (!currentUser) {
        showToast(
            "Faça login primeiro."
        );
        return;
    }

    const isOwner =
        plugin.owner_id ===
        currentUser.id;

    if (
        !isOwner &&
        !currentAdmin
    ) {
        showToast(
            "Você não pode editar este plugin."
        );
        return;
    }

    editingPlugin = plugin;

    document.getElementById(
        "pluginName"
    ).value =
        plugin.name || "";

    document.getElementById(
        "pluginDescription"
    ).value =
        plugin.description || "";

    document.getElementById(
        "pluginVersion"
    ).value =
        plugin.version || "1.0.0";

    document.getElementById(
        "pluginFile"
    ).value = "";

    submitButton.textContent =
        "Salvar alterações";

    publishModal.classList.remove(
        "hidden"
    );
}

async function updatePlugin(plugin) {
    if (!currentUser) {
        throw new Error(
            "Você precisa estar logado."
        );
    }

    const isOwner =
        plugin.owner_id ===
        currentUser.id;

    if (
        !isOwner &&
        !currentAdmin
    ) {
        throw new Error(
            "Você não pode editar este plugin."
        );
    }

    const name =
        document.getElementById(
            "pluginName"
        ).value.trim();

    const description =
        document.getElementById(
            "pluginDescription"
        ).value.trim();

    const version =
        document.getElementById(
            "pluginVersion"
        ).value.trim();

    const fileInput =
        document.getElementById(
            "pluginFile"
        );

    const newFile =
        fileInput.files[0];

    const changes = {
        name: name,
        description: description,
        version: version
    };

    let newPath = null;

    if (newFile) {
        if (
            !newFile.name
                .toLowerCase()
                .endsWith(".js")
        ) {
            throw new Error(
                "O arquivo precisa ser JavaScript."
            );
        }

        if (
            newFile.size >
            1024 * 1024
        ) {
            throw new Error(
                "O plugin não pode ter mais de 1 MB."
            );
        }

        const safeFileName =
            newFile.name
                .replace(
                    /[^a-zA-Z0-9._-]/g,
                    "_"
                )
                .replace(
                    /\.{2,}/g,
                    "."
                );

        newPath =
            plugin.owner_id +
            "/" +
            crypto.randomUUID() +
            "/" +
            Date.now() +
            "-" +
            safeFileName;

        const uploadResponse =
            await fetch(
                STORAGE_URL +
                "/object/plugins/" +
                newPath,
                {
                    method: "POST",
                    headers: {
                        "apikey":
                            SUPABASE_KEY,
                        "Authorization":
                            "Bearer " +
                            currentSession
                                .access_token,
                        "Content-Type":
                            newFile.type ||
                            "application/javascript",
                        "x-upsert":
                            "false"
                    },
                    body:
                        newFile
                }
            );

        if (!uploadResponse.ok) {
            const text =
                await uploadResponse.text();

            throw new Error(
                text ||
                "Não foi possível enviar o novo arquivo."
            );
        }

        changes.file_path =
            newPath;

        changes.file_name =
            newFile.name;
    }

    const response =
        await fetch(
            REST_URL +
            "/plugins?id=eq." +
            encodeURIComponent(
                plugin.id
            ),
            {
                method: "PATCH",
                headers: {
                    ...authHeaders(),
                    "Prefer":
                        "return=representation"
                },
                body:
                    JSON.stringify(
                        changes
                    )
            }
        );

    if (!response.ok) {
        if (newPath) {
            try {
                await fetch(
                    STORAGE_URL +
                    "/object/plugins",
                    {
                        method:
                            "DELETE",
                        headers:
                            authHeaders(),
                        body:
                            JSON.stringify({
                                prefixes: [
                                    newPath
                                ]
                            })
                    }
                );
            } catch {
            }
        }

        const text =
            await response.text();

        throw new Error(
            text ||
            "Não foi possível atualizar o plugin."
        );
    }

    if (
        newPath &&
        plugin.file_path &&
        plugin.file_path !== newPath
    ) {
        try {
            await fetch(
                STORAGE_URL +
                "/object/plugins",
                {
                    method:
                        "DELETE",
                    headers:
                        authHeaders(),
                    body:
                        JSON.stringify({
                            prefixes: [
                                plugin.file_path
                            ]
                        })
                }
            );
        } catch {
        }
    }
}

async function installPlugin(plugin) {
    if (!plugin.file_path) {
        showToast(
            "Arquivo do plugin não encontrado."
        );
        return;
    }

    try {
        showToast(
            "Baixando plugin..."
        );

        const response =
            await fetch(
                STORAGE_URL +
                "/object/public/plugins/" +
                plugin.file_path
            );

        if (!response.ok) {
            throw new Error(
                "Não foi possível baixar o plugin."
            );
        }

        const blob =
            await response.blob();

        const url =
            URL.createObjectURL(
                blob
            );

        const link =
            document.createElement(
                "a"
            );

        link.href = url;

        link.download =
            plugin.file_name ||
            "plugin.js";

        document.body.appendChild(
            link
        );

        link.click();

        link.remove();

        URL.revokeObjectURL(
            url
        );

        await increaseDownloads(
            plugin
        );

        showToast(
            "Plugin baixado."
        );
    } catch (error) {
        showToast(
            error.message
        );
    }
}

async function increaseDownloads(plugin) {
    if (!plugin.id) {
        return;
    }

    const downloads =
        Number(
            plugin.downloads || 0
        );

    try {
        await fetch(
            REST_URL +
            "/plugins?id=eq." +
            encodeURIComponent(
                plugin.id
            ),
            {
                method: "PATCH",
                headers:
                    publicHeaders(),
                body:
                    JSON.stringify({
                        downloads:
                            downloads + 1
                    })
            }
        );
    } catch {
    }
}

async function deletePlugin(plugin) {
    if (!currentUser) {
        showToast(
            "Faça login primeiro."
        );
        return;
    }

    const isOwner =
        plugin.owner_id ===
        currentUser.id;

    if (
        !isOwner &&
        !currentAdmin
    ) {
        showToast(
            "Você não pode excluir este plugin."
        );
        return;
    }

    const confirmed =
        confirm(
            'Excluir o plugin "' +
            (
                plugin.name ||
                "sem nome"
            ) +
            '"?'
        );

    if (!confirmed) {
        return;
    }

    try {
        showToast(
            "Excluindo plugin..."
        );

        if (plugin.file_path) {
            const storageResponse =
                await fetch(
                    STORAGE_URL +
                    "/object/plugins",
                    {
                        method:
                            "DELETE",
                        headers:
                            authHeaders(),
                        body:
                            JSON.stringify({
                                prefixes: [
                                    plugin.file_path
                                ]
                            })
                    }
                );

            if (
                !storageResponse.ok &&
                storageResponse.status !==
                404
            ) {
                const text =
                    await storageResponse.text();

                throw new Error(
                    text ||
                    "Não foi possível excluir o arquivo."
                );
            }
        }

        const response =
            await fetch(
                REST_URL +
                "/plugins?id=eq." +
                encodeURIComponent(
                    plugin.id
                ),
                {
                    method:
                        "DELETE",
                    headers:
                        authHeaders()
                }
            );

        if (!response.ok) {
            const text =
                await response.text();

            throw new Error(
                text ||
                "Não foi possível excluir o plugin."
            );
        }

        plugins =
            plugins.filter(
                function (item) {
                    return (
                        item.id !==
                        plugin.id
                    );
                }
            );

        renderPlugins();

        showToast(
            "Plugin excluído."
        );
    } catch (error) {
        showToast(
            error.message
        );
    }
}

pluginForm.onsubmit =
    async function (event) {
        event.preventDefault();

        if (
            !currentUser ||
            !currentSession
        ) {
            showToast(
                "Faça login para publicar."
            );
            return;
        }

        if (editingPlugin) {
            submitButton.disabled =
                true;

            submitButton.textContent =
                "Salvando...";

            try {
                await updatePlugin(
                    editingPlugin
                );

                window.closePublishModal();

                await loadPlugins();

                showToast(
                    "Plugin atualizado."
                );
            } catch (error) {
                showToast(
                    error.message
                );
            } finally {
                submitButton.disabled =
                    false;

                submitButton.textContent =
                    "Publicar";
            }

            return;
        }

        const name =
            document.getElementById(
                "pluginName"
            ).value.trim();

        const description =
            document.getElementById(
                "pluginDescription"
            ).value.trim();

        const version =
            document.getElementById(
                "pluginVersion"
            ).value.trim();

        const fileInput =
            document.getElementById(
                "pluginFile"
            );

        const file =
            fileInput.files[0];

        if (!name) {
            showToast(
                "Digite o nome do plugin."
            );
            return;
        }

        if (!file) {
            showToast(
                "Selecione um arquivo .js."
            );
            return;
        }

        if (
            !file.name
                .toLowerCase()
                .endsWith(".js")
        ) {
            showToast(
                "O arquivo precisa ser JavaScript."
            );
            return;
        }

        if (
            file.size >
            1024 * 1024
        ) {
            showToast(
                "O plugin não pode ter mais de 1 MB."
            );
            return;
        }

        submitButton.disabled =
            true;

        submitButton.textContent =
            "Publicando...";

        let uploadedPath = null;

        try {
            const safeFileName =
                file.name
                    .replace(
                        /[^a-zA-Z0-9._-]/g,
                        "_"
                    )
                    .replace(
                        /\.{2,}/g,
                        "."
                    );

            uploadedPath =
                currentUser.id +
                "/" +
                crypto.randomUUID() +
                "/" +
                Date.now() +
                "-" +
                safeFileName;

            const uploadResponse =
                await fetch(
                    STORAGE_URL +
                    "/object/plugins/" +
                    uploadedPath,
                    {
                        method:
                            "POST",
                        headers: {
                            "apikey":
                                SUPABASE_KEY,
                            "Authorization":
                                "Bearer " +
                                currentSession
                                    .access_token,
                            "Content-Type":
                                file.type ||
                                "application/javascript",
                            "x-upsert":
                                "false"
                        },
                        body:
                            file
                    }
                );

            if (!uploadResponse.ok) {
                const text =
                    await uploadResponse.text();

                throw new Error(
                    text ||
                    "Não foi possível enviar o arquivo."
                );
            }

            const insertResponse =
                await fetch(
                    REST_URL +
                    "/plugins",
                    {
                        method:
                            "POST",
                        headers: {
                            ...authHeaders(),
                            "Prefer":
                                "return=representation"
                        },
                        body:
                            JSON.stringify({
                                name:
                                    name,
                                description:
                                    description,
                                version:
                                    version,
                                category:
                                    "community",
                                file_path:
                                    uploadedPath,
                                file_name:
                                    file.name,
                                downloads:
                                    0,
                                owner_id:
                                    currentUser.id,
                                owner_email:
                                    currentUser.email
                            })
                    }
                );

            if (!insertResponse.ok) {
                const text =
                    await insertResponse.text();

                throw new Error(
                    text ||
                    "Não foi possível salvar o plugin."
                );
            }

            pluginForm.reset();

            window.closePublishModal();

            showToast(
                "Plugin publicado com sucesso."
            );

            await loadPlugins();
        } catch (error) {
            if (uploadedPath) {
                try {
                    await fetch(
                        STORAGE_URL +
                        "/object/plugins",
                        {
                            method:
                                "DELETE",
                            headers:
                                authHeaders(),
                            body:
                                JSON.stringify({
                                    prefixes: [
                                        uploadedPath
                                    ]
                                })
                        }
                    );
                } catch {
                }
            }

            showToast(
                error.message
            );
        } finally {
            submitButton.disabled =
                false;

            submitButton.textContent =
                "Publicar";
        }
    };

searchInput.oninput = function () {
    renderPlugins();
};

function escapeHTML(value) {
    return String(value)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}

async function start() {
    updateUserUI();

    await loadSession();

    await loadPlugins();
}

start();
