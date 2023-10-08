import Aria2 from "aria2";
import ws from "ws";
import nodefetch from "node-fetch";
import { exec } from "child_process";

export const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay))

export const aria2 = new Aria2({
    WebSocket: ws,
    fetch: nodefetch,
    host: 'localhost',
    port: 6800,
    secure: false,
    path: '/jsonrpc'
});

export function shutdown() {
    let command = exec('shutdown -s -t 00', function(err, stdout, stderr) {
        if(err || stderr) {
            console.log("shutdown failed" + err + stderr);
        }
    });
    command.stdin.end();
    command.on('close', function(code) {
        console.log("shutdown", code);
    });
}