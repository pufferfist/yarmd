yarmd - Yet Another Recursive Multi-thread Downloader
---

Refactored the calling process based on aria2.js. Real multithreading.

Works fine on both macOS and Windows.

Usage
---

```shell
aria2c --enable-rpc --rpc-listen-all=true --rpc-allow-origin-all
npm install
npm run build
npm run start -- -n 5 -d dir http://link.to.nginx.autoindex
```
