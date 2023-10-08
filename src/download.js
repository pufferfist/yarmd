"use strict"
import * as fs from "fs"
import * as path from "path"
import {parse as parseURL} from "url"
import {logger} from "./log"
import {parseIndex} from "./parser"
import {sleep, aria2} from "./util";

export function downloadRoot(dir, url, threads, callback){
    recursiveDownload(dir, url, threads,() => {
        logger.info('Download complete.')
    })
    callback(aria2)
}
export function recursiveDownload(dir, url, threads, callback) {
    logger.info(`Parsing index: ${hrefWithoutAuth(url)}`)
    parseIndex(url.href, (err, index) => {
        if (err != null) {
            throw err
        }
        if (index == null || index.length == 0) {
            logger.info(`Empty directory. Aborting.`)
            return
        }
        let pathName = path.join(dir, '/' + urlToDir(url))
        fs.exists(pathName, (exists) => {
            if (!exists) {
                fs.mkdirSync(pathName)
            }
            _recursiveDownload(pathName, index, url, threads, callback)
        })
    })
}


async function _recursiveDownload(pathName, index, baseURL, threads, callback) {
    let pending = []
    let config = {
        dir: pathName,
        'max-connection-per-server': 15,
        split: 5,
        'file-allocation': 'falloc'
    }
    for (const f of index) {
        if (f.endsWith('/')) {
            // A directory
            pending.push(f)
        } else {
            // Download this file
            let fileURL = baseURL.href + f
            logger.info(`Downloading ${hrefWithoutAuth(baseURL)}${f}`)
            let fileName = path.join(pathName, '/' + decodeURIComponent(f))
            logger.info(`File name: ${fileName}`)
            let aria2File = fileName + '.aria2'
            if (!fs.existsSync(fileName) || (fs.existsSync(fileName) && fs.existsSync(aria2File))) {
                let waitTime=1000;
                //aria2 waiting queue reaches threshold around 1800
                while((await aria2.call("getGlobalStat")).numWaiting>1800){
                    // console.log('waiting ....')
                    await sleep(waitTime);
                    waitTime*=2;
                }
                aria2.call("addUri", [fileURL], config);
            }
        }
    }
    if (pending.length == 0) {
        callback()
    } else {
        downloadPending(pathName, baseURL, threads, pending, 0, callback)
    }
}

function downloadPending(pathName, baseURL, threads, pending, i, callback) {
    recursiveDownload(pathName, parseURL(baseURL.href + pending[i]), threads, () => {
        if (i == pending.length - 1) {
            callback()
        } else {
            setImmediate(() => downloadPending(pathName, baseURL, threads, pending, i + 1, callback))
        }
    })
}

function hrefWithoutAuth(url) {
    return `${url.protocol}${url.port != null ? ':' + url.port : ''}//${url.hostname}${url.path}`
}

function urlToDir(url) {
    if (url.path == null || url.path == '') {
        return url.hostname
    } else {
        return _urlToDir(url.path.split('/'))
    }
}

function _urlToDir(arr) {
    return decodeURIComponent(arr[arr.length > 1 ? arr.length - 2 : arr.length - 1])
}
