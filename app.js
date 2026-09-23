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

let allPlugins = [];

function showToast(message) {
toast.textContent = message;
toast.style.display = "block";

```
setTimeout(() => {
    toast.style.display = "none";
}, 3000);
```

}

publishButton.addEventListener("click", function () {
publishModal.classList.remove("hidden");
});

closeModal.addEventListener("click", function () {
publishModal.classList.add("hidden");
});

publishModal.addEventListener("click", function (event) {
if (event.target === publishModal) {
publishModal.classList.add("hidden");
}
});

async function loadPlugins() {

```
pluginsElement.innerHTML =
    '<div class="loading">Carregando plugins...</div>';

const { data, error } = await db
    .from("plugins")
    .select("*")
    .order("created_at", {
        ascending: false
    });

if (error) {
    console.error(error);

    pluginsElement.innerHTML =
        '<div class="loading">Erro ao carregar plugins.</div>';

    return;
}

allPlugins = data || [];

renderPlugins(allPlugins);
```

}

function renderPlugins(list) {

```
countElement.textContent =
    `${list.length} plugin${list.length === 1 ? "" : "s"}`;

if (list.length === 0) {
    pluginsElement.innerHTML =
        '<div class="loading">Nenhum plugin publicado.</div>';

    return;
}

pluginsElement.innerHTML = "";

list.forEach(plugin => {

    const card = document.createElement("article");
    card.className = "plugin";

    const title = document.createElement("h3");
    title.textContent = plugin.name;

    const description = document.createElement("p");
    description.textContent = plugin.description;

    const version = document.createElement("div");
    version.className = "version";
    version.textContent = `Versão ${plugin.version}`;

    const button = document.createElement("button");
    button.className = "installButton";
    button.textContent = "Instalar plugin";

    button.addEventListener("click", function () {
        installPlugin(
            plugin.file_path,
            plugin.file_name,
            button
        );
    });

    card.appendChild(title);
    card.appendChild(description);
    card.appendChild(version);
    card.appendChild(button);

    pluginsElement.appendChild(card);
});
```

}

async function installPlugin(filePath, fileName, button) {

```
const oldText = button.textContent;

button.disabled = true;
button.textContent = "Baixando...";

try {

    const url =
        db.storage
            .from("plugins")
            .getPublicUrl(filePath)
            .data
            .publicUrl;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Falha no download");
    }

    const blob = await response.blob();

    const blobURL =
        URL.createObjectURL(blob);

    const link =
        document.createElement("a");

    link.href = blobURL;
    link.download = fileName || "plugin.js";

    document.body.appendChild(link);

    link.click();

    link.remove();

    setTimeout(() => {
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
```

}

searchInput.addEventListener("input", function () {

```
const query =
    searchInput.value
        .trim()
        .toLowerCase();

if (!query) {
    renderPlugins(allPlugins);
    return;
}

const filtered =
    allPlugins.filter(plugin => {

        return (
            String(plugin.name)
                .toLowerCase()
                .includes(query) ||

            String(plugin.description)
                .toLowerCase()
                .includes(query)
        );

    });

renderPlugins(filtered);
```

});

pluginForm.addEventListener("submit", async function (event) {

```
event.preventDefault();

const name =
    document.getElementById("pluginName")
        .value
        .trim();

const description =
    document.getElementById("pluginDescription")
        .value
        .trim();

const version =
    document.getElementById("pluginVersion")
        .value
        .trim();

const fileInput =
    document.getElementById("pluginFile");

const file = fileInput.files[0];

if (!file) {
    showToast("Escolha um arquivo .js.");
    return;
}

if (!file.name.toLowerCase().endsWith(".js")) {
    showToast("Escolha um arquivo JavaScript .js.");
    return;
}

if (file.size > 1024 * 1024) {
    showToast("O plugin deve ter no máximo 1 MB.");
    return;
}

const submitButton =
    document.getElementById("submitButton");

submitButton.disabled = true;
submitButton.textContent = "Publicando...";

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
                downloads: 0
            });

    if (insert.error) {

        await db.storage
            .from("plugins")
            .remove([filePath]);

        throw insert.error;
    }

    pluginForm.reset();

    document.getElementById("pluginVersion").value =
        "1.0.0";

    publishModal.classList.add("hidden");

    showToast("Plugin publicado!");

    await loadPlugins();

} catch (error) {

    console.error(error);

    showToast(
        error.message ||
        "Erro ao publicar plugin."
    );

} finally {

    submitButton.disabled = false;
    submitButton.textContent = "Publicar";
}
```

});

loadPlugins();
