function createBrowser(pathInputId, listId, serverUrlFn) {
    let currentPath = ""

    async function navigate(p) {
        const serverUrl = serverUrlFn()
        try {
            const res = await fetch(`${serverUrl}/browse?path=${encodeURIComponent(p || "")}`)
            if (!res.ok) return
            const data = await res.json()
            currentPath = data.path || ""
            document.getElementById(pathInputId).value = currentPath

            const list = document.getElementById(listId)
            list.innerHTML = ""

            if (data.drives && data.drives.length > 0) {
                data.drives.forEach(d => {
                    list.appendChild(dirItem(d, d, false))
                })
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
            // server not reachable
        }
    }

    function dirItem(label, target, isParent) {
        const li = document.createElement("li")
        li.textContent = label
        if (isParent) li.classList.add("parent-item")
        li.addEventListener("click", () => navigate(target))
        return li
    }

    function joinPath(base, child) {
        if (!base) return child
        if (base.endsWith("\\") || base.endsWith("/")) return base + child
        return base + "\\" + child
    }

    function getPath() {
        return currentPath
    }

    function setPath(p) {
        currentPath = p
        document.getElementById(pathInputId).value = p
    }

    return { navigate, getPath, setPath }
}
