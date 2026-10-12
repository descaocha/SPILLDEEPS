/* Halaman publik Mading Anon (index.html). Butuh shared.js. */
(function () {
  var CAMPUS = "Sekitar kampus Tembalang"; // ganti kalau mau kampus lain
  var POST_LIMIT = 3, REPLY_LIMIT = 10, WINDOW_MS = 60 * 60 * 1000; // batas kirim per jam per browser

  var K = MA.K, load = MA.load, save = MA.save, esc = MA.esc, dateLabel = MA.dateLabel;
  var CATS = MA.CATS, DONE_LABEL = MA.DONE_LABEL, FAK = MA.FAK;
  var S = MA.createStore();
  var rate = load(K.rate, { posts: [], replies: [] });
  rate.posts = rate.posts || []; rate.replies = rate.replies || [];
  var openPanels = {}, confirmDel = {};
  var f = { cat: "all", sort: "new", q: "", hideDone: false };

  function $(id) { return document.getElementById(id); }
  function code() { return Math.random().toString(36).slice(2, 6); }
  function canResolve(p) { return p.mine && !!DONE_LABEL[p.cat]; }

  // Batas kirim: kembalikan sisa menit tunggu, atau 0 kalau masih boleh
  function waitMinutes(kind, limit) {
    var now = Date.now();
    rate[kind] = rate[kind].filter(function (t) { return now - t < WINDOW_MS; });
    return rate[kind].length >= limit ? Math.ceil((WINDOW_MS - (now - rate[kind][0])) / 60000) : 0;
  }
  function stamp(kind) { rate[kind].push(Date.now()); save(K.rate, rate); }

  // Penyaring: tolak nomor HP, tautan, dan akun media sosial
  function check(text) {
    if (/\d(?:[\s\-.]?\d){8,}/.test(text)) return "Jangan menulis nomor HP atau nomor identitas apa pun.";
    if (/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|id|co|net|me|ly)\b/i.test(text)) return "Jangan menulis tautan.";
    if (/(^|\s)@\w{2,}/.test(text) || /\b(ig|instagram|line|wa|whatsapp|telegram|tele|tiktok|twitter)\s*[:@]/i.test(text)) return "Jangan menulis akun media sosial atau kontak pribadi.";
    return "";
  }

  $("campusName").textContent = CAMPUS;
  $("fCat").innerHTML = Object.keys(CATS).map(function (k) { return '<option value="' + k + '">' + esc(CATS[k]) + "</option>"; }).join("");
  $("fFak").innerHTML = '<option value="">Tidak disebutkan</option>' + FAK.map(function (a) { return "<option>" + esc(a) + "</option>"; }).join("");

  function renderFilters() {
    var html = '<button type="button" class="chip" data-cat="all" aria-pressed="' + (f.cat === "all") + '">Semua</button>';
    Object.keys(CATS).forEach(function (k) {
      html += '<button type="button" class="chip" data-cat="' + k + '" aria-pressed="' + (f.cat === k) + '">' + esc(CATS[k]) + "</button>";
    });
    $("catFilters").innerHTML = html;
  }

  function matches(p) {
    if (!f.q) return true;
    var hay = (p.text + " " + p.fak + " " + CATS[p.cat]).toLowerCase();
    return f.q.split(/\s+/).every(function (w) { return hay.indexOf(w) !== -1; });
  }

  function renderList() {
    var rows = S.posts.filter(function (p) {
      return S.isPublic(p) && (f.cat === "all" || p.cat === f.cat) && matches(p) && !(f.hideDone && p.resolved);
    });
    rows.sort(function (a, b) {
      if (f.sort === "relate") return S.relateOf(b) - S.relateOf(a);
      return b.date < a.date ? -1 : b.date > a.date ? 1 : b.id - a.id;
    });
    // pesan yang sudah selesai turun ke bawah
    rows = rows.filter(function (p) { return !p.resolved; }).concat(rows.filter(function (p) { return p.resolved; }));
    if (!rows.length) {
      $("list").innerHTML = '<li class="empty">' + (f.q || f.cat !== "all" || f.hideDone
        ? "Tidak ada pesan yang cocok. Coba kata lain atau ubah filter."
        : "Belum ada pesan. Jadilah yang pertama menulis.") + "</li>";
      return;
    }
    $("list").innerHTML = rows.map(function (p) {
      var reps = S.repliesOf(p), open = !!openPanels[p.id];
      var panel = "";
      if (open) {
        panel = '<div class="replies"><ul>' + (reps.length ? reps.map(function (r) {
          return '<li><span class="anon">Anon #' + esc(r.anon) + "</span> " + esc(r.text) + "</li>";
        }).join("") : '<li class="empty-r">Belum ada balasan.</li>') + "</ul>" +
          '<div class="rform"><input type="text" id="rin-' + p.id + '" maxlength="200" placeholder="Tulis balasan anonim" aria-label="Balasan untuk pesan ini">' +
          '<button type="button" class="btn small" data-act="reply" data-id="' + p.id + '">Kirim</button></div></div>';
      }
      var badges = (p.resolved ? '<span class="badge done">' + esc(DONE_LABEL[p.cat] || "Selesai") + "</span>" : "") +
        (p.pending ? '<span class="badge wait">Menunggu moderator</span>' : "");
      var side;
      if (p.mine) {
        side = (canResolve(p) ? '<button type="button" class="link" data-act="resolve" data-id="' + p.id + '">' +
            (p.resolved ? "Buka lagi" : p.cat === "kehilangan" ? "Tandai sudah ketemu" : "Tandai sudah kembali") + "</button>" : "") +
          (p.photo ? '<button type="button" class="link" data-act="delphoto" data-id="' + p.id + '">Hapus foto</button>' : "") +
          '<button type="button" class="link danger" data-act="delpost" data-id="' + p.id + '">' + (confirmDel[p.id] ? "Yakin hapus pesan?" : "Hapus pesan") + "</button>";
      } else {
        side = '<button type="button" class="link" data-act="hide" data-id="' + p.id + '">Laporkan</button>';
      }
      return '<li class="note c-' + p.cat + (p.mine ? " mine" : "") + (p.resolved ? " resolved" : "") + '">' +
        '<div class="meta"><span class="tag t-' + p.cat + '">' + esc(CATS[p.cat]) + "</span>" + badges + '<span class="anon">Anon #' + esc(p.anon) + "</span>" +
        (p.fak ? "<span>" + esc(p.fak) + "</span>" : "") + "<span>" + dateLabel(p.date) + "</span></div>" +
        '<p class="text">' + esc(p.text) + "</p>" +
        (p.photo ? '<img class="photo" src="' + p.photo + '" alt="Foto yang dilampirkan pada pesan" loading="lazy">' : "") +
        '<div class="foot"><button type="button" class="relate" data-act="relate" data-id="' + p.id + '" aria-pressed="' + (!!S.relateSet[p.id]) + '">Relate <span class="c">' + S.relateOf(p) + "</span></button>" +
        '<button type="button" class="link" data-act="toggle" data-id="' + p.id + '" aria-expanded="' + open + '">Balasan (' + reps.length + ")</button>" +
        '<span class="rside">' + side + "</span></div>" +
        panel + "</li>";
    }).join("");
  }

  var toastTimer;
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 4500);
  }

  $("catFilters").addEventListener("click", function (e) {
    var b = e.target.closest("[data-cat]"); if (!b) return;
    f.cat = b.getAttribute("data-cat"); renderFilters(); renderList();
  });
  $("sortBy").addEventListener("change", function (e) { f.sort = e.target.value; renderList(); });
  $("q").addEventListener("input", function (e) { f.q = e.target.value.trim().toLowerCase(); renderList(); });
  $("hideDone").addEventListener("change", function (e) { f.hideDone = e.target.checked; renderList(); });

  $("list").addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var id = Number(b.getAttribute("data-id")), act = b.getAttribute("data-act");
    if (act === "relate") {
      if (S.relateSet[id]) delete S.relateSet[id]; else S.relateSet[id] = 1;
      save(K.relate, S.relateSet);
    } else if (act === "toggle") {
      openPanels[id] = !openPanels[id];
    } else if (act === "resolve") {
      var now = null;
      S.posts.forEach(function (p) { if (p.id === id) now = !p.resolved; });
      S.patch(id, function (p) { p.resolved = now; });
      toast(now ? "Pesan ditandai selesai dan dipindah ke bawah." : "Pesan dibuka lagi.");
    } else if (act === "delphoto") {
      S.patch(id, function (p) { delete p.photo; });
      toast("Foto dihapus dari pesanmu.");
    } else if (act === "delpost") {
      if (!confirmDel[id]) { confirmDel[id] = true; renderList(); return; }
      delete confirmDel[id]; delete openPanels[id];
      S.deletePost(id);
      toast("Pesan dihapus.");
    } else if (act === "hide") {
      S.hidden[id] = 1; S.myReports[id] = 1;
      save(K.hidden, S.hidden); save(K.reports, S.myReports);
      toast("Pesan disembunyikan dari tampilanmu dan dicatat sebagai laporan.");
    } else if (act === "reply") {
      var input = $("rin-" + id), text = input.value.trim();
      if (text.length < 2) { toast("Balasan terlalu pendek."); return; }
      var err = check(text); if (err) { toast(err); return; }
      var wr = waitMinutes("replies", REPLY_LIMIT);
      if (wr) { toast("Balasanmu sudah banyak dalam satu jam terakhir. Coba lagi sekitar " + wr + " menit lagi."); return; }
      (S.userReplies[id] = S.userReplies[id] || []).push({ anon: code(), text: text });
      stamp("replies");
      save(K.replies, S.userReplies);
    }
    renderList();
  });

  $("fMsg").addEventListener("input", function (e) { $("counter").textContent = e.target.value.length + " / 500"; });

  // Foto: diperkecil lewat canvas supaya ringan dan data lokasi (EXIF) ikut terhapus
  var pendingPhoto = null, busy = false;
  function shrink(file, cb) {
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      var s = Math.min(1, 1000 / Math.max(img.width, img.height));
      var c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * s)); c.height = Math.max(1, Math.round(img.height * s));
      var ctx = c.getContext("2d");
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      cb(c.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = function () { URL.revokeObjectURL(url); cb(null); };
    img.src = url;
  }
  function clearPhoto() {
    pendingPhoto = null; busy = false; $("fPhoto").value = "";
    $("preview").removeAttribute("src"); $("pvwrap").hidden = true; $("formErr").textContent = "";
  }
  $("fPhoto").addEventListener("change", function (e) {
    var file = e.target.files[0];
    pendingPhoto = null; $("pvwrap").hidden = true; $("formErr").textContent = "";
    if (!file) return;
    if (!/^image\//.test(file.type)) { $("formErr").textContent = "File harus berupa gambar."; e.target.value = ""; return; }
    if (file.size > 10 * 1024 * 1024) { $("formErr").textContent = "Foto lebih dari 10 MB. Pilih foto yang lebih kecil."; e.target.value = ""; return; }
    busy = true;
    shrink(file, function (data) {
      busy = false;
      if (!data) { $("formErr").textContent = "Foto tidak bisa dibaca. Coba foto lain."; $("fPhoto").value = ""; return; }
      pendingPhoto = data; $("preview").src = data; $("pvwrap").hidden = false;
    });
  });
  $("rmPhoto").addEventListener("click", clearPhoto);
  $("jumpBtn").addEventListener("click", function () {
    $("formbox").scrollIntoView({ behavior: "smooth", block: "start" });
    $("fMsg").focus({ preventScroll: true });
  });
  $("rulesBtn").addEventListener("click", function () {
    var box = $("aturan"); box.scrollIntoView({ behavior: "smooth", block: "start" });
    var d = box.querySelector("details"); if (d) d.open = true;
  });

  $("postForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var text = $("fMsg").value.trim();
    var err = busy ? "Foto masih diproses, tunggu sebentar." : text.length < 10 ? "Tulis pesan minimal 10 huruf." : check(text);
    if (!err) {
      var wp = waitMinutes("posts", POST_LIMIT);
      if (wp) err = "Kamu sudah mengirim " + POST_LIMIT + " pesan dalam satu jam terakhir. Coba lagi sekitar " + wp + " menit lagi.";
    }
    $("formErr").textContent = err;
    if (err) return;
    var nextId = S.posts.reduce(function (m, p) { return Math.max(m, p.id); }, 0) + 1;
    var now = new Date();
    var iso = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
    var p = { id: nextId, cat: $("fCat").value, fak: $("fFak").value, text: text, date: iso, relate: 0, anon: code(), replies: [], mine: true, pending: MA.REQUIRE_APPROVAL };
    if (pendingPhoto) p.photo = pendingPhoto;
    S.posts.push(p); S.userPosts.push(p); stamp("posts");
    var note = "";
    if (!S.savePosts() && p.photo) {
      var copy = {}; for (var k in p) copy[k] = p[k]; delete copy.photo;
      S.userPosts[S.userPosts.length - 1] = copy; S.savePosts();
      note = " Fotonya terlalu besar untuk disimpan di browser, jadi hanya tampil sampai halaman ditutup.";
    }
    e.target.reset(); clearPhoto(); $("counter").textContent = "0 / 500";
    f.cat = "all"; f.sort = "new"; f.q = ""; f.hideDone = false;
    $("sortBy").value = "new"; $("q").value = ""; $("hideDone").checked = false;
    renderFilters(); renderList();
    toast("Pesan terkirim sebagai Anon #" + p.anon + (p.pending ? " dan menunggu persetujuan moderator." : ".") + note);
  });

  // Kalau data berubah dari tab lain (misalnya moderator menyetujui pesan), muat ulang daftar
  window.addEventListener("storage", function () { S = MA.createStore(); renderList(); });

  MA.initTheme($("themeBtn"));
  renderFilters();
  renderList();
})();