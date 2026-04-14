const DEFAULT_SERVER = "http://localhost:7727"

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "yarmd-link",
        title: "Download with yarmd...",
        contexts: ["link"],
    })
    chrome.contextMenus.create({
        id: "yarmd-page",
        title: "Download this page with yarmd...",
        contexts: ["page"],
    })
})

chrome.contextMenus.onClicked.addListener(async (info) => {
    const url = info.menuItemId === "yarmd-link" ? info.linkUrl : info.pageUrl
    if (!url) return
    await chrome.storage.session.set({ pendingUrl: url })
    chrome.windows.create({
        url: chrome.runtime.getURL("dialog.html"),
        type: "popup",
        width: 600,
        height: 560,
    })
})

chrome.action.onClicked.addListener(() => {
    chrome.runtime.openOptionsPage()
})
