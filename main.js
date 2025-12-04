// main.js - main thread UI + worker interaction
const DOWN_URL = 'https://speed.hetzner.de/5MB.bin'; // reliable public test file
const UP_URL = 'https://httpbin.org/post'; // used for upload test (CORS may vary)
const worker = new Worker('worker.js');

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const fullBtn = document.getElementById('fullBtn');
const speedLabel = document.getElementById('speedLabel');
const statusEl = document.getElementById('status');
const dlEl = document.getElementById('download');
const upEl = document.getElementById('upload');
const pingEl = document.getElementById('ping');
const jitterEl = document.getElementById('jitter');
const historyList = document.getElementById('historyList');
const clearHistory = document.getElementById('clearHistory');
const exportHistory = document.getElementById('exportHistory');

let running = false;
let gaugeValue = 0; // 0..300 Mbps mapping
let gaugeTarget = 0;
let history = JSON.parse(localStorage.getItem('rt_speed_history') || '[]');

function saveHistoryEntry(entry){
  history.push(entry);
  localStorage.setItem('rt_speed_history', JSON.stringify(history));
  renderHistory();
}
function renderHistory(){
  if(!history.length){ historyList.textContent = 'No results yet'; return; }
  historyList.innerHTML = '';
  history.slice().reverse().forEach(r=>{
    const div = document.createElement('div');
    div.className = 'historyRow';
    div.innerHTML = `<div>
      <div style="font-weight:700">${new Date(r.t).toLocaleString()}</div>
      <div style="font-size:0.9rem;color:#96c0cf">${r.note||''}</div>
    </div>
    <div style="text-align:right">
      <div style="font-weight:700">${r.down} Mbps</div>
      <div style="font-size:0.85rem;color:#96c0cf">${r.up} / ${r.ping} ms</div>
    </div>`;
    historyList.appendChild(div);
  });
}

renderHistory();

// Gauge drawing - simple SVG semi-circle with needle
const svg = document.getElementById('gaugeSvg');
function initGauge(){
  svg.innerHTML = '';
  const xmlns = "http://www.w3.org/2000/svg";
  // background arc
  const bg = document.createElementNS(xmlns, 'path');
  bg.setAttribute('d', describeArc(180,110,90,180,0));
  bg.setAttribute('stroke', '#12313d');
  bg.setAttribute('stroke-width', '26');
  bg.setAttribute('fill', 'none');
  bg.setAttribute('stroke-linecap', 'round');
  svg.appendChild(bg);
  // ticks and labels
  const ticks = document.createElementNS(xmlns, 'g');
  for(let i=0;i<=10;i++){
    const angle = 180 - (i * 18);
    const [ox,oy] = polar(180,110,96,angle);
    const [ix,iy] = polar(180,110,74,angle);
    const line = document.createElementNS(xmlns,'line');
    line.setAttribute('x1',ox); line.setAttribute('y1',oy); line.setAttribute('x2',ix); line.setAttribute('y2',iy);
    line.setAttribute('stroke','#0a3843'); line.setAttribute('stroke-width','3');
    ticks.appendChild(line);
    if(i%2===0){
      const [lx,ly] = polar(180,110,60,angle);
      const t = document.createElementNS(xmlns,'text');
      t.setAttribute('x',lx); t.setAttribute('y',ly+4); t.setAttribute('text-anchor','middle');
      t.setAttribute('font-size','12'); t.setAttribute('fill','#6ea7b8');
      t.textContent = i*10;
      ticks.appendChild(t);
    }
  }
  svg.appendChild(ticks);
  // needle
  const ng = document.createElementNS(xmlns,'g');
  ng.setAttribute('id','needleGroup'); ng.setAttribute('transform','translate(180,110) rotate(-90)');
  const needle = document.createElementNS(xmlns,'line');
  needle.setAttribute('id','needle'); needle.setAttribute('x1','0'); needle.setAttribute('y1','0'); needle.setAttribute('x2','0'); needle.setAttribute('y2','-82');
  needle.setAttribute('stroke','#ffffff'); needle.setAttribute('stroke-width','4'); needle.setAttribute('stroke-linecap','round');
  const hub = document.createElementNS(xmlns,'circle'); hub.setAttribute('r','8'); hub.setAttribute('fill','#ffffff');
  ng.appendChild(needle); ng.appendChild(hub); svg.appendChild(ng);
}
function polar(cx,cy,r,deg){
  const rad = deg * Math.PI/180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}
function describeArc(cx, cy, r, startAngle, endAngle) {
  const [sx, sy] = polar(cx, cy, r, endAngle);
  const [ex, ey] = polar(cx, cy, r, startAngle);
  const large = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${sx} ${sy} A ${r} ${r} 0 ${large} 0 ${ex} ${ey}`;
}
initGauge();

function animate(){
  // simple easing of gaugeTarget -> gaugeValue
  gaugeValue += (gaugeTarget - gaugeValue) * 0.12;
  // convert gaugeValue (0..300) to rotation (-90..90)
  const deg = (gaugeValue / 300) * 180 - 90;
  const ng = document.getElementById('needleGroup');
  if(ng) ng.setAttribute('transform', `translate(180,110) rotate(${deg})`);
  // show central label with recent speed (rounded)
  speedLabel.textContent = `${Math.round(gaugeValue)} Mbps`;
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// worker message handling
worker.onmessage = (e) => {
  const msg = e.data;
  if (!msg) return;
  if (msg.type === 'ping') {
    pingEl.textContent = msg.ping;
    jitterEl.textContent = msg.jitter;
    statusEl.textContent = 'Measured ping';
  } else if (msg.type === 'download_update') {
    // bytes, elapsed, mbps, final
    dlEl.textContent = msg.mbps.toFixed(2);
    statusEl.textContent = msg.final ? 'Download complete' : 'Downloading...';
    // map mbps to 0..300 gauge scale
    gaugeTarget = Math.max(0, Math.min(300, msg.mbps));
  } else if (msg.type === 'upload') {
    upEl.textContent = msg.upMbps.toFixed(2);
    statusEl.textContent = 'Upload complete';
  } else if (msg.type === 'upload_error') {
    upEl.textContent = '--';
    console.warn('Upload error', msg.message);
  } else if (msg.type === 'error') {
    statusEl.textContent = 'Error: ' + (msg.message||'');
  } else if (msg.type === 'cycle_complete') {
    // automatically restart cycle (real-time monitoring)
    if (running) {
      // ask worker to start again
      worker.postMessage({ cmd:'start', downUrl: DOWN_URL, upUrl: UP_URL, singleShot:true });
    }
  }
};

// control buttons
startBtn.addEventListener('click', () => {
  if (running) return;
  running = true;
  startBtn.disabled = true;
  stopBtn.disabled = false;
  statusEl.textContent = 'Starting real-time test...';
  worker.postMessage({ cmd:'start', downUrl: DOWN_URL, upUrl: UP_URL, singleShot:true });
});

stopBtn.addEventListener('click', () => {
  running = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  statusEl.textContent = 'Stopped';
  worker.postMessage({ cmd:'stop' });
});

fullBtn.addEventListener('click', async () => {
  // run a full cycle: ping -> longer download (singleShot false) -> upload
  statusEl.textContent = 'Running full accurate test...';
  worker.postMessage({ cmd:'start', downUrl: DOWN_URL, upUrl: UP_URL, singleShot:true });
  // when cycle_complete arrives, you can trigger longer download by starting with singleShot:false,
  // but here we use repeated singleShot passes for steady reading.
});

// history controls
clearHistory.addEventListener('click', () => {
  if(!confirm('Clear saved history?')) return;
  history = [];
  localStorage.removeItem('rt_speed_history');
  renderHistory();
});
exportHistory.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(history, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'speed-history.json'; a.click();
  URL.revokeObjectURL(url);
});

// Save snapshot after each full cycle (optional)
// For this demo we save on each download final update (a simple approach)
let lastSavedTime = 0;
worker.onmessage = (e) => {
  const msg = e.data;
  // we still want to handle previous messages, so call original handler via switch:
  if (!msg) return;
  // handle events as above (call existing handler logic)
  // To avoid duplicating code, we call a small wrapper:
  handleWorkerMessage(msg);
};

function handleWorkerMessage(msg){
  if (msg.type === 'ping') {
    pingEl.textContent = msg.ping;
    jitterEl.textContent = msg.jitter;
    statusEl.textContent = 'Measured ping';
  } else if (msg.type === 'download_update') {
    dlEl.textContent = msg.mbps.toFixed(2);
    statusEl.textContent = msg.final ? 'Download complete' : 'Downloading...';
    gaugeTarget = Math.max(0, Math.min(300, msg.mbps));
    if (msg.final) {
      // Save a snapshot every time a final download result is available (throttle to avoid spam)
      const now = Date.now();
      if (now - lastSavedTime > 1500) {
        const entry = { t: now, down: Number(msg.mbps.toFixed(2)), up: (upEl.textContent && upEl.textContent!=='—') ? Number(upEl.textContent) : 0, ping: (pingEl.textContent && pingEl.textContent!=='—') ? Number(pingEl.textContent) : 0 };
        saveHistoryEntry(entry);
        lastSavedTime = now;
      }
      // After download final, also try upload by instructing worker (but keep singleShot)
      worker.postMessage({ cmd:'start', downUrl: DOWN_URL, upUrl: UP_URL, singleShot:true });
    }
  } else if (msg.type === 'upload') {
    upEl.textContent = msg.upMbps.toFixed(2);
    statusEl.textContent = 'Upload done';
  } else if (msg.type === 'upload_error') {
    upEl.textContent = '--';
    console.warn('Upload error', msg.message);
  } else if (msg.type === 'error') {
    statusEl.textContent = 'Error: ' + (msg.message||'');
  } else if (msg.type === 'cycle_complete') {
    if (running) worker.postMessage({ cmd:'start', downUrl: DOWN_URL, upUrl: UP_URL, singleShot:true });
  }
}

// initialize gauge label
speedLabel.textContent = '— Mbps';
statusEl.textContent = 'Idle';
