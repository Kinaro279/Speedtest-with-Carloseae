// worker.js - runs in a Web Worker
// Messages:
// { cmd: 'start', downUrl, upUrl, singleShot }  -> start tests
// { cmd: 'stop' } -> stop current test

let controller = null;
let running = false;

self.onmessage = async (e) => {
  const msg = e.data;
  if (!msg || !msg.cmd) return;
  if (msg.cmd === 'stop') {
    running = false;
    if (controller) controller.abort();
    return;
  }
  if (msg.cmd === 'start') {
    running = true;
    const downUrl = msg.downUrl || 'https://speed.hetzner.de/5MB.bin';
    const upUrl = msg.upUrl || 'https://httpbin.org/post'; // used for upload test
    const singleShot = !!msg.singleShot;
    try {
      // ping + jitter measurement (simple)
      const pingSamples = [];
      for (let i=0;i<3;i++){
        if(!running) break;
        const t0 = performance.now();
        try{
          await fetch(downUrl, { method: 'HEAD', cache: 'no-store' });
        }catch(e){
          // HEAD may fail; fallback to GET with Range small
          try{ await fetch(downUrl, { headers: { Range: 'bytes=0-99' }, cache: 'no-store' }); }catch{}
        }
        const t1 = performance.now();
        pingSamples.push(Math.round(t1 - t0));
        await new Promise(r => setTimeout(r, 120));
      }
      const ping = pingSamples.length ? Math.round(pingSamples.reduce((a,b)=>a+b,0)/pingSamples.length) : 999;
      const jitter = pingSamples.length>1 ? Math.round(Math.max(...pingSamples)-Math.min(...pingSamples)) : 0;
      self.postMessage({ type:'ping', ping, jitter });

      if(!running) return;

      // Download streaming test
      controller = new AbortController();
      const startTime = performance.now();
      const resp = await fetch(downUrl, { signal: controller.signal, cache:'no-store' });
      if(!resp.body) {
        // no streaming available: fallback - read blob
        const blob = await resp.blob();
        const endTime = performance.now();
        const seconds = Math.max(0.001, (endTime - startTime) / 1000);
        const mbps = (blob.size * 8) / seconds / 1024 / 1024;
        self.postMessage({ type:'download_update', bytes: blob.size, elapsed: seconds, mbps, final:true });
      } else {
        const reader = resp.body.getReader();
        let bytes = 0;
        let lastPosted = performance.now();
        while(running) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          const now = performance.now();
          // Post progress roughly every 150ms (not too frequent)
          if (now - lastPosted >= 150) {
            const elapsed = (now - startTime) / 1000;
            const mbps = (bytes * 8) / elapsed / 1024 / 1024;
            self.postMessage({ type:'download_update', bytes, elapsed, mbps, final:false });
            lastPosted = now;
          }
        }
        const endTime = performance.now();
        const elapsed = Math.max(0.001, (endTime - startTime) / 1000);
        const mbps = (bytes * 8) / elapsed / 1024 / 1024;
        self.postMessage({ type:'download_update', bytes, elapsed, mbps, final:true });
      }

      if(!running) return;

      // Upload test - generate random bytes and POST
      // Keep upload size moderate (2-4 MB)
      const upBytes = msg.uploadSize || (3 * 1024 * 1024);
      const uploadArray = new Uint8Array(upBytes);
      crypto.getRandomValues(uploadArray);

      const uStart = performance.now();
      // attempt to POST; many public endpoints restrict POST size/CORS; user may replace upUrl with their server.
      try {
        await fetch(upUrl, { method:'POST', body: uploadArray, signal: controller.signal, cache:'no-store' });
        const uEnd = performance.now();
        const uSeconds = Math.max(0.001, (uEnd - uStart) / 1000);
        const upMbps = (upBytes * 8) / uSeconds / 1024 / 1024;
        self.postMessage({ type:'upload', upBytes, uSeconds, upMbps, final:true });
      } catch (e) {
        self.postMessage({ type:'upload_error', message: e.message || String(e) });
      }

      // If singleShot is false, keep repeating after a pause
      if (!singleShot) {
        // small delay before next cycle
        const delay = msg.intervalMs || 4000;
        await new Promise(r => setTimeout(r, delay));
        if (running) self.postMessage({ type:'cycle_complete' });
      }
    } catch (err) {
      self.postMessage({ type:'error', message: err.message || String(err) });
    } finally {
      controller = null;
      if (!singleShot) {
        // nothing else
      }
    }
  }
};
