/* =========================================================
   Photobooth Digital 0217 — pilih tema, ambil foto, hias otomatis
   ========================================================= */
(function () {
    "use strict";

    // 10 tema kertas photobooth, palet selaras dengan nuansa vintage rose studio
    var TEMPLATES = [
        { id: "thumbelina", nama: "Bunga Thumbelina", warna: ["#f6e6da", "#f4ecea"], bingkai: "#b76e79", dekor: ["🌸", "🌷", "🍃", "🌼"], teks: " 🌸" },
        { id: "mawar", nama: "Mawar Vintage", warna: ["#f3d9dd", "#fdf3ef"], bingkai: "#9c5c67", dekor: ["🌹", "🥀", "🍂", "💌"], teks: "🌹" },
        { id: "kelinci", nama: "Kelinci Krem", warna: ["#faf1e6", "#f6e2e6"], bingkai: "#c98a95", dekor: ["🐰", "🥕", "🎀", "💗"], teks: "🐰" },
        { id: "kucing", nama: "Kucing Senja", warna: ["#f0e2da", "#f4e8ea"], bingkai: "#a9705f", dekor: ["🐱", "🧶", "🌇", "✨"], teks: "🐱" },
        { id: "kupu", nama: "Kupu Pastel", warna: ["#eadff0", "#f8e9ee"], bingkai: "#a67aa0", dekor: ["🦋", "🌺", "🍃", "💫"], teks: "🦋" },
        { id: "kopi", nama: "Kopi Manis", warna: ["#e9d8ce", "#f4ecea"], bingkai: "#8a5a45", dekor: ["☕", "🤎", "🍪", "✨"], teks: "☕" },
        { id: "bintang", nama: "Bintang Sendu", warna: ["#dfe1ec", "#f1e6ea"], bingkai: "#6f6690", dekor: ["🌙", "⭐", "✨", "💫"], teks: "🌙" },
        { id: "boneka", nama: "Boneka Kain", warna: ["#f7e4d8", "#fbeee7"], bingkai: "#b98363", dekor: ["🧸", "🎀", "🍯", "💛"], teks: "🧸" },
        { id: "kado", nama: "Kado Pita", warna: ["#f6dde2", "#fdf4ef"], bingkai: "#c46c7c", dekor: ["🎁", "🎀", "💌", "✨"], teks: "🎁" },
        { id: "kertas", nama: "Kertas Lama", warna: ["#ece0cf", "#f6efe4"], bingkai: "#8c7355", dekor: ["📜", "🖋️", "🍂", "🕯️"], teks: "📜" }
    ];

    var tplTerpilih = null;
    var mode = null; // "kamera" | "galeri"
    var foto = [];   // dataURL, maksimal 3
    var streamKamera = null;

    // ---------- Render pilihan tema ----------
    var tplGrid = document.getElementById("pbTplGrid");
    if (!tplGrid) return; // section photobooth tidak ada di halaman ini

    TEMPLATES.forEach(function (t) {
        var kartu = document.createElement("div");
        kartu.className = "pb-tpl-card";
        kartu.innerHTML =
            '<div class="pb-check">✓</div>' +
            '<div class="pb-swatch" style="background:linear-gradient(135deg, ' + t.warna[0] + ', ' + t.warna[1] + ');">' + t.dekor[0] + '</div>' +
            '<div class="pb-tname">' + t.nama + '</div>';
        kartu.addEventListener("click", function () {
            var semua = tplGrid.querySelectorAll(".pb-tpl-card");
            for (var i = 0; i < semua.length; i++) semua[i].classList.remove("terpilih");
            kartu.classList.add("terpilih");
            tplTerpilih = t;
            document.getElementById("pbToStep2").disabled = false;
        });
        tplGrid.appendChild(kartu);
    });

    // ---------- Navigasi langkah ----------
    function tampilkanPanel(n) {
        [1, 2, 3].forEach(function (i) {
            document.getElementById("pbPanel" + i).classList.toggle("aktif", i === n);
            var pill = document.getElementById("pbPill" + i);
            pill.classList.toggle("aktif", i === n);
            pill.classList.toggle("selesai", i < n);
        });
    }
    document.getElementById("pbToStep2").addEventListener("click", function () { tampilkanPanel(2); });
    document.getElementById("pbBack1").addEventListener("click", function () { hentikanKamera(); tampilkanPanel(1); });

    // ---------- Pilih mode ambil foto ----------
    var camUI = document.getElementById("pbCameraUI");
    var galUI = document.getElementById("pbGalleryUI");
    var modeRow = document.getElementById("pbModeRow");

    document.getElementById("pbPickCamera").addEventListener("click", async function () {
        mode = "kamera";
        resetFoto();
        modeRow.classList.add("pb-sembunyi");
        galUI.classList.add("pb-sembunyi");
        camUI.classList.remove("pb-sembunyi");
        await mulaiKamera();
    });
    document.getElementById("pbPickGallery").addEventListener("click", function () {
        mode = "galeri";
        resetFoto();
        modeRow.classList.add("pb-sembunyi");
        camUI.classList.add("pb-sembunyi");
        hentikanKamera();
        galUI.classList.remove("pb-sembunyi");
    });
    document.getElementById("pbBackModeCam").addEventListener("click", kembaliKeModeRow);
    document.getElementById("pbBackModeGal").addEventListener("click", kembaliKeModeRow);
    function kembaliKeModeRow() {
        hentikanKamera();
        camUI.classList.add("pb-sembunyi");
        galUI.classList.add("pb-sembunyi");
        modeRow.classList.remove("pb-sembunyi");
        resetFoto();
    }

    // ---------- Kamera ----------
    var video = document.getElementById("pbVideo");
    async function mulaiKamera() {
        try {
            streamKamera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
            video.srcObject = streamKamera;
        } catch (err) {
            document.getElementById("pbCountdownBox").innerHTML =
                '<p style="color:#9c3b4a; font-family:var(--font-judul);">Tidak bisa akses kamera (' + err.name + '). Coba pilih "Dari Galeri" ya.</p>';
        }
    }
    function hentikanKamera() {
        if (streamKamera) {
            streamKamera.getTracks().forEach(function (tr) { tr.stop(); });
            streamKamera = null;
        }
    }

    document.getElementById("pbStartCapture").addEventListener("click", jalankanAmbilOtomatis);

    async function jalankanAmbilOtomatis() {
        if (!streamKamera) return;
        var tombol = document.getElementById("pbStartCapture");
        tombol.disabled = true;
        foto = [];
        renderFoto();
        for (var i = 0; i < 3; i++) {
            await hitungMundurLaluJepret(i + 1);
        }
        document.getElementById("pbCountdownBox").innerHTML =
            '<p style="font-family:var(--font-judul); color:var(--rose-dark);">Selesai! 🎉</p>';
        tombol.disabled = false;
        cekSiapLanjut();
    }

    function hitungMundurLaluJepret(nomorFoto) {
        return new Promise(function (resolve) {
            var kotak = document.getElementById("pbCountdownBox");
            var n = 3;
            kotak.innerHTML = '<div class="pb-hitung-mundur">' + n + '</div><p style="font-family:var(--font-teks); color:var(--tinta-lembut);">Foto ke-' + nomorFoto + ' dari 3</p>';
            var timer = setInterval(function () {
                n--;
                if (n > 0) {
                    kotak.querySelector(".pb-hitung-mundur").textContent = n;
                } else {
                    clearInterval(timer);
                    kotak.innerHTML = '<div class="pb-hitung-mundur">📸</div>';
                    jepretFoto();
                    setTimeout(resolve, 500);
                }
            }, 700);
        });
    }

    function jepretFoto() {
        var c = document.createElement("canvas");
        c.width = video.videoWidth || 640;
        c.height = video.videoHeight || 480;
        var ctx = c.getContext("2d");
        ctx.translate(c.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, c.width, c.height);
        foto.push(c.toDataURL("image/jpeg", 0.92));
        renderFoto();
    }

    // ---------- Galeri ----------
    var dropGaleri = document.getElementById("pbGalleryDrop");
    var inputFile = document.getElementById("pbFileInput");
    dropGaleri.addEventListener("click", function () { inputFile.click(); });
    inputFile.addEventListener("change", function (e) {
        var berkas = Array.prototype.slice.call(e.target.files).slice(0, 3);
        if (berkas.length < 1) return;
        foto = [];
        var dimuat = 0;
        berkas.forEach(function (file) {
            var reader = new FileReader();
            reader.onload = function (ev) {
                foto.push(ev.target.result);
                dimuat++;
                renderFoto();
                if (dimuat === berkas.length) cekSiapLanjut();
            };
            reader.readAsDataURL(file);
        });
    });

    // ---------- Pratinjau foto yang sudah diambil ----------
    function resetFoto() {
        foto = [];
        renderFoto();
        document.getElementById("pbToStep3").disabled = true;
    }
    function renderFoto() {
        var baris = document.getElementById("pbShotsRow");
        baris.innerHTML = "";
        for (var i = 0; i < 3; i++) {
            if (foto[i]) {
                var img = document.createElement("img");
                img.src = foto[i];
                img.className = "pb-shot-thumb";
                baris.appendChild(img);
            } else {
                var d = document.createElement("div");
                d.className = "pb-shot-thumb kosong";
                d.textContent = i + 1;
                baris.appendChild(d);
            }
        }
        cekSiapLanjut();
    }
    function cekSiapLanjut() {
        document.getElementById("pbToStep3").disabled = foto.length < 3;
    }

    document.getElementById("pbToStep3").addEventListener("click", async function () {
        hentikanKamera();
        await buatPhotostrip();
        tampilkanPanel(3);
    });

    // ---------- Susun photostrip akhir ----------
    function muatGambar(src) {
        return new Promise(function (resolve) {
            var img = new Image();
            img.onload = function () { resolve(img); };
            img.src = src;
        });
    }

    function persegiBersudut(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    async function buatPhotostrip() {
        var t = tplTerpilih;
        document.getElementById("pbTplNameLabel").textContent = t.nama;

        if (document.fonts && document.fonts.ready) {
            try { await document.fonts.ready; } catch (e) { /* abaikan */ }
        }

        var canvas = document.getElementById("pbResultCanvas");
        var W = 560, H = 1500;
        canvas.width = W; canvas.height = H;
        var ctx = canvas.getContext("2d");

        var grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, t.warna[0]);
        grad.addColorStop(1, t.warna[1]);
        ctx.fillStyle = grad;
        persegiBersudut(ctx, 0, 0, W, H, 10);
        ctx.fill();

        ctx.strokeStyle = t.bingkai;
        ctx.lineWidth = 8;
        persegiBersudut(ctx, 10, 10, W - 20, H - 20, 6);
        ctx.stroke();

        ctx.fillStyle = t.bingkai;
        ctx.font = "600 38px Fraunces, Georgia, serif";
        ctx.textAlign = "center";
        ctx.fillText(t.nama, W / 2, 76);

        ctx.font = "32px sans-serif";
        var titikDekor = [
            [40, 138], [W - 60, 168], [36, 418], [W - 58, 458],
            [38, 698], [W - 58, 738], [40, 978], [W - 58, 1008],
            [70, 1298], [W - 90, 1318]
        ];
        titikDekor.forEach(function (pos, i) {
            ctx.fillText(t.dekor[i % t.dekor.length], pos[0], pos[1]);
        });

        var lebarSlot = W - 140;
        var tinggiSlot = 360;
        var xSlot = 70;
        var yAwal = 118;
        var jarak = 30;

        for (var i = 0; i < 3; i++) {
            var y = yAwal + i * (tinggiSlot + jarak);

            ctx.save();
            ctx.shadowColor = "rgba(74,44,51,0.18)";
            ctx.shadowBlur = 12;
            ctx.shadowOffsetY = 5;
            ctx.fillStyle = "#fffaf8";
            persegiBersudut(ctx, xSlot - 10, y - 10, lebarSlot + 20, tinggiSlot + 20, 8);
            ctx.fill();
            ctx.restore();

            var img = await muatGambar(foto[i]);
            var rasioTarget = lebarSlot / tinggiSlot;
            var rasioGambar = img.width / img.height;
            var sx, sy, sw, sh;
            if (rasioGambar > rasioTarget) {
                sh = img.height; sw = sh * rasioTarget;
                sx = (img.width - sw) / 2; sy = 0;
            } else {
                sw = img.width; sh = sw / rasioTarget;
                sx = 0; sy = (img.height - sh) / 2;
            }
            ctx.save();
            persegiBersudut(ctx, xSlot, y, lebarSlot, tinggiSlot, 4);
            ctx.clip();
            ctx.drawImage(img, sx, sy, sw, sh, xSlot, y, lebarSlot, tinggiSlot);
            ctx.restore();

            ctx.strokeStyle = t.bingkai;
            ctx.lineWidth = 4;
            persegiBersudut(ctx, xSlot, y, lebarSlot, tinggiSlot, 4);
            ctx.stroke();

            ctx.font = "28px sans-serif";
            ctx.fillText(t.dekor[(i + 1) % t.dekor.length], xSlot + lebarSlot - 14, y + 36);
        }

        var yFooter = yAwal + 3 * (tinggiSlot + jarak) + 26;
        ctx.fillStyle = t.bingkai;
        ctx.font = "italic 600 27px Fraunces, Georgia, serif";
        ctx.fillText(t.teks, W / 2, yFooter);

        ctx.font = "500 17px Quicksand, Arial, sans-serif";
        ctx.fillStyle = "#7a5860";
        var tanggal = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
        ctx.fillText(tanggal + "  •  0217 Digital Studio", W / 2, yFooter + 38);
    }

    document.getElementById("pbDownloadBtn").addEventListener("click", function () {
        var canvas = document.getElementById("pbResultCanvas");
        var a = document.createElement("a");
        a.download = "photobooth-0217-" + tplTerpilih.id + ".png";
        a.href = canvas.toDataURL("image/png");
        a.click();
    });

    document.getElementById("pbRestartBtn").addEventListener("click", function () {
        foto = [];
        mode = null;
        camUI.classList.add("pb-sembunyi");
        galUI.classList.add("pb-sembunyi");
        modeRow.classList.remove("pb-sembunyi");
        resetFoto();
        tampilkanPanel(1);
    });

    // mulai dari langkah 1
    tampilkanPanel(1);
})();
