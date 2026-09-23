const SUPABASE_URL = "https://skrbmtanugilgxfzflyf.supabase.co";
const SUPABASE_KEY = "sb_publishable_Acs-wmNpLpDCoiORLlUZtg_7oVBvHfd";

const { createClient } = window.supabase;

const db = createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const publishButton =
    document.getElementById("publishButton");

const publishModal =
    document.getElementById("publishModal");

const closeModal =
    document.getElementById("closeModal");

const pluginForm =
    document.getElementById("pluginForm");

const pluginsElement =
    document.getElementById("plugins");

const searchInput =
    document.getElementById("search");

const countElement =
    document.getElementById("count");

const toast =
    document.getElementById("toast");

const loginButton =
    document.getElementById("loginButton");

const logoutButton =
    document.getElementById("logoutButton");

const loginModal =
    document.getElementById("loginModal");

const closeLogin =
    document.getElementById("closeLogin");

const authForm =
    document.getElementById("authForm");

const authTitle =
    document.getElementById("authTitle");

const authSubmit =
    document.getElementById("authSubmit");

const switchAuth =
    document.getElementById("switchAuth");

const userEmail =
    document.getElementById("userEmail");

let allPlugins = [];
let authMode = "login";
let currentUser = null;
let currentAdmin = false;

function showToast(message) {
    toast.textContent = message;
    toast.style.display = "block";

    setTimeout(function () {
        toast.style.display = "none";
    }, 3000);
}

async function updateUser() {
    const result =
        await db.auth.getUser();

    currentUser =
        result.data.user || null;

    currentAdmin = false;

    if (currentUser) {
        userEmail.textContent =
            currentUser.email || "";

        loginButton.classList.add("hidden");
        logoutButton.classList.remove("hidden");

        const profile =
            await db
                .from("profiles")
                .select("is_admin")
                .eq("id", currentUser.id)
                .maybeSingle();

        if (
            profile.data &&
            profile.data.is_admin === true
        ) {
            currentAdmin = true;
        }

    } else {
        userEmail.textContent = "";

        loginButton.classList.remove("hidden");
        logoutButton.classList.add("hidden");
    }

    renderPlugins(allPlugins);
}

loginButton.addEventListener(
    "click",
    function () {
        authMode = "login";

        authTitle.textContent = "Login";
        authSubmit.textContent = "Entrar";
        switchAuth.textContent = "Criar conta";

        loginModal.classList.remove("hidden");
    }
);

closeLogin.addEventListener(
    "click",
    function () {
        loginModal.classList.add("hidden");
    }
);

loginModal.addEventListener(
    "click",
    function (event) {
        if (event.target === loginModal) {
            loginModal.classList.add("hidden");
        }
    }
);

switchAuth.addEventListener(
    "click",
    function () {
        if (authMode === "login") {
            authMode = "signup";

            authTitle.textContent =
                "Criar conta";

            authSubmit.textContent =
                "Criar conta";

            switchAuth.textContent =
                "Já tenho uma conta";

        } else {
            authMode = "login";

            authTitle.textContent =
                "Login";

            authSubmit.textContent =
                "Entrar";

            switchAuth.textContent =
                "Criar conta";
        }
    }
);

authForm.addEventListener(
    "submit",
    async function (event) {
        event.preventDefault();

        const email =
            document
                .getElementById("authEmail")
                .value
                .trim();

        const password =
            document
                .getElementById("authPassword")
                .value;

        authSubmit.disabled = true;

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

                showToast(
                    "Conta criada! Verifique seu email se necessário."
                );
            }

            loginModal.classList.add("hidden");

            authForm.reset();

            await updateUser();

        } catch (error) {
            showToast(
                error.message ||
                "Erro de autenticação."
            );
        }

        authSubmit.disabled = false;
    }
);

logoutButton.addEventListener(
    "click",
    async function () {
        await db.auth.signOut();

        currentUser = null;
        currentAdmin = false;

        await updateUser();

        showToast("Você saiu da conta.");
    }
);

publishButton.addEventListener(
    "click",
    function () {
        if (!currentUser) {
            showToast(
                "Faça login para publicar um plugin."
            );

            loginModal.classList.remove("hidden");

            return;
        }

        publishModal.classList.remove("hidden");
    }
);

closeModal.addEventListener(
    "click",
    function () {
        publishModal.classList.add("hidden");
    }
);

publishModal.addEventListener(
    "click",
    function (event) {
        if (event.target === publishModal) {
            publishModal.classList.add("hidden");
        }
    }
);

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

    allPlugins =
        result.data || [];

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
            plugin.name;

        const description =
            document.createElement("p");

        description.textContent =
            plugin.description;

        const version =
            document.createElement("div");

        version.className =
            "version";

        version.textContent =
            `Versão ${plugin.version}`;

        const owner =
            document.createElement("div");

        owner.className =
            "version";

        owner.textContent =
            plugin.owner_email
                ? `Publicado por ${plugin.owner_email}`
                : "Publicado pela comunidade";

        const installButton =
            document.createElement("button");

        installButton.className =
            "installButton";

        installButton.textContent =
            "Instalar plugin";

        installButton.addEventListener(
            "click",
            function () {
                installPlugin(
                    plugin.file_path,
                    plugin.file_name,
                    installButton
                );
            }
        );

        card.appendChild(title);
        card.appendChild(description);
        card.appendChild(version);
        card.appendChild(owner);
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

            deleteButton.addEventListener(
                "click",
                function () {
                    deletePlugin(
                        plugin,
                        deleteButton
                    );
                }
            );

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
    button.textContent =
        "Baixando...";

    try {
        const url =
            db.storage
                .from("plugins")
                .getPublicUrl(filePath)
                .data
                .publicUrl;

        const response =
            await fetch(url);

        if (!response.ok) {
            throw new Error(
                "Falha no download."
            );
        }

        const blob =
            await response.blob();

        const blobURL =
            URL.createObjectURL(blob);

        const link =
            document.createElement("a");

        link.href =
            blobURL;

        link.download =
            fileName || "plugin.js";

        document.body.appendChild(link);

        link.click();

        link.remove();

        setTimeout(
            function () {
                URL.revokeObjectURL(blobURL);
            },
            1000
        );

        showToast(
            "Plugin baixado!"
        );

    } catch (error) {

        console.error(error);

        showToast(
            "Erro ao baixar o plugin."
        );

    } finally {

        button.disabled = false;
        button.textContent =
            oldText;
    }
}

async function deletePlugin(
    plugin,
    button
) {
    if (!currentUser) {
        showToast(
            "Faça login primeiro."
        );

        return;
    }

    const isOwner =
        plugin.owner_id === currentUser.id;

    if (!isOwner && !currentAdmin) {
        showToast(
            "Você não pode excluir este plugin."
        );

        return;
    }

    const confirmed =
        confirm(
            `Excluir o plugin "${plugin.name}"?`
        );

    if (!confirmed) {
        return;
    }

    const oldText =
        button.textContent;

    button.disabled = true;
    button.textContent =
        "Excluindo...";

    try {

        const storageDelete =
            await db.storage
                .from("plugins")
                .remove([
                    plugin.file_path
                ]);

        if (storageDelete.error) {
            throw storageDelete.error;
        }

        const databaseDelete =
            await db
                .from("plugins")
                .delete()
                .eq("id", plugin.id);

        if (databaseDelete.error) {
            throw databaseDelete.error;
        }

        showToast(
            "Plugin excluído!"
        );

        await loadPlugins();

    } catch (error) {

        console.error(error);

        showToast(
            error.message ||
            "Erro ao excluir plugin."
        );

        button.disabled = false;
        button.textContent =
            oldText;
    }
}

searchInput.addEventListener(
    "input",
    function () {

        const query =
            searchInput.value
                .trim()
                .toLowerCase();

        if (!query) {
            renderPlugins(allPlugins);
            return;
        }

        const filtered =
            allPlugins.filter(
                function (plugin) {

                    return (
                        String(plugin.name || "")
                            .toLowerCase()
                            .includes(query) ||

                        String(plugin.description || "")
                            .toLowerCase()
                            .includes(query)
                    );
                }
            );

        renderPlugins(filtered);
    }
);

pluginForm.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();

        if (!currentUser) {
            showToast(
                "Faça login para publicar."
            );

            return;
        }

        const name =
            document
                .getElementById("pluginName")
                .value
                .trim();

        const description =
            document
                .getElementById("pluginDescription")
                .value
                .trim();

        const version =
            document
                .getElementById("pluginVersion")
                .value
                .trim();

        const fileInput =
            document.getElementById(
                "pluginFile"
            );

        const file =
            fileInput.files[0];

        const submitButton =
            document.getElementById(
                "submitButton"
            );

        if (!file) {
            showToast(
                "Escolha um arquivo .js."
            );

            return;
        }

        if (
            !file.name
                .toLowerCase()
                .endsWith(".js")
        ) {
            showToast(
                "Escolha um arquivo JavaScript .js."
            );

            return;
        }

        if (
            file.size >
            1024 * 1024
        ) {
            showToast(
                "O plugin deve ter no máximo 1 MB."
            );

            return;
        }

        submitButton.disabled = true;
        submitButton.textContent =
            "Publicando...";

        try {

            const randomID =
                crypto.randomUUID();

            const safeFileName =
                file.name.replace(
                    /[^a-zA-Z0-9._-]/g,
                    "_"
                );

            const filePath =
                `public/${randomID}/${Date.now()}-${safeFileName}`;

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
                    .remove([
                        filePath
                    ]);

                throw insert.error;
            }

            pluginForm.reset();

            document
                .getElementById(
                    "pluginVersion"
                )
                .value = "1.0.0";

            publishModal.classList.add(
                "hidden"
            );

            showToast(
                "Plugin publicado!"
            );

            await loadPlugins();

        } catch (error) {

            console.error(error);

            showToast(
                error.message ||
                "Erro ao publicar plugin."
            );

        } finally {

            submitButton.disabled =
                false;

            submitButton.textContent =
                "Publicar";
        }
    }
);

db.auth.onAuthStateChange(
    async function () {
        await updateUser();
    }
);

async function start() {
    await updateUser();
    await loadPlugins();
}

start();
