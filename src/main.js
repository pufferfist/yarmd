"use strict"
import * as optimist from "optimist"
import * as process from "process"
import * as fs from "fs"
import * as path from "path"
import {parse as parseURL} from "url"
import {logger} from "./log"
import {downloadRoot, recursiveDownload} from "./download"
import {shutdown, sleep, aria2} from "./util";
import util from "../lib/util";

let argv = optimist
    .usage('Usage: yarmd [-h] [-s] [-n count] [-d directory] URL\n\nYet Another Recursive Multi-thread Downloader. This program downloads recursively from an Nginx server with autoindex enabled.\nIf you want to resume a previous download, just make sure the parameters remain the same.\nPlease note that this program ONLY supports servers with NGINX autoindex, and it requires Aria2 to work!')
    .alias('n', 'threads')
    .alias('d', 'directory')
    .alias('h', 'help')
    .alias('s', 'shutdown')
    .describe('n', 'The number of threads while downloading a file.')
    .describe('d', 'Directory to download into. YARMD will create a new directory in that directory named with the directory to download.')
    .describe('h', 'Print help information')
    .describe('s', 'shut down after download')
    .boolean('h')
    .boolean('s')
    .default('n', 3)
    .default('d', process.cwd())
    .default('h', false)
    .argv

main()

function main() {
    if (argv.help) {
        console.log(optimist.help())
        process.exit(0)
    }

    if (argv._.length == 0 || argv._[0] == null || argv._[0] == "") {
        logger.error('No URL provided.')
        console.log(optimist.help())
        process.exit(1)
    }

    argv.directory = path.resolve(argv.directory)
    if (!fs.existsSync(argv.directory)) {
        logger.error(`Directory ${argv.directory} does not exist.`)
        process.exit(1)
    }

    // Validate the URL first
    let url = argv._[0].trim()
    if (!url.endsWith('/')) {
        logger.info('Adding a trailing / automatically.')
        url += '/'
    }
    url = parseURL(url)

    if (url.protocol != "http:" && url.protocol != "https:") {
        logger.error('Only HTTP and HTTPS are supported')
        process.exit(1)
    }

    if (url.hostname == null || url.hostname.trim() == "") {
        logger.error('No host provided')
        process.exit(1)
    }

    let callback=() => {
        logger.info('Download complete.')
    }
    if (argv.shutdown) {
        callback = async (aria2) => {
            //polling and shut down
            let waitTime = 10000;
            await sleep(waitTime);
            //aria2 waiting queue reaches threshold around 1800
            while ((await aria2.call("getGlobalStat")).numActive > 0) {
                logger.info("waiting...")
                await sleep(waitTime);
            }
            shutdown();
        }
    }
    downloadRoot(argv.directory, url, argv.threads,callback)
}