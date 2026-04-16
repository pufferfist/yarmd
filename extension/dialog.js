const DEFAULT_SERVER = "http://localhost:7727"

let serverUrl = DEFAULT_SERVER
let pendingUrl = ""
let browser

async function init() {
    const sess = await chrome.storage.session.get("pendingUrl")
    pendingUrl = sess.pendingUrl || ""
    document.getElementById("url").textContent = pendingUrl || "(no url)"

    const cfg = await chrome.storage.sync.get(["serverUrl", "defaultDir", "favorites"])
    if (cfg.serverUrl) serverUrl = cfg.serverUrl
    renderFavorites(cfg.favorites || [])

    browser = createBrowser("current", "dirs", () => serverUrl)

    document.getElementById("go").addEventListener("click", () => {
        browser.navigate(document.getElementById("current").value)
    })
    document.getElementById("current").addEventListener("keydown", (e) => {
        if (e.key === "Enter") browser.navigate(e.target.value)
    })
    document.getElementById("download").addEventListener("click", submit)
    document.getElementById("cancel").addEventListener("click", () => window.close())

    await browser.navigate(cfg.defaultDir || "")
}

function renderFavorites(favs) {
    if (!favs || favs.length === 0) return
    document.getElementById("fav-row").style.display = ""
    const container = document.getElementById("favorites")
    container.innerHTML = ""
    favs.forEach(fav => {
        const btn = document.createElement("button")
        btn.classList.add("fav-chip")
        btn.textContent = fav
        btn.addEventListener("click", () => {
            browser.setPath(fav)
            browser.navigate(fav)
        })
        container.appendChild(btn)
    })
}

async function submit() {
    if (!pendingUrl) {
        showError("No URL to download")
        return
    }
    if (!browser.getPath()) {
        showError("Select a download directory")
        return
    }
    const shutdown = document.getElementById("shutdown").checked
    const dlBtn = document.getElementById("download")
    dlBtn.disabled = true
    try {
        const res = await fetch(`${serverUrl}/download`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: pendingUrl, dir: browser.getPath(), shutdown }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
            showError(data.error || `HTTP ${res.status}`)
            dlBtn.disabled = false
            return
        }
        showSuccess(`Queued${shutdown ? " (shutdown after)" : ""}. Closing...`)
        await chrome.storage.session.remove("pendingUrl")
        setTimeout(() => window.close(), 1000)
    } catch (err) {
        showError("Cannot reach server: " + err.message)
        dlBtn.disabled = false
    }
}

function showError(msg) {
    const el = document.getElementById("status")
    el.textContent = "Error: " + msg
    el.classList.add("error")
}

function showSuccess(msg) {
    const el = document.getElementById("status")
    el.textContent = msg
    el.classList.remove("error")
}

function clearStatus() {
    const el = document.getElementById("status")
    el.textContent = ""
    el.classList.remove("error")
}

init()
