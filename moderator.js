/* Halaman moderator Mading Anon (moderator.html). Butuh shared.js. */
(function () {
  // Kode moderator (demo). Kode dicek di browser, jadi ini bukan pengamanan sungguhan.
  // Ganti kode: di konsol browser jalankan
  //   crypto.subtle.digest("SHA-256", new TextEncoder().encode("KODEBARU")).then(b => console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("")))
  // lalu tempel hasilnya ke MOD_HASH. Tulis KODEBARU dengan huruf besar.
  var MOD_HASH = "0227b4965978988f25a8ed1ee98f9e8a67b8a122979d7fd197044341088459f9";
  var MAX_TRIES = 5, LOCK_MS = 5 * 60 * 1000;

  var K = MA.K, esc = MA.esc, dateLabel = MA.dateLabel, CATS = MA.CATS, DONE_LABEL = MA.DONE_LABEL;
  var S = MA.createStore();
  var modTry = MA.load(K.modtry, { n: 0, until: 0 });
  var authed = false, armed = {};
  try { authed = sessionStorage.getItem(K.session) === "1"; } catch (e) {}

  function $(id) { return document.getElementById(id); }

  var toastTimer;
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 4000);
  }

  function sha256(text) {
    if (!(window.crypto && window.crypto.subtle)) return Promise.reject(new Error("no-crypto"));
    return window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
    });
  }

  function card(p, label, buttons) {
    return '<li class="note c-' + p.cat + '"><div class="meta"><span class="tag t-' + p.cat + '">' + esc(CATS[p.cat]) + "</span>" + label +
      '<span class="anon">Anon #' + esc(p.anon) + "</span>" + (p.fak ? "<span>" + esc(p.fak) + "</span>" : "") +
      "<span>" + dateLabel(p.date) + "</span></div>" +
      '<p class="text">' + esc(p.text) + "</p>" +
      (p.photo ? '<img class="photo" src="' + p.photo + '" alt="Foto yang dilampirkan pada pesan" loading="lazy">' : "") +
      '<div class="mact">' + buttons + "</div></li>";
  }
  function btn(act, id, text, cls) {
    return '<button type="button" class="' + cls + '" data-mact="' + act + '" data-id="' + id + '">' + text + "</button>";
  }
  function danger(act, id, text, sure) {
    return btn(act, id, armed[act + id] ? sure : text, "link danger");
  }

  function renderDash() {
    var pend = S.posts.filter(function (p) { return !S.isRemoved(p) && p.pending; });
    var rep = S.posts.filter(function (p) { return !S.isRemoved(p) && S.reportsOf(p) > 0 && !S.mod.cleared[p.id]; });
    var auto = rep.filter(function (p) { return S.autoHidden(p); }).length;
    var live = S.posts.filter(function (p) { return !S.isRemoved(p) && !p.pending && !S.autoHidden(p); }).length;

    $("mstats").innerHTML = [
      [pend.length, "Menunggu persetujuan"], [rep.length, "Dilaporkan"],
      [auto, "Disembunyikan otomatis"], [live, "Pesan tampil"]
    ].map(function (x) { return '<div class="mstat"><span class="n">' + x[0] + '</span><span class="l">' + x[1] + "</span></div>"; }).join("");

    $("pendTitle").textContent = "Menunggu persetujuan (" + pend.length + ")";
    $("repTitle").textContent = "Dilaporkan (" + rep.length + ")";

    $("pendList").innerHTML = pend.length ? pend.map(function (p) {
      return card(p, "", btn("approve", p.id, "Setujui", "btn small") + danger("reject", p.id, "Tolak", "Yakin tolak?"));
    }).join("") : '<li class="empty">Tidak ada pesan yang menunggu. Pesan baru dari halaman utama akan muncul di sini.</li>';

    $("repList").innerHTML = rep.length ? rep.map(function (p) {
      var label = '<span class="badge report">' + S.reportsOf(p) + " laporan</span>" + (S.autoHidden(p) ? '<span class="badge wait">Disembunyikan otomatis</span>' : "");
      return card(p, label, btn("restore", p.id, "Pulihkan", "btn small") + danger("remove", p.id, "Hapus", "Yakin hapus?"));
    }).join("") : '<li class="empty">Tidak ada pesan yang dilaporkan.</li>';
  }

  function view() {
    $("gate").hidden = authed;
    $("dash").hidden = !authed;
    $("logoutBtn").hidden = !authed;
    if (authed) renderDash();
  }

  $("modLogin").addEventListener("submit", function (e) {
    e.preventDefault();
    var now = Date.now();
    if (modTry.until > now) { $("modErr").textContent = "Terlalu banyak percobaan. Coba lagi sekitar " + Math.ceil((modTry.until - now) / 60000) + " menit lagi."; return; }
    var entered = $("modCode").value.trim().toUpperCase();
    if (!entered) { $("modErr").textContent = "Masukkan kode moderator."; return; }
    sha256(entered).then(function (hex) {
      if (hex === MOD_HASH) {
        modTry = { n: 0, until: 0 }; MA.save(K.modtry, modTry);
        authed = true;
        try { sessionStorage.setItem(K.session, "1"); } catch (e2) {}
        $("modCode").value = ""; $("modErr").textContent = "";
        view(); toast("Masuk sebagai moderator (demo).");
      } else {
        modTry.n += 1;
        if (modTry.n >= MAX_TRIES) {
          modTry = { n: 0, until: Date.now() + LOCK_MS };
          $("modErr").textContent = "Kode salah " + MAX_TRIES + " kali. Coba lagi 5 menit lagi.";
        } else {
          $("modErr").textContent = "Kode salah. Sisa percobaan: " + (MAX_TRIES - modTry.n) + ".";
        }
        MA.save(K.modtry, modTry);
      }
    }, function () { $("modErr").textContent = "Browser ini tidak mendukung verifikasi kode."; });
  });

  $("logoutBtn").addEventListener("click", function () {
    authed = false; armed = {};
    try { sessionStorage.removeItem(K.session); } catch (e) {}
    view(); toast("Keluar dari panel moderator.");
  });

  $("dash").addEventListener("click", function (e) {
    var b = e.target.closest("[data-mact]"); if (!b) return;
    var id = Number(b.getAttribute("data-id")), act = b.getAttribute("data-mact");
    if ((act === "reject" || act === "remove") && !armed[act + id]) { armed[act + id] = true; renderDash(); return; }
    delete armed[act + id];
    if (act === "approve") {
      S.patch(id, function (p) { p.pending = false; });
      toast("Pesan disetujui dan tampil di halaman utama.");
    } else if (act === "restore") {
      S.restore(id);
      toast("Pesan dipulihkan dan tampil lagi di halaman utama.");
    } else {
      S.deletePost(id);
      toast(act === "reject" ? "Pesan ditolak dan dihapus." : "Pesan dihapus.");
    }
    renderDash();
  });

  // Kalau halaman utama menambah data di tab lain, muat ulang antrean
  window.addEventListener("storage", function () { S = MA.createStore(); if (authed) renderDash(); });

  MA.initTheme($("themeBtn"));
  view();
})();