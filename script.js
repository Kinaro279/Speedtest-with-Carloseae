document.getElementById("startBtn").addEventListener("click", runSpeedTest);

async function runSpeedTest() {
    const needle = document.getElementById("needle");

    // Disable button to prevent spam-click slowing page
    const btn = document.getElementById("startBtn");
    btn.disabled = true;
    btn.textContent = "Testing...";

    // Smooth animation delay
    await sleep(300);

    let download = fastRandom(5, 100);
    let upload = fastRandom(2, 50);
    let ping = fastRandom(10, 60);

    // Animate gauge smoothly
    animateNeedle(download);

    // Update text without reflow lag
    requestAnimationFrame(() => {
        document.getElementById("download").textContent = download;
        document.getElementById("upload").textContent = upload;
        document.getElementById("ping").textContent = ping;
    });

    saveToHistory(download, upload, ping);

    btn.disabled = false;
    btn.textContent = "Start Test";
}

function animateNeedle(download) {
    let angle = (download / 100) * 180 - 90;

    // Animate using transform (GPU-accelerated, faster)
    requestAnimationFrame(() => {
        document.getElementById("needle").style.transform = `rotate(${angle}deg)`;
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Faster deterministic random generator
function fastRandom(min, max) {
    return Math.floor((Math.random() * (max - min + 1)) + min);
}

// Very fast history storage
function saveToHistory(download, upload, ping) {
    let historyList = document.getElementById("history");

    let now = new Date().toLocaleString();
    let item = document.createElement("li");
    item.textContent = `${now} → Download: ${download} Mbps, Upload: ${upload} Mbps, Ping: ${ping} ms`;

    // Prepend affects performance, so use insertBefore if needed
    historyList.insertBefore(item, historyList.firstChild);

    // Store in localStorage
    let stored = JSON.parse(localStorage.getItem("speedHistory") || "[]");
    stored.unshift({ time: now, download, upload, ping });
    localStorage.setItem("speedHistory", JSON.stringify(stored));
}
