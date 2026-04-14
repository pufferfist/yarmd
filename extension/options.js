const DEFAULT_SERVER = "http://localhost:7727"

async function load() {
    const cfg = await chrome.storage.sync.get(["serverUrl", "defaultDir"])
    document.getElementById("serverUrl").value = cfg.serverUrl || DEFAULT_SERVER
    document.getElementById("defaultDir").value = cfg.defaultDir || ""
}

async function save() {
    const serverUrl = document.getElementById("serverUrl").value.trim() || DEFAULT_SERVER
    const defaultDir = document.getElementById("defaultDir").value.trim()
    await chrome.storage.sync.set({ serverUrl, defaultDir })
    const status = document.getElementById("save-status")
    status.textContent = "Saved"
    status.classList.remove("error")
    setTimeout(() => { status.textContent = "" }, 1500)
}

async function cancelShutdown() {
    const cfg = await chrome.storage.sync.get("serverUrl")
    const serverUrl = cfg.serverUrl || DEFAULT_SERVER
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

document.getElementById("save").addEventListener("click", save)
document.getElementById("cancelShutdown").addEventListener("click", cancelShutdown)
load()
