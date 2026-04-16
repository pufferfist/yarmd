const DEFAULT_SERVER = "http://localhost:7727"

let favorites = []
let browser

async function load() {
    const cfg = await chrome.storage.sync.get(["serverUrl", "defaultDir", "favorites"])
    document.getElementById("serverUrl").value = cfg.serverUrl || DEFAULT_SERVER
    document.getElementById("defaultDir").value = cfg.defaultDir || ""
    favorites = cfg.favorites || []
    renderFavorites()

    browser = createBrowser("browsePath", "browseDirs", () => {
        return document.getElementById("serverUrl").value.trim() || DEFAULT_SERVER
    })
    await browser.navigate("")
}

async function save() {
    const serverUrl = document.getElementById("serverUrl").value.trim() || DEFAULT_SERVER
    const defaultDir = document.getElementById("defaultDir").value.trim()
    await chrome.storage.sync.set({ serverUrl, defaultDir, favorites })
    const status = document.getElementById("save-status")
    status.textContent = "Saved"
    status.classList.remove("error")
    setTimeout(() => { status.textContent = "" }, 1500)
}

// --- Favorites ---

function renderFavorites() {
    const ul = document.getElementById("favList")
    ul.innerHTML = ""
    favorites.forEach((fav, i) => {
        const li = document.createElement("li")
        const span = document.createElement("span")
        span.textContent = fav
        const btn = document.createElement("button")
        btn.classList.add("remove")
        btn.textContent = "\u00d7"
        btn.addEventListener("click", () => removeFavorite(i))
        li.appendChild(span)
        li.appendChild(btn)
        ul.appendChild(li)
    })
}

function removeFavorite(index) {
    favorites.splice(index, 1)
    chrome.storage.sync.set({ favorites })
    renderFavorites()
}

function addCurrentToFavorites() {
    const status = document.getElementById("fav-status")
    const path = browser.getPath()
    if (!path) {
        status.textContent = "Navigate to a folder first"
        setTimeout(() => { status.textContent = "" }, 1500)
        return
    }
    if (favorites.indexOf(path) !== -1) {
        status.textContent = "Already in favorites"
        setTimeout(() => { status.textContent = "" }, 1500)
        return
    }
    favorites.push(path)
    chrome.storage.sync.set({ favorites })
    renderFavorites()
    status.textContent = "Added"
    setTimeout(() => { status.textContent = "" }, 1500)
}

// --- Shutdown ---

async function cancelShutdown() {
    const serverUrl = document.getElementById("serverUrl").value.trim() || DEFAULT_SERVER
    const status = document.getElementById("cancel-status")
    status.classList.remove("error")
    status.textContent = "..."
    try {
        const res = await fetch(`${serverUrl}/shutdown/cancel`, { method: "POST" })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
            status.textContent = "Error: " + (data.error || `HTTP ${res.status}`)
            status.classList.add("error")
            return
        }
        status.textContent = data.wasRequested
            ? "Shutdown flag cleared"
            : "No shutdown was pending"
        setTimeout(() => { status.textContent = "" }, 2500)
    } catch (err) {
        status.textContent = "Cannot reach server: " + err.message
        status.classList.add("error")
    }
}

// --- Event listeners ---

document.getElementById("save").addEventListener("click", save)
document.getElementById("cancelShutdown").addEventListener("click", cancelShutdown)
document.getElementById("addCurrent").addEventListener("click", addCurrentToFavorites)
document.getElementById("browseGo").addEventListener("click", () => {
    browser.navigate(document.getElementById("browsePath").value)
})
document.getElementById("browsePath").addEventListener("keydown", (e) => {
    if (e.key === "Enter") browser.navigate(e.target.value)
})
load()
