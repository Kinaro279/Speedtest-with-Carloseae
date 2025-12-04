document.getElementById("startBtn").addEventListener("click", runSpeedTest);

function runSpeedTest() {
    let needle = document.getElementById("needle");

    let download = Math.floor(Math.random() * 100);
    let upload = Math.floor(Math.random() * 50);
    let ping = Math.floor(Math.random() * 60);

    // Animate gauge
    let angle = (download / 100) * 180 - 90;
    needle.style.transform = `rotate(${angle}deg)`;

    // Display results
    document.getElementById("download").textContent = download;
    document.getElementById("upload").textContent = upload;
    document.getElementById("ping").textContent = ping;

    saveToHistory(download, upload, ping);
}

function saveToHistory(download, upload, ping) {
    let historyList = document.getElementById("history");
    let item = document.createElement("li");

    let now = new Date().toLocaleString();
    item.textContent = `${now} → Download: ${download} Mbps, Upload: ${upload} Mbps, Ping: ${ping} ms`;

    historyList.prepend(item);

    // store in localStorage
    let stored = JSON.parse(localStorage.getItem("speedHistory") || "[]");
    stored.unshift({ time: now, download, upload, ping });
    localStorage.setItem("speedHistory", JSON.stringify(stored));
}
