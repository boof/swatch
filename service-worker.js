if(!self.define){let e,i={};const s=(s,r)=>(s=new URL(s+".js",r).href,i[s]||new Promise((i=>{if("document"in self){const e=document.createElement("script");e.src=s,e.onload=i,document.head.appendChild(e)}else e=s,importScripts(s),i()})).then((()=>{let e=i[s];if(!e)throw new Error(`Module ${s} didn’t register its module`);return e})));self.define=(r,t)=>{const o=e||("document"in self?document.currentScript.src:"")||location.href;if(i[o])return;let n={};const c=e=>s(e,o),f={module:{uri:o},exports:n,require:c};i[o]=Promise.all(r.map((e=>f[e]||c(e)))).then((e=>(t(...e),n)))}}define(["./workbox-d13932f0"],(function(e){"use strict";self.addEventListener("message",(e=>{e.data&&"SKIP_WAITING"===e.data.type&&self.skipWaiting()})),e.precacheAndRoute([{url:"404.html",revision:"138033a20b2195287e0330a9ce592700"},{url:"css/style.css",revision:"582612a121fcc7fdd925c111e48f4955"},{url:"icon.svg",revision:"780fb7b88fb058705d5909345264f529"},{url:"img/.gitkeep",revision:"d41d8cd98f00b204e9800998ecf8427e"},{url:"index.html",revision:"fd7204a0b37d7fc27d04a0c8510e49f0"},{url:"main.js",revision:"3675fbaa480d84f9d9083be55b2fe740"},{url:"robots.txt",revision:"00733c197e59662cf705a2ec6d881d44"},{url:"site.webmanifest",revision:"2e54b0969c61ae6fa2709c67186ec4f8"}],{})}));
