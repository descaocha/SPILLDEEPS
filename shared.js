/* Data dan fungsi yang dipakai bersama oleh index.html dan moderator.html */
window.MA = (function () {
  var FAK = [
    "FT · Teknik", "FEB · Ekonomika dan Bisnis", "FH · Hukum", "FISIP · Ilmu Sosial dan Ilmu Politik",
    "FIB · Ilmu Budaya", "FK · Kedokteran", "FKM · Kesehatan Masyarakat", "FPIK · Perikanan dan Kelautan",
    "FPP · Peternakan dan Pertanian", "FSM · Sains dan Matematika", "FPsi · Psikologi", "SV · Vokasi"
  ];
  var CATS = { curhat: "Curhat", kehilangan: "Kehilangan", ditemukan: "Barang ditemukan", info: "Info kampus", tanya: "Tanya" };
  var DONE_LABEL = { kehilangan: "Sudah ketemu", ditemukan: "Sudah kembali" };

  var K = {
    relate: "madinganon.relate", hidden: "madinganon.hidden", mine: "madinganon.mine", myreplies: "madinganon.myreplies", viewer: "madinganon.viewer",
    rate: "madinganon.rate", theme: "madinganon.theme", session: "madinganon.modcode"
  };

  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var fmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" });
  function dateLabel(iso) { return fmt.format(new Date(iso + "T00:00:00")); }
  // Waktu relatif ("2 jam lalu"). Kalau server belum mengirim waktu lengkap, pakai tanggal biasa.
  function timeAgo(ts, iso) {
    var t = ts ? new Date(ts).getTime() : NaN;
    if (isNaN(t)) return iso ? dateLabel(iso) : "";
    var m = Math.floor((Date.now() - t) / 60000);
    if (m < 1) return "baru saja";
    if (m < 60) return m + " menit lalu";
    var j = Math.floor(m / 60);
    if (j < 24) return j + " jam lalu";
    var d = Math.floor(j / 24);
    if (d < 7) return d + " hari lalu";
    return iso ? dateLabel(iso) : new Date(t).toLocaleDateString("id-ID");
  }
  function fullTime(ts) {
    var d = ts ? new Date(ts) : null;
    return d && !isNaN(d) ? d.toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" }) : "";
  }
  function randomToken() {
    var a = new Uint8Array(24);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }
  // Id acak per browser, hanya dipakai supaya satu orang tidak melaporkan pesan yang sama berkali-kali
  function viewerId() {
    var v = load(K.viewer, "");
    if (!v) { v = randomToken().slice(0, 20); save(K.viewer, v); }
    return v;
  }

  // Pesan galat dari server (lihat supabase.sql) diterjemahkan ke kalimat yang bisa dibaca
  var ERR = {
    rate_limited: "Terlalu banyak kiriman dari jaringanmu dalam satu jam terakhir. Coba lagi nanti.",
    filter_phone: "Jangan menulis nomor HP atau nomor identitas apa pun.",
    filter_link: "Jangan menulis tautan.",
    filter_social: "Jangan menulis akun media sosial atau kontak pribadi.",
    bad_text: "Panjang pesan tidak sesuai. Pesan 10 sampai 500 huruf, balasan 2 sampai 200 huruf.",
    bad_photo: "Foto tidak bisa diterima server. Coba foto yang lebih kecil.",
    not_found: "Pesan atau balasan ini sudah tidak ada atau belum disetujui.",
    too_deep: "Percakapan ini sudah terlalu dalam. Balas di tingkat yang lebih atas.",
    bad_cat: "Kategori tidak dikenal.", bad_fak: "Nama fakultas terlalu panjang.", bad_token: "Browser ini belum siap, muat ulang halaman."
  };

  // Semua data lewat server Supabase. Browser hanya boleh memanggil fungsi RPC yang ada di supabase.sql.
  function configured() {
    var c = window.MA_CONFIG || {};
    return !!(c.SUPABASE_URL && c.SUPABASE_ANON_KEY && /^https?:\/\//.test(c.SUPABASE_URL));
  }
  function api(fn, args) {
    if (!configured()) return Promise.reject(new Error("Belum terhubung ke database. Isi config.js dulu."));
    var c = window.MA_CONFIG;
    // Kunci baru (sb_publishable_...) hanya boleh di header apikey. Kunci lama "anon" (eyJ...) adalah JWT dan boleh juga di Authorization.
    var headers = { "Content-Type": "application/json", apikey: c.SUPABASE_ANON_KEY };
    if (/^eyJ/.test(c.SUPABASE_ANON_KEY)) headers.Authorization = "Bearer " + c.SUPABASE_ANON_KEY;
    return fetch(c.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/rpc/" + fn, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(args || {})
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
        if (!r.ok) {
          var m = j && j.message ? String(j.message) : "";
          throw new Error(ERR[m] || (m ? "Terjadi masalah di server (" + m + ")." : "Server tidak bisa dihubungi (kode " + r.status + ")."));
        }
        return j;
      });
    }, function () { throw new Error("Tidak ada koneksi internet atau server tidak bisa dihubungi."); });
  }

  // Tema: ikuti pengaturan perangkat, bisa diganti manual dan diingat
  function initTheme(btn) {
    var root = document.documentElement;
    function systemDark() { return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches); }
    function current() { return root.getAttribute("data-theme") || (systemDark() ? "dark" : "light"); }
    function update() {
      var dark = current() === "dark";
      btn.textContent = dark ? "Mode terang" : "Mode gelap";
      btn.setAttribute("aria-pressed", String(dark));
    }
    btn.addEventListener("click", function () {
      var next = current() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next); save(K.theme, next); update();
    });
    if (window.matchMedia) {
      var mq = window.matchMedia("(prefers-color-scheme: dark)");
      if (mq.addEventListener) mq.addEventListener("change", update);
    }
    update();
  }

  return {
    FAK: FAK, CATS: CATS, DONE_LABEL: DONE_LABEL, K: K, load: load, save: save, esc: esc, dateLabel: dateLabel, timeAgo: timeAgo, fullTime: fullTime,
    randomToken: randomToken, viewerId: viewerId, configured: configured, api: api, initTheme: initTheme
  };
})();
