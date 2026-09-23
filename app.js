let plugins = [];

async function loadPlugins() {
    const response = await fetch("plugins.json", {
        cache: "no-cache"
    });

    if (!response.ok) {
        throw new Error("Não foi possível carregar plugins.json");
    }

    plugins = await response.json();

    renderPlugins(plugins);
}

function escapeHTML(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function getRawURL(file) {
    return new URL(file, window.location.href).href;
}

function renderPlugins(list) {
    const container = document.getElementById("plugins");
    const count = document.getElementById("count");

    count.textContent =
        `${list.length} plugin${list.length === 1 ? "" : "s"} encontrado${list.length === 1 ? "" : "s"}`;

    if (list.length === 0) {
        container.innerHTML =
            '<div class="empty">Nenhum plugin encontrado.</div>';
        return;
    }

    container.innerHTML = list.map((plugin, index) => {
        const rawURL = getRawURL(plugin.file);

        return `
            <article class="card">
                <h3>${escapeHTML(plugin.name)}</h3>

                <p class="description">
                    ${escapeHTML(plugin.description)}
                </p>

                <div class="meta">
                    <span class="tag">
                        v${escapeHTML(plugin.version)}
                    </span>

                    <span class="tag">
                        ${escapeHTML(plugin.category)}
                    </span>

                    <span class="tag">
                        ${escapeHTML(plugin.author)}
                    </span>
                </div>

                <div class="buttons">
                    <a
                        class="button primary"
                        href="${escapeHTML(plugin.file)}"
                        download
                    >
                        Baixar
                    </a>

                    <a
                        class="button"
                        href="${escapeHTML(rawURL)}"
                        target="_blank"
                        rel="noopener"
                    >
                        Raw
                    </a>

                    <button
                        type="button"
                        data-index="${index}"
                        class="copy-button"
                    >
                        Copiar URL
                    </button>
                </div>
            </article>
        `;
    }).join("");

    container.querySelectorAll(".copy-button").forEach(button => {
        button.addEventListener("click", async () => {
            const plugin = list[Number(button.dataset.index)];
            const rawURL = getRawURL(plugin.file);

            try {
                await navigator.clipboard.writeText(rawURL);
                alert("URL Raw copiada!");
            } catch {
                alert("Não foi possível copiar a URL.");
            }
        });
    });
}

document.getElementById("search").addEventListener("input", event => {
    const query = event.target.value
        .toLowerCase()
        .trim();

    const filtered = plugins.filter(plugin => {
        const text = [
            plugin.name,
            plugin.description,
            plugin.author,
            plugin.category,
            plugin.version
        ].join(" ").toLowerCase();

        return text.includes(query);
    });

    renderPlugins(filtered);
});

loadPlugins().catch(error => {
    document.getElementById("plugins").innerHTML = `
        <div class="empty">
            Erro ao carregar a lista de plugins. ops daisy! >:3<br><br>
            ${escapeHTML(error.message)}
        </div>
    `;
});
