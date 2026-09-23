const SUPABASE_URL = "https://skrbmtanugilgxfzflyf.supabase.co";
const SUPABASE_KEY = "sb_publishable_Acs-wmNpLpDCoiORLlUZtg_7oVBvHfd";

const { createClient } = window.supabase;

const db = createClient(
SUPABASE_URL,
SUPABASE_KEY
);

const publishButton = document.getElementById("publishButton");
const publishModal = document.getElementById("publishModal");
const closeModal = document.getElementById("closeModal");
const pluginForm = document.getElementById("pluginForm");
const pluginsElement = document.getElementById("plugins");
const searchInput = document.getElementById("search");
const countElement = document.getElementById("count");
const toast = document.getElementById("toast");

let allPlugins = [];

publishButton.onclick = () => {
publishModal.classList.remove("hidden");
};

closeModal.onclick = () => {
publishModal.classList.add("hidden");
};

publishModal.onclick = event => {
if (event.target === publishModal) {
publishModal.classList.add("hidden");
}
};

function showToast(message) {
toast.textContent = message;
toast.style.display = "block";

```
setTimeout(() => {
    toast.style.display = "none";
}, 3000);
```

}

function escapeHTML(value) {
return String(value)
.replaceAll("&", "&")
.replaceAll("<", "<")
.replaceAll(">", ">")
.replaceAll('"', """)
.replaceAll("'", "'");
}

async function loadPlugins() {

```
pluginsElement.innerHTML = '<div class="loading">Carregando plugins...</div>';

const { data, error } = await db
    .from("plugins")
    .select("*")
    .order("created_at", {
        ascending: false
    });

if (error) {
    pluginsElement.innerHTML =
        "<div class='loading'>Erro ao carregar plugins.</div>";

    console.error(error);
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

if (!list.length) {
    pluginsElement.innerHTML =
        '<div class="loading">Nenhum plugin publicado.</div>';
    return;
}

pluginsElement.innerHTML = list.map(plugin => {

    const path = plugin.file_path;

    const fileURL =
        db.storage
            .from("plugins")
            .getPublicUrl(path)
            .data
            .publicUrl;

    return `
        <article class="plugin">

            <h3>${escapeHTML(plugin.name)}</h3>

            <p>
                ${escapeHTML(plugin.description)}
            </p>

            <div class="version">
                Versão ${escapeHTML(plugin.version)}
            </div>

            <button
                onclick="downloadPlugin(
                    '${escapeHTML(fileURL)}',
                    '${escapeHTML(plugin.file_name)}',
                    '${plugin.id}'
                )"
            >
                Baixar plugin
            </button>

        </article>
    `;

}).join("");
```

}

window.downloadPlugin = async function(url, fileName, pluginId) {

```
try {

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Falha ao baixar");
    }

    const blob = await response.blob();

    const blobURL = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = blobURL;
    link.download = fileName || "plugin.js";

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(blobURL);

    await db.rpc(
        "increment_plugin_downloads",
        {
            plugin_id: pluginId
        }
    );

} catch (error) {

    window.open(url, "_blank");

}
```

};

searchInput.addEventListener("input", () => {

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
            plugin.name.toLowerCase().includes(query) ||
            plugin.description.toLowerCase().includes(query)
        );

    });

renderPlugins(filtered);
```

});

pluginForm.addEventListener("submit", async event => {

```
event.preventDefault();

const name =
    document.getElementById("pluginName").value.trim();

const description =
    document.getElementById("pluginDescription").value.trim();

const version =
    document.getElementById("pluginVersion").value.trim();

const file =
    document.getElementById("pluginFile").files[0];

if (!file) {
    showToast("Escolha um arquivo .js.");
    return;
}

if (!file.name.toLowerCase().endsWith(".js")) {
    showToast("O arquivo precisa ser .js.");
    return;
}

if (file.size > 1024 * 1024) {
    showToast("O plugin pode ter no máximo 1 MB.");
    return;
}

const submitButton =
    document.getElementById("submitButton");

submitButton.disabled = true;
submitButton.textContent = "Publicando...";

try {

    const fakeUserId =
        crypto.randomUUID();

    const safeName =
        file.name
            .replace(/[^a-zA-Z0-9._-]/g, "_");

    const path =
        `public/${fakeUserId}/${Date.now()}-${safeName}`;

    const upload =
        await db.storage
            .from("plugins")
            .upload(path, file, {
                contentType: "application/javascript",
                upsert: false
            });

    if (upload.error) {
        throw upload.error;
    }

    const insert =
        await db
            .from("plugins")
            .insert({
                name,
                description,
                version,
                category: "System Silence",
                file_path: path,
                file_name: file.name,
                downloads: 0
            });

    if (insert.error) {
        await db.storage
            .from("plugins")
            .remove([path]);

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
        "Não foi possível publicar. Configure o banco do Supabase."
    );

} finally {

    submitButton.disabled = false;
    submitButton.textContent = "Publicar";

}


});

loadPlugins();
