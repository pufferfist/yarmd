yarmd - Yet Another Recursive Multi-thread Downloader
---

Trying to refactor the calling process based on aria2.js. Real multithreading.

Moving to Windows.

Usage
---

```shell
aria2c --enable-rpc --rpc-listen-all=true --rpc-allow-origin-all
npm run build
npm run start -- -n 5 -d dir http://link.to.resource
```
