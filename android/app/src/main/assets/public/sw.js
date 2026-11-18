/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-afac4cd2'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "1872c500de691dce40960bb85481de07"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "1bcf660af8b691e0c8a42b1a309bc2a6"
  }, {
    "url": "pwa-512x512.png",
    "revision": "41a592b51ad12030211fda1e8474634a"
  }, {
    "url": "pwa-192x192.png",
    "revision": "bf144db37005f415b0bb26fbd7df4256"
  }, {
    "url": "index.html",
    "revision": "eb3ee538a35beaeaee6855e49302d1b7"
  }, {
    "url": "icon.svg",
    "revision": "c463e00f017270a6d6c88efc3f4973ed"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "e4f324d44e78b3bfaa8936f54d1f9fca"
  }, {
    "url": "assets/web-Bz4JHI4R.js",
    "revision": null
  }, {
    "url": "assets/index-DtqAaMWw.css",
    "revision": null
  }, {
    "url": "assets/index-D0Y-7QFn.js",
    "revision": null
  }, {
    "url": "assets/aistudio/image_c27127cf.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_a19b2acc.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_7696252c.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_54b0a3bb.png",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "e4f324d44e78b3bfaa8936f54d1f9fca"
  }, {
    "url": "icon.svg",
    "revision": "c463e00f017270a6d6c88efc3f4973ed"
  }, {
    "url": "pwa-192x192.png",
    "revision": "bf144db37005f415b0bb26fbd7df4256"
  }, {
    "url": "pwa-512x512.png",
    "revision": "41a592b51ad12030211fda1e8474634a"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "1bcf660af8b691e0c8a42b1a309bc2a6"
  }, {
    "url": "manifest.webmanifest",
    "revision": "0f9daf950bd40f89859e0d5084b9ab7e"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html"), {
    denylist: [/^\/api\//, /^\/__\//]
  }));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
