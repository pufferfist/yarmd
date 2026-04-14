"use strict"
import express from "express"
import cors from "cors"
import * as fs from "fs"
import * as path from "path"
import { parse as parseURL } from "url"
import { logger } from "./log"
import { downloadRoot } from "./download"
import { aria2, sleep, shutdown, DOWNLOAD_CONFIG } from "./util"

const PORT = 7727
const DEFAULT_DIR = "Z:\\aria2download"

// Catch uncaught exceptions from callback-based throws in download.js
// (e.g. parseIndex error thrown inside recursiveDownload's callback)
// so the server stays alive instead of crashing.
process.on("uncaughtException", (err) => {
    logger.error(`Uncaught exception: ${err.message}`)
})
process.on("unhandledRejection", (reason) => {
    logger.error(`Unhandled rejection: ${reason}`)
})

// Shutdown watcher state (module-level)
let shutdownRequested = false
let watcherRunning = false
let sawActivity = false

function armWatcher() {
    sawActivity = false
    ensureShutdownWatcher()
}

async function ensureShutdownWatcher() {
    if (watcherRunning) return
    watcherRunning = true
    const waitTime = 10000
    try {
        while (true) {
            await sleep(waitTime)
            let stat
            try {
                stat = await aria2.call("getGlobalStat")
            } catch (err) {
                logger.warn(`Watcher: getGlobalStat failed: ${err.message}`)
                continue
            }
            const active = parseInt(stat.numActive)
            const waiting = parseInt(stat.numWaiting)

            if (active > 0 || waiting > 0) {
                sawActivity = true
                continue
            }

            if (!sawActivity) {
                logger.info("Watcher: queue empty but no activity seen yet, waiting")
                continue
            }

            if (shutdownRequested) {
                logger.info("Watcher: queue drained and shutdown requested — shutting down")
                shutdown()
                return
            }
            logger.info("Watcher: queue drained, no shutdown requested — stopping watcher")
            return
        }
    } finally {
        watcherRunning = false
    }
}

const app = express()
app.use(express.json())
app.use(cors({ origin: true }))

// POST /download
app.post("/download", (req, res) => {
    const { url: rawUrl, dir, shutdown: wantShutdown } = req.body || {}

    if (!rawUrl || typeof rawUrl !== "string") {
        return res.status(400).json({ error: "url is required and must be a string" })
    }

    let normalised = rawUrl.trim()

    const parsed = parseURL(normalised)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return res.status(400).json({ error: "Only http and https URLs are supported" })
    }
    if (!parsed.hostname || parsed.hostname.trim() === "") {
        return res.status(400).json({ error: "URL must have a hostname" })
    }

    const targetDir = (dir && typeof dir === "string" && dir.trim() !== "")
        ? dir.trim()
        : DEFAULT_DIR

    if (!fs.existsSync(targetDir)) {
        return res.status(400).json({ error: `Directory does not exist: ${targetDir}` })
    }

    logger.info(`POST /download: queuing ${normalised} into ${targetDir} (shutdown=${!!wantShutdown})`)

    if (wantShutdown === true) {
        shutdownRequested = true
    }

    if (normalised.endsWith("/")) {
        // Directory — recursive download via downloadRoot
        try {
            downloadRoot(targetDir, parsed, 16, () => {
                logger.info(`downloadRoot started for ${normalised}`)
            })
        } catch (err) {
            logger.error(`POST /download: downloadRoot threw: ${err.message}`)
            return res.status(500).json({ error: "Failed to start download", detail: err.message })
        }
    } else {
        // Single file — send directly to aria2
        let config = Object.assign({ dir: targetDir }, DOWNLOAD_CONFIG)
        aria2.call("addUri", [normalised], config).then(() => {
            logger.info(`Single file queued: ${normalised}`)
        }).catch((err) => {
            logger.error(`Failed to queue single file ${normalised}: ${err.message}`)
        })
    }

    armWatcher()

    return res.status(202).json({
        status: "queued",
        url: normalised,
        dir: targetDir,
        shutdown: shutdownRequested,
    })
})

// GET /status
app.get("/status", async (req, res) => {
    try {
        const stat = await aria2.call("getGlobalStat")
        return res.json(Object.assign({}, stat, { shutdownRequested: shutdownRequested }))
    } catch (err) {
        return res.status(502).json({ error: "aria2 unavailable", detail: err.message })
    }
})

// GET /browse?path=...
app.get("/browse", (req, res) => {
    const qPath = (req.query.path || "").trim()

    // Empty path or "/" → return drive list on Windows
    if (qPath === "" || qPath === "/" || qPath === "\\") {
        const drives = []
        for (let c = 65; c <= 90; c++) {
            const letter = String.fromCharCode(c) + ":\\"
            try {
                if (fs.existsSync(letter)) drives.push(letter)
            } catch (e) {
                // ignore
            }
        }
        return res.json({ path: "", parent: null, dirs: [], drives })
    }

    let abs
    try {
        abs = path.resolve(qPath)
    } catch (err) {
        return res.status(400).json({ error: "Invalid path" })
    }

    let stat
    try {
        stat = fs.statSync(abs)
    } catch (err) {
        if (err.code === "EACCES") return res.status(403).json({ error: "Permission denied" })
        return res.status(400).json({ error: `Cannot access path: ${err.message}` })
    }
    if (!stat.isDirectory()) {
        return res.status(400).json({ error: "Path is not a directory" })
    }

    let entries
    try {
        entries = fs.readdirSync(abs, { withFileTypes: true })
    } catch (err) {
        if (err.code === "EACCES") return res.status(403).json({ error: "Permission denied" })
        return res.status(500).json({ error: `Cannot read directory: ${err.message}` })
    }

    const dirs = entries
        .filter(e => {
            try { return e.isDirectory() } catch (x) { return false }
        })
        .map(e => e.name)
        .sort((a, b) => a.localeCompare(b))

    // Compute parent: null if we're at a drive root on Windows (e.g. "C:\")
    const parsedPath = path.parse(abs)
    const atRoot = abs === parsedPath.root
    const parent = atRoot ? "" : path.dirname(abs)

    return res.json({ path: abs, parent, dirs })
})

// POST /shutdown/cancel
app.post("/shutdown/cancel", (req, res) => {
    const was = shutdownRequested
    shutdownRequested = false
    logger.info(`POST /shutdown/cancel: flag was ${was}, now cleared`)
    return res.json({ ok: true, wasRequested: was })
})

app.listen(PORT, () => {
    logger.info(`yarmd server listening on http://localhost:${PORT}`)
})
