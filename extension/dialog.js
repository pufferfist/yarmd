const DEFAULT_SERVER = "http://localhost:7727"

let currentPath = ""
let serverUrl = DEFAULT_SERVER
let pendingUrl = ""

async function init() {
    const sess = await chrome.storage.session.get("pendingUrl")
    pendingUrl = sess.pendingUrl || ""
    document.getElementById("url").textContent = pendingUrl || "(no url)"

    const cfg = await chrome.storage.sync.get(["serverUrl", "defaultDir"])
    if (cfg.serverUrl) serverUrl = cfg.serverUrl

    document.getElementById("go").addEventListener("click", () => {
        navigate(document.getElementById("current").value)
    })
    document.getElementById("current").addEventListener("keydown", (e) => {
        if (e.key === "Enter") navigate(e.target.value)
    })
    document.getElementById("download").addEventListener("click", submit)
    document.getElementById("cancel").addEventListener("click", () => window.close())

    await navigate(cfg.defaultDir || "")
}

async function navigate(p) {
    try {
        const res = await fetch(`${serverUrl}/browse?path=${encodeURIComponent(p || "")}`)
        if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            showError(data.error || `HTTP ${res.status}`)
            return
        }
        const data = await res.json()
        currentPath = data.path || ""
        document.getElementById("current").value = currentPath
        clearStatus()

        const list = document.getElementById("dirs")
        list.innerHTML = ""

        if (data.drives && data.drives.length > 0) {
            // Drive list
            data.drives.forEach(d => list.appendChild(dirItem(d, d, false)))
            return
        }

        if (data.parent !== null && data.parent !== undefined) {
            list.appendChild(dirItem("..", data.parent, true))
        }
        data.dirs.forEach(name => {
            const target = joinPath(currentPath, name)
            list.appendChild(dirItem(name, target, false))
        })
    } catch (err) {
        showError("Cannot reach server: " + err.message)
    }
}

function dirItem(label, target, isParent) {
    const li = document.createElement("li")
    li.textContent = label
    if (isParent) li.classList.add("parent")
    li.addEventListener("click", () => navigate(target))
    return li
}

function joinPath(base, child) {
    if (!base) return child
    if (base.endsWith("\\") || base.endsWith("/")) return base + child
    return base + "\\" + child
}

async function submit() {
    if (!pendingUrl) {
        showError("No URL to download")
        return
    }
    if (!currentPath) {
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
            body: JSON.stringify({ url: pendingUrl, dir: currentPath, shutdown }),
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
