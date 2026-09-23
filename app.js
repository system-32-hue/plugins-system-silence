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

if (!list.length) {

    pluginsElement.innerHTML =
        '<div class="loading">Nenhum plugin publicado.</div>';

    return;
}

pluginsElement.innerHTML = list.map(plugin => {

    const fileURL =
        db.storage
            .from("plugins")
            .getPublicUrl(plugin.file_path)
            .data
            .publicUrl;

    const safeURL =
        encodeURIComponent(fileURL);

    const safeFileName =
        encodeURIComponent(plugin.file_name || "plugin.js");

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
                class="installButton"
                data-url="${safeURL}"
                data-file="${safeFileName}"
                data-id="${escapeHTML(plugin.id)}"
            >
                Instalar plugin
            </button>

        </article>
    `;

}).join("");

document.querySelectorAll(".installButton").forEach(button => {

    button.addEventListener("click", () => {

        const url =
            decodeURIComponent(button.dataset.url);

        const fileName =
            decodeURIComponent(button.dataset.file);

        const pluginId =
            button.dataset.id;

        installPlugin(
            url,
            fileName,
            pluginId,
            button
        );

    });

});
```

}

async function installPlugin(
url,
fileName,
pluginId,
button
) {

```
const originalText =
    button.textContent;

button.disabled = true;
button.textContent = "Instalando...";

try {

    const response =
        await fetch(url);

    if (!response.ok) {
        throw new Error("Não foi possível baixar o plugin.");
    }

    const blob =
        await response.blob();

    const blobURL =
        URL.createObjectURL(blob);

    const link =
        document.createElement("a");

    link.href = blobURL;

    link.download =
        fileName.toLowerCase().endsWith(".js")
            ? fileName
            : `${fileName}.js`;

    document.body.appendChild(link);

    link.click();

    link.remove();

    setTimeout(() => {
        URL.revokeObjectURL(blobURL);
    }, 1000);

    try {

        await db.rpc(
            "increment_plugin_downloads",
            {
                plugin_id: pluginId
            }
        );

    } catch (downloadError) {

        console.error(
            "Erro ao registrar download:",
            downloadError
        );

    }

    showToast(
        "Plugin baixado! Coloque o arquivo na pasta plugins do System Silence."
    );

} catch (error) {

    console.error(error);

    showToast(
        "Não foi possível instalar o plugin."
    );

} finally {

    button.disabled = false;
    button.textContent = originalText;

}
```

}

searchInput.addEventListener(
"input",
() => {

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

            const name =
                String(plugin.name || "")
                    .toLowerCase();

            const description =
                String(plugin.description || "")
                    .toLowerCase();

            const version =
                String(plugin.version || "")
                    .toLowerCase();

            return (
                name.includes(query) ||
                description.includes(query) ||
                version.includes(query)
            );

        });

    renderPlugins(filtered);

}
```

);

pluginForm.addEventListener(
"submit",
async event => {

```
    event.preventDefault();

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

    const file =
```
