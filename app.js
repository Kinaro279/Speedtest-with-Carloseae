// app.js

// Utilities
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

const startBtn = $('#startBtn');
const saveBtn = $('#saveBtn');
const downloadDisplay = $('#downloadDisplay');
const uploadDisplay = $('#uploadDisplay');
const pingDisplay = $('#pingDisplay');
const jitterDisplay = $('#jitterDisplay');
const statusText = $('#statusText');
const historyList = $('#historyList');
const clearHistoryBtn = $('#clearHistory');
const exportBtn = $('#exportHistory');
const themeToggle = $('#themeToggle');

let lastResult = null;
let history = JSON.parse(localStorage.getItem('pro_speed_history') || '[]');

function setStatus(txt){ statusText.textContent = txt; }
function setDownload(x){ downloadDisplay.textContent = `${x} Mbps`; }
function setUpload(x){ uploadDisplay.textContent = `${x} Mbps`; }
function setPing(x){ pingDisplay.textContent = `${x} ms`; }
function setJitter(x){ jitterDisplay.textContent = `${x} ms`; }

function formatTime(ts){ return new Date(ts).toLocaleString(); }

function renderHistory(){
  historyList.innerHTML = '';
  if(history.length===0){ historyList.innerHTML = `<div class="history-row">No saved results</div>`; return; }
  history.slice().reverse().forEach(r=>{
    const row = document.createElement('div');
    row.className='history-row';
    row.innerHTML = `<div>
      <div style="font-weight:700">${formatTime(r.t)}</div>
      <div style="font-size:0.9rem;color:var(--muted)">${r.note||''}</div>
    </div>
    <div style="text-align:right">
      <div style="font-weight:700">${r.down} Mbps</div>
      <div style="font-size:0.85rem;color:var(--muted)">${r.up} / ${r.ping} ms</div>
    </div>`;
    historyList.appendChild(row);
  });
}

// Save / Export / Clear
function saveResultToHistory(result){
  history.push(result);
  localStorage.setItem('pro_speed_history', JSON.stringify(history));
  updateDownloadChart(history);
  renderHistory();
}

clearHistoryBtn.addEventListener('click', ()=>{
  if(!confirm('Clear saved history?')) return;
  history = [];
  localStorage.setItem('pro_speed_history', JSON.stringify(history));
  updateDownloadChart(history);
  renderHistory();
});

exportBtn.addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(history, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'speed-history.json'; a.click();
  URL.revokeObjectURL(url);
});

// Theme toggle
themeToggle.addEventListener('click', ()=>{
  const cur = document.documentElement.getAttribute('data-theme');
  if(cur==='light'){ document.documentElement.removeAttribute('data-theme'); localStorage.removeItem('theme'); }
  else { document.documentElement.setAttribute('data-theme','light'); localStorage.setItem('theme','light'); }
});
if(localStorage.getItem('theme')==='light') document.documentElement.setAttribute('data-theme','light');

// Chart initial
document.addEventListener('DOMContentLoaded', ()=>{ updateDownloadChart(history); renderHistory(); });

// Speed test implementation
// NOTE: Uses public Cloudflare endpoints for download/upload test blobs (no auth).
// CORS can vary by provider; if any fetch fails due to CORS, replace endpoints with your own test file host.
const DOWN_URL = 'https://speed.cloudflare.com/__down?bytes=50000000';
const PING_URL = 'https://speed.cloudflare.com/__down';
const UP_URL = 'https://speed.cloudflare.com/__up';

async function pingTest(){
  setStatus('Measuring ping...');
  const attempts = 4; const times = [];
  for(let i=0;i<attempts;i++){
    const t0 = performance.now();
    try{
      await fetch(PING_URL, {cache:'no-store', mode:'cors'} );
      const t1 = performance.now();
      times.push(Math.round(t1 - t0));
      await new Promise(r=>setTimeout(r, 150));
    }catch(e){
      times.push(999);
    }
  }
  const ping = times[0] || Math.round(times.reduce((a,b)=>a+b,0)/times.length);
  const jitter = Math.round(Math.max(...times) - Math.min(...times));
  setPing(ping); setJitter(jitter);
  return {ping, jitter};
}

async function downloadTest(){
  setStatus('Downloading test file...');
  try{
    const t0 = performance.now();
    const res = await fetch(DOWN_URL, {cache:'no-store', mode:'cors'});
    const blob = await res.blob();
    const t1 = performance.now();
    const seconds = (t1 - t0)/1000;
    const mbps = Math.max(0.01, ((blob.size * 8) / seconds / 1024 / 1024)).toFixed(2);
    setDownload(mbps);
    lastResult && (lastResult.down = mbps);
    // animate gauge
    window.Gauge.animateTo(Number(mbps));
    window.Gauge.setLabel(`${mbps} Mbps`);
    return mbps;
  }catch(e){
    setStatus('Download failed'); setDownload('0.00');
    return '0.00';
  }
}

async function uploadTest(){
  setStatus('Uploading test data...');
  try{
    // 3 MB random
    const size = 3*1024*1024;
    const data = new Uint8Array(size);
    crypto.getRandomValues(data);
    const t0 = performance.now();
    await fetch(UP_URL, { method:'POST', body: data, mode:'cors' });
    const t1 = performance.now();
    const seconds = (t1 - t0)/1000;
    const mbps = Math.max(0.01, ((size * 8) / seconds / 1024 / 1024)).toFixed(2);
    setUpload(mbps);
    return mbps;
  }catch(e){
    setUpload('0.00'); setStatus('Upload failed');
    return '0.00';
  }
}

startBtn.addEventListener('click', async ()=>{
  startBtn.disabled = true;
  setStatus('Starting test...');
  // reset displays
  setDownload('—'); setUpload('—'); setPing('—'); setJitter('—');
  window.Gauge.setLabel('Testing...');
  try{
    const pingRes = await pingTest();
    const down = await downloadTest();
    const up = await uploadTest();
    const result = {
      t: Date.now(), down: down, up: up, ping: pingRes.ping, jitter: pingRes.jitter
    };
    lastResult = result;
    setStatus('Test finished');
    saveResultToHistory(result);
  }catch(e){
    console.error(e); setStatus('Test error');
  } finally {
    startBtn.disabled = false;
  }
});

// Save button saves last result explicitly
saveBtn.addEventListener('click', ()=>{
  if(!lastResult) return alert('Run a test first');
  saveResultToHistory(lastResult);
});

// helper: reflect initial gauge label
document.addEventListener('DOMContentLoaded', ()=>{
  if(window.Gauge) window.Gauge.setLabel('— Mbps');
});
