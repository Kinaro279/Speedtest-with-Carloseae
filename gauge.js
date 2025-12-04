// gauge.js
// Renders an animated semi-circular gauge and exposes `animateTo(value)`
// value expected in Mbps; we compute a normalized 0..100 internal gauge value.

(function () {
  const svg = document.getElementById('speedGauge');

  // build static SVG once
  function createGauge() {
    svg.innerHTML = `
      <defs>
        <linearGradient id="g1" x1="0" x2="1">
          <stop offset="0%" stop-color="#00eaff"/>
          <stop offset="65%" stop-color="#ffd166"/>
          <stop offset="100%" stop-color="#ff6b6b"/>
        </linearGradient>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="6" stdDeviation="10" flood-opacity="0.25" />
        </filter>
      </defs>

      <g transform="translate(0,0)">
        <!-- background arc -->
        <path id="arcBg" fill="none" stroke="#182331" stroke-width="18" stroke-linecap="round"/>
        <!-- colored arc -->
        <path id="arcFill" fill="none" stroke="url(#g1)" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
        <!-- ticks -->
        <g id="ticks"></g>
        <!-- needle -->
        <g id="needleGroup" transform="translate(180,140)">
          <line id="needle" x1="0" y1="0" x2="0" y2="-88" stroke="#ffffff" stroke-width="3" stroke-linecap="round" />
          <circle r="8" fill="#ffffff" stroke="rgba(255,255,255,0.06)" stroke-width="2"/>
        </g>
        <!-- center text -->
        <g id="centerText" transform="translate(180,170)">
          <text id="centerValue" x="0" y="0" text-anchor="middle" font-size="20" fill="var(--accent)" font-weight="700">— Mbps</text>
        </g>
      </g>
    `;
    drawArcsAndTicks();
  }

  function polar(cx, cy, r, angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  }

  function describeArc(cx, cy, r, startAngle, endAngle) {
    const [sx, sy] = polar(cx, cy, r, endAngle);
    const [ex, ey] = polar(cx, cy, r, startAngle);
    const large = endAngle - startAngle <= 180 ? 0 : 1;
    return `M ${sx} ${sy} A ${r} ${r} 0 ${large} 0 ${ex} ${ey}`;
  }

  function drawArcsAndTicks() {
    // viewBox is 0 0 360 240
    const cx = 180, cy = 140, r = 100;
    const arcBg = svg.querySelector('#arcBg');
    const arcFill = svg.querySelector('#arcFill');
    arcBg.setAttribute('d', describeArc(cx, cy, r, 0, 180));
    arcFill.setAttribute('d', describeArc(cx, cy, r, 0, 0)); // initially zero length

    // ticks
    const ticksG = svg.querySelector('#ticks');
    ticksG.innerHTML = '';
    for (let i=0;i<=10;i++){
      const angle = 180 - (i * 18); // 0..180
      const outer = polar(cx, cy, r+8, angle);
      const inner = polar(cx, cy, r-12, angle);
      const line = document.createElementNS('http://www.w3.org/2000/svg','line');
      line.setAttribute('x1', outer[0]); line.setAttribute('y1', outer[1]);
      line.setAttribute('x2', inner[0]); line.setAttribute('y2', inner[1]);
      line.setAttribute('stroke', '#0f2633'); line.setAttribute('stroke-width','2');
      ticksG.appendChild(line);
      // labels every other tick
      if(i%2===0){
        const lab = document.createElementNS('http://www.w3.org/2000/svg','text');
        const pos = polar(cx, cy, r-28, angle);
        lab.setAttribute('x', pos[0]); lab.setAttribute('y', pos[1]+6);
        lab.setAttribute('text-anchor','middle'); lab.setAttribute('font-size','10');
        lab.setAttribute('fill','#9fb5c6'); lab.textContent = Math.round(i*10);
        ticksG.appendChild(lab);
      }
    }
  }

  // animate needle with simple easing physics
  let currentDeg = 180; // leftmost (0)
  let targetDeg = 180;
  let animating = false;

  function setFillArc(deg){
    const cx=180, cy=140, r=100;
    const start = 180, end = deg; // deg in [0..180]
    const arcFill = svg.querySelector('#arcFill');
    arcFill.setAttribute('d', describeArc(cx, cy, r, end, start));
  }

  function updateNeedle(deg){
    const ng = svg.querySelector('#needleGroup');
    ng.setAttribute('transform', `translate(180,140) rotate(${deg-180})`);
    const centerValue = svg.querySelector('#centerValue');
    const val = Math.round(((180-deg)/180)*100*1.5); // map to approximate mbps (scale)
    centerValue.textContent = `${val} Mbps`;
  }

  function tick(){
    if(!animating) return;
    const diff = targetDeg - currentDeg;
    // spring-like motion
    currentDeg += diff * 0.14;
    setFillArc(currentDeg);
    updateNeedle(currentDeg);
    // stop when close
    if(Math.abs(diff) < 0.1){
      currentDeg = targetDeg;
      setFillArc(currentDeg);
      updateNeedle(currentDeg);
      animating = false;
    } else {
      requestAnimationFrame(tick);
    }
  }

  // public API: animateTo(mbps)
  window.Gauge = {
    init() { createGauge(); updateNeedle(currentDeg); },
    animateTo(mbps){
      // convert mbps to deg: assume 0..300 Mbps maps to 180..0 deg
      const cap = Math.max(0, Math.min(300, mbps));
      const pct = cap / 300;
      targetDeg = 180 - pct * 180;
      if(!animating){ animating = true; requestAnimationFrame(tick); } 
    },
    setLabel(text){
      const c = svg.querySelector('#centerValue');
      if(c) c.textContent = text;
    }
  };

  // initialize on load
  document.addEventListener('DOMContentLoaded', () => { if(svg) Gauge.init(); });
})();
