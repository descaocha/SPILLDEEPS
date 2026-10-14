/* Halaman moderator Mading Anon (moderator.html). Butuh shared.js. */
(function () {
  // Kode moderator dicek oleh server (hash-nya ada di tabel config di Supabase, bukan di file ini).
  // Cara ganti kode: lihat README-setup.md.
  var K = MA.K, esc = MA.esc, dateLabel = MA.dateLabel, CATS = MA.CATS, api = MA.api;
  var code = "", data = null, armed = {}, busy = false;
  try { code = sessionStorage.getItem(K.session) || ""; } catch (e) {}

  function $(id) { return document.getElementById(id); }

  var toastTimer;
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 4000);
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
    var pend = data.pending, rep = data.reported;
    var auto = rep.filter(function (p) { return p.auto_hidden; }).length;

    $("mstats").innerHTML = [
      [pend.length, "Menunggu persetujuan"], [rep.length, "Dilaporkan"],
      [auto, "Disembunyikan otomatis"], [data.live, "Pesan tampil"]
    ].map(function (x) { return '<div class="mstat"><span class="n">' + x[0] + '</span><span class="l">' + x[1] + "</span></div>"; }).join("");

    $("pendTitle").textContent = "Menunggu persetujuan (" + pend.length + ")";
    $("repTitle").textContent = "Dilaporkan (" + rep.length + ")";

    $("pendList").innerHTML = pend.length ? pend.map(function (p) {
      return card(p, "", btn("approve", p.id, "Setujui", "btn small") + danger("reject", p.id, "Tolak", "Yakin tolak?"));
    }).join("") : '<li class="empty">Tidak ada pesan yang menunggu. Pesan baru dari halaman utama akan muncul di sini.</li>';

    $("repList").innerHTML = rep.length ? rep.map(function (p) {
      var label = '<span class="badge report">' + p.reports + " laporan</span>" + (p.auto_hidden ? '<span class="badge wait">Disembunyikan otomatis</span>' : "");
      return card(p, label, btn("restore", p.id, "Pulihkan", "btn small") + danger("remove", p.id, "Hapus", "Yakin hapus?"));
    }).join("") : '<li class="empty">Tidak ada pesan yang dilaporkan.</li>';
  }

  function view() {
    var authed = !!data;
    $("gate").hidden = authed;
    $("dash").hidden = !authed;
    $("logoutBtn").hidden = !authed;
    if (authed) renderDash();
  }

  var ERRTXT = { bad_code: "Kode salah.", locked: "Terlalu banyak percobaan. Coba lagi sekitar 5 menit lagi." };
  function logout(msg) {
    data = null; code = ""; armed = {};
    try { sessionStorage.removeItem(K.session); } catch (e) {}
    view(); if (msg) toast(msg);
  }
  // Muat data moderator. Server menolak kalau kode salah.
  function load(silent) {
    return api("mod_list", { p_code: code }).then(function (r) {
      if (r && r.error) { logout(); if (!silent) $("modErr").textContent = ERRTXT[r.error] || "Gagal masuk."; return false; }
      data = r; view(); return true;
    }, function (er) { if (!silent) $("modErr").textContent = er.message; return false; });
  }

  $("modLogin").addEventListener("submit", function (e) {
    e.preventDefault();
    var entered = $("modCode").value.trim();
    if (!entered) { $("modErr").textContent = "Masukkan kode moderator."; return; }
    $("modErr").textContent = "Memeriksa...";
    code = entered;
    load(false).then(function (ok) {
      if (ok) {
        try { sessionStorage.setItem(K.session, code); } catch (e2) {}
        $("modCode").value = ""; $("modErr").textContent = ""; toast("Masuk sebagai moderator.");
      } else if ($("modErr").textContent === "Kode salah.") {
        $("modErr").textContent = "Kode salah. Setelah 5 kali salah, kamu dikunci 5 menit.";
      }
    });
  });

  $("logoutBtn").addEventListener("click", function () { logout("Keluar dari panel moderator."); });

  $("dash").addEventListener("click", function (e) {
    var b = e.target.closest("[data-mact]"); if (!b || busy) return;
    var id = Number(b.getAttribute("data-id")), act = b.getAttribute("data-mact");
    if ((act === "reject" || act === "remove") && !armed[act + id]) { armed[act + id] = true; renderDash(); return; }
    delete armed[act + id];
    var msg = { approve: "Pesan disetujui dan tampil di halaman utama.", restore: "Pesan dipulihkan dan tampil lagi di halaman utama.",
      reject: "Pesan ditolak dan dihapus.", remove: "Pesan dihapus." }[act];
    busy = true;
    api("mod_action", { p_code: code, p_post: id, p_action: act }).then(function (r) {
      if (r && r.error) { logout(ERRTXT[r.error]); return; }
      toast(msg); return load(true);
    }, function (er) { toast(er.message); }).then(function () { busy = false; });
  });

  // Segarkan antrean tiap 20 detik selama panel terbuka
  setInterval(function () { if (data && !document.hidden && !busy) load(true); }, 20000);

  MA.initTheme($("themeBtn"));
  view();
  if (code) load(true);
})();
