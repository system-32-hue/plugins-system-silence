const SUPABASE_URL = "https://skrbmtanugilgxfzflyf.supabase.co";
const SUPABASE_KEY = "sb_publishable_Acs-wmNpLpDCoiORLlUZtg_7oVBvHfd";

const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const publishButton = document.getElementById("publishButton");
const publishModal = document.getElementById("publishModal");
const closeModal = document.getElementById("closeModal");
const pluginForm = document.getElementById("pluginForm");

const pluginsElement = document.getElementById("plugins");
const searchInput = document.getElementById("search");
const countElement = document.getElementById("count");
const toast = document.getElementById("toast");

const loginButton = document.getElementById("loginButton");
const logoutButton = document.getElementById("logoutButton");
const userEmail = document.getElementById("userEmail");

const loginModal = document.getElementById("loginModal");
const closeLogin = document.getElementById("closeLogin");
const authForm = document.getElementById("authForm");
const authTitle = document.getElementById("authTitle");
const authSubmit = document.getElementById("authSubmit");
const switchAuth = document.getElementById("switchAuth");

let allPlugins = [];
let currentUser = null;
let currentAdmin = false;
let authMode = "login";

function showToast(message) {
    if (!toast) {
        alert(message);
        return;
    }

    toast.textContent = message;
    toast.style.display = "block";

    setTimeout(function () {
        toast.style.display = "none";
    }, 3000);
}

function openLogin() {
    authMode = "login";

    authTitle.textContent = "Login";
    authSubmit.textContent = "Entrar";
    switchAuth.textContent = "Criar conta";

    loginModal.classList.remove("hidden");
}

function closeLoginWindow() {
    loginModal.classList.add("hidden");
    authForm.reset();
}

loginButton.onclick = function () {
    openLogin();
};

closeLogin.onclick = function () {
    closeLoginWindow();
};

loginModal.onclick = function (event) {
    if (event.target === loginModal) {
        closeLoginWindow();
    }
};

switchAuth.onclick = function () {
    if (authMode === "login") {
        authMode = "signup";

        authTitle.textContent = "Criar conta";
        authSubmit.textContent = "Criar conta";
        switchAuth.textContent = "Já tenho uma conta";
    } else {
        authMode = "login";

        authTitle.textContent = "Login";
        authSubmit.textContent = "Entrar";
        switchAuth.textContent = "Criar conta";
    }
};

authForm.onsubmit = async function (event) {
    event.preventDefault();

    const email =
        document.getElementById("authEmail").value.trim();

    const password =
        document.getElementById("authPassword").value;

    if (!email || !password) {
        showToast("Digite email e senha.");
        return;
    }

    authSubmit.disabled = true;
    authSubmit.textContent = "Aguarde...";

    try {
        if (authMode === "login") {

            const result =
                await db.auth.signInWithPassword({
                    email: email,
                    password: password
                });

            if (result.error) {
                throw result.error;
            }

            showToast("Login realizado!");

        } else {

            const result =
                await db.auth.signUp({
                    email: email,
                    password: password
                });

            if (result.error) {
                throw result.error;
            }

            if (
                result.data.user &&
                !result.data.session
            ) {
                showToast(
                    "Conta criada! Verifique seu email para confirmar a conta."
                );
            } else {
                showToast("Conta criada!");
            }
        }

        closeLoginWindow();

        await updateUser();

    } catch (error) {
        console.error(error);

        let message = error.message || "Erro no login.";

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

        showToast(message);

    } finally {
        authSubmit.disabled = false;

        authSubmit.textContent =
            authMode === "login"
                ? "Entrar"
                : "Criar conta";
    }
};

logoutButton.onclick = async function () {
    const result =
        await db.auth.signOut();

    if (result.error) {
        showToast(result.error.message);
        return;
    }

    currentUser = null;
    currentAdmin = false;

    updateUser();

    showToast("Você saiu da conta.");
};

async function updateUser() {
    try {
        const result =
            await db.auth.getUser();

        if (result.error) {
            currentUser = null;
        } else {
            currentUser =
                result.data.user || null;
        }

        currentAdmin = false;

        if (currentUser) {

            userEmail.textContent =
                currentUser.email || "";

            loginButton.classList.add("hidden");
            logoutButton.classList.remove("hidden");

            try {
                const profile =
                    await db
                        .from("profiles")
                        .select("is_admin")
                        .eq("id", currentUser.id)
                        .maybeSingle();

                if (
                    !profile.error &&
                    profile.data &&
                    profile.data.is_admin === true
                ) {
                    currentAdmin = true;
                }
            } catch (error) {
                currentAdmin = false;
            }

        } else {

            userEmail.textContent = "";

            loginButton.classList.remove("hidden");
            logoutButton.classList.add("hidden");
        }

        renderPlugins(allPlugins);

    } catch (error) {
        console.error(error);
    }
}

publishButton.onclick = function () {
    if (!currentUser) {
        showToast("Faça login para publicar um plugin.");
        openLogin();
        return;
    }

    publishModal.classList.remove("hidden");
};

closeModal.onclick = function () {
    publishModal.classList.add("hidden");
};

publishModal.onclick = function (event) {
    if (event.target === publishModal) {
        publishModal.classList.add("hidden");
    }
};

async function loadPlugins() {
    pluginsElement.innerHTML =
        '<div class="loading">Carregando plugins...</div>';

    const result =
        await db
            .from("plugins")
            .select("*")
            .order("created_at", {
                ascending: false
            });

    if (result.error) {
        console.error(result.error);

        pluginsElement.innerHTML =
            '<div class="loading">Erro ao carregar plugins.</div>';

        return;
    }

    allPlugins = result.data || [];

    renderPlugins(allPlugins);
}

function renderPlugins(list) {
    countElement.textContent =
        `${list.length} plugin${list.length === 1 ? "" : "s"}`;

    if (list.length === 0) {
        pluginsElement.innerHTML =
            '<div class="loading">Nenhum plugin publicado.</div>';

        return;
    }

    pluginsElement.innerHTML = "";

    list.forEach(function (plugin) {

        const card =
            document.createElement("article");

        card.className = "plugin";

        const title =
            document.createElement("h3");

        title.textContent =
            plugin.name || "Plugin";

        const description =
            document.createElement("p");

        description.textContent =
            plugin.description || "";

        const version =
            document.createElement("div");

        version.className = "version";

        version.textContent =
            `Versão ${plugin.version || "1.0.0"}`;

        const installButton =
            document.createElement("button");

        installButton.className =
            "installButton";

        installButton.textContent =
            "Instalar plugin";

        installButton.onclick = function () {
            installPlugin(
                plugin.file_path,
                plugin.file_name,
                installButton
            );
        };

        card.appendChild(title);
        card.appendChild(description);
        card.appendChild(version);
        card.appendChild(installButton);

        const isOwner =
            currentUser &&
            plugin.owner_id === currentUser.id;

        if (isOwner || currentAdmin) {

            const deleteButton =
                document.createElement("button");

            deleteButton.className =
                "deleteButton";

            deleteButton.textContent =
                "Excluir plugin";

            deleteButton.onclick = function () {
                deletePlugin(
                    plugin,
                    deleteButton
                );
            };

            card.appendChild(deleteButton);
        }

        pluginsElement.appendChild(card);
    });
}

async function installPlugin(
    filePath,
    fileName,
    button
) {
    const oldText =
        button.textContent;

    button.disabled = true;
    button.textContent = "Baixando...";

    try {
        const result =
            db.storage
                .from("plugins")
                .getPublicUrl(filePath);

        const response =
            await fetch(result.data.publicUrl);

        if (!response.ok) {
            throw new Error("Falha no download.");
        }

        const blob =
            await response.blob();

        const blobURL =
            URL.createObjectURL(blob);

        const link =
            document.createElement("a");

        link.href = blobURL;
        link.download =
            fileName || "plugin.js";

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(function () {
            URL.revokeObjectURL(blobURL);
        }, 1000);

        showToast("Plugin baixado!");

    } catch (error) {
        console.error(error);
        showToast("Erro ao baixar o plugin.");

    } finally {
        button.disabled = false;
        button.textContent = oldText;
    }
}

async function deletePlugin(plugin, button) {
    if (!currentUser) {
        showToast("Faça login primeiro.");
        return;
    }

    const isOwner =
        plugin.owner_id === currentUser.id;

    if (!isOwner && !currentAdmin) {
        showToast("Você não pode excluir este plugin.");
        return;
    }

    if (!confirm(`Excluir "${plugin.name}"?`)) {
        return;
    }

    button.disabled = true;
    button.textContent = "Excluindo...";

    try {
        const fileDelete =
            await db.storage
                .from("plugins")
                .remove([
                    plugin.file_path
                ]);

        if (fileDelete.error) {
            throw fileDelete.error;
        }

        const databaseDelete =
            await db
                .from("plugins")
                .delete()
                .eq("id", plugin.id);

        if (databaseDelete.error) {
            throw databaseDelete.error;
        }

        showToast("Plugin excluído!");

        await loadPlugins();

    } catch (error) {
        console.error(error);

        showToast(
            error.message ||
            "Erro ao excluir plugin."
        );

        button.disabled = false;
        button.textContent = "Excluir plugin";
    }
}

searchInput.oninput = function () {
    const query =
        searchInput.value
            .trim()
            .toLowerCase();

    if (!query) {
        renderPlugins(allPlugins);
        return;
    }

    const filtered =
        allPlugins.filter(function (plugin) {
            return (
                String(plugin.name || "")
                    .toLowerCase()
                    .includes(query) ||
                String(plugin.description || "")
                    .toLowerCase()
                    .includes(query)
            );
        });

    renderPlugins(filtered);
};

pluginForm.onsubmit = async function (event) {
    event.preventDefault();

    if (!currentUser) {
        showToast("Faça login para publicar.");
        openLogin();
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

    const file =
        fileInput.files[0];

    const submitButton =
        document.getElementById("submitButton");

    if (!file) {
        showToast("Escolha um arquivo .js.");
        return;
    }

    if (!file.name.toLowerCase().endsWith(".js")) {
        showToast("O arquivo precisa ser .js.");
        return;
    }

    if (file.size > 1024 * 1024) {
        showToast("Máximo de 1 MB.");
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Publicando...";

    try {
        const id =
            crypto.randomUUID();

        const safeName =
            file.name.replace(
                /[^a-zA-Z0-9._-]/g,
                "_"
            );

        const filePath =
            `public/${id}/${Date.now()}-${safeName}`;

        const upload =
            await db.storage
                .from("plugins")
                .upload(
                    filePath,
                    file,
                    {
                        contentType:
                            "application/javascript",
                        upsert: false
                    }
                );

        if (upload.error) {
            throw upload.error;
        }

        const insert =
            await db
                .from("plugins")
                .insert({
                    name: name,
                    description: description,
                    version: version,
                    category: "System Silence",
                    file_path: filePath,
                    file_name: file.name,
                    downloads: 0,
                    owner_id: currentUser.id,
                    owner_email: currentUser.email
                });

        if (insert.error) {
            await db.storage
                .from("plugins")
                .remove([filePath]);

            throw insert.error;
        }

        pluginForm.reset();

        document.getElementById(
            "pluginVersion"
        ).value = "1.0.0";

        publishModal.classList.add("hidden");

        showToast("Plugin publicado!");

        await loadPlugins();

    } catch (error) {
        console.error(error);

        showToast(
            error.message ||
            "Erro ao publicar."
        );

    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Publicar";
    }
};

db.auth.onAuthStateChange(
    function () {
        setTimeout(
            updateUser,
            0
        );
    }
);

async function start() {
    await updateUser();
    await loadPlugins();
}

start();
