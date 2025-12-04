// chart.js
let downloadChart = null;

function createDownloadChart(initialData = []) {
  const ctx = document.getElementById('downloadChart').getContext('2d');
  downloadChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: initialData.map((d,i)=>new Date(d.t).toLocaleTimeString()),
      datasets: [{
        label: 'Download (Mbps)',
        data: initialData.map(d=>d.down),
        tension: 0.3,
        fill: true,
        backgroundColor: (ctx)=> {
          const g = ctx.createLinearGradient(0,0,0,200);
          g.addColorStop(0, 'rgba(0,234,255,0.18)');
          g.addColorStop(1, 'rgba(0,234,255,0.02)');
          return g;
        },
        borderColor: 'rgba(0,234,255,0.98)',
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--muted') } },
        x: { ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--muted') } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function updateDownloadChart(history) {
  if(!downloadChart) createDownloadChart(history);
  const labels = history.map(h=>new Date(h.t).toLocaleTimeString());
  const data = history.map(h=>Number(h.down));
  downloadChart.data.labels = labels;
  downloadChart.data.datasets[0].data = data;
  downloadChart.update();
}
