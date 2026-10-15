/* Halaman publik Mading Anon (index.html). Butuh shared.js. */
(function () {
  var POST_LIMIT = 3, REPLY_LIMIT = 10, WINDOW_MS = 60 * 60 * 1000; // batas kirim per jam per browser. Isi 0 untuk tanpa batas

  var K = MA.K, load = MA.load, save = MA.save, esc = MA.esc, dateLabel = MA.dateLabel, api = MA.api;
  var CATS = MA.CATS, DONE_LABEL = MA.DONE_LABEL, FAK = MA.FAK;
  var posts = [], loaded = false, loadErr = "", working = false;
  var relateSet = load(K.relate, {}), hidden = load(K.hidden, {}), mine = load(K.mine, {}), myReplies = load(K.myreplies, {});
  var rate = load(K.rate, { posts: [], replies: [] });
  rate.posts = rate.posts || []; rate.replies = rate.replies || [];
  var openPanels = {}, confirmDel = {}, confirmDelRep = {}, replyTo = {};
  var f = { cat: "all", sort: "new", q: "", hideDone: false };

  function $(id) { return document.getElementById(id); }
  function canResolve(p) { return p.mine && !!DONE_LABEL[p.cat]; }

  // Batas kirim: kembalikan sisa menit tunggu, atau 0 kalau masih boleh
  function waitMinutes(kind, limit) {
    var now = Date.now();
    rate[kind] = rate[kind].filter(function (t) { return now - t < WINDOW_MS; });
    return limit > 0 && rate[kind].length >= limit ? Math.ceil((WINDOW_MS - (now - rate[kind][0])) / 60000) : 0;
  }
  function stamp(kind) { rate[kind].push(Date.now()); save(K.rate, rate); }

  // Penyaring: tolak nomor HP, tautan, dan akun media sosial
  function check(text) {
    if (/\d(?:[\s\-.]?\d){8,}/.test(text)) return "Jangan menulis nomor HP atau nomor identitas apa pun.";
    if (/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|id|co|net|me|ly)\b/i.test(text)) return "Jangan menulis tautan.";
    if (/(^|\s)@\w{2,}/.test(text) || /\b(ig|instagram|line|wa|whatsapp|telegram|tele|tiktok|twitter)\s*[:@]/i.test(text)) return "Jangan menulis akun media sosial atau kontak pribadi.";
    return "";
  }

  $("fCat").innerHTML = Object.keys(CATS).map(function (k) { return '<option value="' + k + '">' + esc(CATS[k]) + "</option>"; }).join("");
  $("fFak").innerHTML = '<option value="">Tidak disebutkan</option>' + FAK.map(function (a) { return "<option>" + esc(a) + "</option>"; }).join("");

  function renderFilters() {
    var html = '<button type="button" class="chip" data-cat="all" aria-pressed="' + (f.cat === "all") + '">Semua</button>';
    Object.keys(CATS).forEach(function (k) {
      html += '<button type="button" class="chip" data-cat="' + k + '" aria-pressed="' + (f.cat === k) + '">' + esc(CATS[k]) + "</button>";
    });
    html += '<button type="button" class="chip" data-cat="done" aria-pressed="' + (f.cat === "done") + '">Sudah ketemu</button>';
    $("catFilters").innerHTML = html;
  }

  function matches(p) {
    if (!f.q) return true;
    var hay = (p.text + " " + p.fak + " " + CATS[p.cat]).toLowerCase();
    return f.q.split(/\s+/).every(function (w) { return hay.indexOf(w) !== -1; });
  }

  // Balasan ditampilkan bersarang (balasan bisa dibalas lagi). Indentasi berhenti di tingkat ke-4 supaya tidak menyempit.
  var MAX_INDENT = 4;
  function replyTree(p) {
    var kids = {}, alive = {};
    (p.replies || []).forEach(function (r) { var k = r.parent_id || 0; (kids[k] = kids[k] || []).push(r); });
    // balasan yang sudah dihapus dan tidak punya balasan hidup di bawahnya disembunyikan sepenuhnya
    function hasLive(r) {
      if (alive[r.id] === undefined) alive[r.id] = !r.deleted || (kids[r.id] || []).some(hasLive);
      return alive[r.id];
    }
    function draw(parent, depth) {
      return (kids[parent] || []).filter(hasLive).map(function (r) {
        var line, acts = "", form = "";
        if (r.deleted) {
          line = '<span class="rdel">Balasan ini sudah dihapus penulisnya.</span>';
        } else {
          line = '<span class="anon">Anon #' + esc(r.anon) + "</span> " + esc(r.text);
          acts = '<button type="button" class="link" data-act="rto" data-id="' + p.id + '" data-rid="' + r.id + '">Balas</button>' +
            (r.mine ? '<button type="button" class="link danger" data-act="delrep" data-id="' + p.id + '" data-rid="' + r.id + '">' + (confirmDelRep[r.id] ? "Yakin hapus?" : "Hapus") + "</button>" : "");
          if (replyTo[p.id] === r.id) {
            form = '<div class="rform"><input type="text" id="rinr-' + p.id + '" maxlength="200" placeholder="Membalas Anon #' + esc(r.anon) + '" aria-label="Balasan untuk Anon ' + esc(r.anon) + '">' +
              '<button type="button" class="btn small" data-act="reply" data-id="' + p.id + '" data-parent="' + r.id + '">Kirim</button>' +
              '<button type="button" class="link" data-act="rcancel" data-id="' + p.id + '">Batal</button></div>';
          }
        }
        var below = draw(r.id, depth + 1), flat = depth + 1 >= MAX_INDENT;
        return '<li class="rep"><div class="rline">' + line + "</div>" + (acts ? '<div class="ract">' + acts + "</div>" : "") + form +
          (below && !flat ? "<ul>" + below + "</ul>" : "") + "</li>" + (below && flat ? below : "");
      }).join("");
    }
    return draw(0, 1);
  }

  function renderList() {
    var rows = posts.filter(function (p) {
      return !hidden[p.id] && (f.cat === "all" || (f.cat === "done" ? p.resolved : p.cat === f.cat)) && matches(p) && !(f.hideDone && p.resolved && f.cat !== "done");
    });
    rows.sort(function (a, b) {
      if (f.sort === "relate") return b.relate - a.relate;
      return b.date < a.date ? -1 : b.date > a.date ? 1 : b.id - a.id;
    });
    // pesan yang sudah selesai turun ke bawah
    rows = rows.filter(function (p) { return !p.resolved; }).concat(rows.filter(function (p) { return p.resolved; }));
    if (!loaded) {
      $("list").innerHTML = '<li class="empty">' + (loadErr ? esc(loadErr) : "Memuat pesan...") + "</li>";
      return;
    }
    if (!rows.length) {
      $("list").innerHTML = '<li class="empty">' + (f.q || f.cat !== "all" || f.hideDone
        ? "Tidak ada pesan yang cocok. Coba kata lain atau ubah filter."
        : "Belum ada pesan. Jadilah yang pertama menulis.") + "</li>";
      return;
    }
    $("list").innerHTML = rows.map(function (p) {
      var reps = p.replies || [], open = !!openPanels[p.id];
      var nLive = reps.filter(function (r) { return !r.deleted; }).length;
      var panel = "";
      if (open) {
        var tree = replyTree(p);
        panel = '<div class="replies">' + (tree ? "<ul>" + tree + "</ul>" : '<p class="empty-r">Belum ada balasan.</p>') +
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
        (p.fak ? "<span>" + esc(p.fak) + "</span>" : "") + '<time class="ago" data-ts="' + esc(p.ts || "") + '" data-d="' + esc(p.date) + '" title="' + esc(MA.fullTime(p.ts)) + '">' + esc(MA.timeAgo(p.ts, p.date)) + "</time></div>" +
        '<p class="text">' + esc(p.text) + "</p>" +
        (p.photo ? '<img class="photo" src="' + p.photo + '" alt="Foto yang dilampirkan pada pesan" loading="lazy">' : "") +
        '<div class="foot"><button type="button" class="relate" data-act="relate" data-id="' + p.id + '" aria-pressed="' + (!!relateSet[p.id]) + '">Relate <span class="c">' + p.relate + "</span></button>" +
        '<button type="button" class="link" data-act="toggle" data-id="' + p.id + '" aria-expanded="' + open + '">Balasan (' + nLive + ")</button>" +
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

  function find(id) { for (var i = 0; i < posts.length; i++) if (posts[i].id === id) return posts[i]; return null; }

  $("list").addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var id = Number(b.getAttribute("data-id")), act = b.getAttribute("data-act"), p = find(id);
    var rid = Number(b.getAttribute("data-rid")) || 0, parentId = Number(b.getAttribute("data-parent")) || 0;
    if (!p) return;
    if (act === "toggle") { openPanels[id] = !openPanels[id]; renderList(); return; }
    if (act === "delpost" && !confirmDel[id]) { confirmDel[id] = true; renderList(); return; }
    if (act === "rto") { replyTo[id] = rid; renderList(); var box = $("rinr-" + id); if (box) box.focus(); return; }
    if (act === "rcancel") { delete replyTo[id]; renderList(); return; }
    if (act === "delrep" && !confirmDelRep[rid]) { confirmDelRep[rid] = true; renderList(); return; }
    if (working) return;
    var token = mine[id];
    var job;
    if (act === "relate") {
      var on = !relateSet[id];
      if (on) relateSet[id] = 1; else delete relateSet[id];
      p.relate = Math.max(0, p.relate + (on ? 1 : -1));
      save(K.relate, relateSet); renderList();
      api("toggle_relate", { p_post: id, p_on: on }).catch(function (er) {
        if (on) delete relateSet[id]; else relateSet[id] = 1;
        p.relate = Math.max(0, p.relate + (on ? -1 : 1));
        save(K.relate, relateSet); renderList(); toast(er.message);
      });
      return;
    } else if (act === "resolve") {
      var now = !p.resolved;
      job = api("owner_set_resolved", { p_post: id, p_token: token, p_resolved: now }).then(function () {
        p.resolved = now; toast(now ? "Pesan ditandai selesai dan dipindah ke bawah." : "Pesan dibuka lagi.");
      });
    } else if (act === "delphoto") {
      job = api("owner_delete_photo", { p_post: id, p_token: token }).then(function () { delete p.photo; p.photo = null; toast("Foto dihapus dari pesanmu."); });
    } else if (act === "delpost") {
      job = api("owner_delete_post", { p_post: id, p_token: token }).then(function () {
        delete confirmDel[id]; delete openPanels[id]; delete mine[id]; save(K.mine, mine);
        posts = posts.filter(function (x) { return x.id !== id; }); toast("Pesan dihapus.");
      });
    } else if (act === "hide") {
      job = api("report_post", { p_post: id, p_viewer: MA.viewerId() }).then(function () {
        hidden[id] = 1; save(K.hidden, hidden);
        toast("Pesan disembunyikan dari tampilanmu dan dicatat sebagai laporan.");
      });
    } else if (act === "reply") {
      var input = $((parentId ? "rinr-" : "rin-") + id), text = input.value.trim();
      if (text.length < 2) { toast("Balasan terlalu pendek."); return; }
      var err = check(text); if (err) { toast(err); return; }
      var wr = waitMinutes("replies", REPLY_LIMIT);
      if (wr) { toast("Balasanmu sudah banyak dalam satu jam terakhir. Coba lagi sekitar " + wr + " menit lagi."); return; }
      var rtoken = MA.randomToken();
      job = api("add_reply", { p_post: id, p_text: text, p_parent: parentId || null, p_token: rtoken }).then(function (r) {
        p.replies = (p.replies || []).concat([r]); stamp("replies");
        myReplies[r.id] = rtoken; save(K.myreplies, myReplies); delete replyTo[id];
      });
    } else if (act === "delrep") {
      job = api("delete_reply", { p_reply: rid, p_token: myReplies[rid] }).then(function () {
        (p.replies || []).forEach(function (r) { if (r.id === rid) { r.deleted = true; r.mine = false; r.text = "[dihapus]"; } });
        delete confirmDelRep[rid]; delete myReplies[rid]; save(K.myreplies, myReplies); toast("Balasan dihapus.");
      });
    } else { return; }
    working = true; b.disabled = true;
    job.catch(function (er) { toast(er.message); }).then(function () { working = false; renderList(); });
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
  // Di layar kecil form tampil sebagai lembar dari bawah (dibuka tombol "+ Tulis pesan"). Di layar lebar form tetap di samping.
  var sheetMq = window.matchMedia("(max-width: 860px)");
  function openSheet() {
    if (!sheetMq.matches) { $("fMsg").focus(); return; }
    $("formbox").classList.add("open"); $("backdrop").hidden = false;
    document.body.classList.add("sheet-open"); $("fMsg").focus({ preventScroll: true });
  }
  function closeSheet() {
    $("formbox").classList.remove("open"); $("backdrop").hidden = true;
    document.body.classList.remove("sheet-open");
  }
  $("fab").addEventListener("click", openSheet);
  $("sheetClose").addEventListener("click", closeSheet);
  $("backdrop").addEventListener("click", closeSheet);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheet(); });
  if (sheetMq.addEventListener) sheetMq.addEventListener("change", closeSheet);
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
    if (working) return;
    working = true;
    var btn = e.target.querySelector("button[type=submit]"), form = e.target; btn.disabled = true;
    var token = MA.randomToken();
    api("create_post", { p_cat: $("fCat").value, p_fak: $("fFak").value, p_text: text, p_photo: pendingPhoto || "", p_token: token })
      .then(function (r) {
        mine[r.id] = token; save(K.mine, mine); stamp("posts");
        form.reset(); clearPhoto(); $("counter").textContent = "0 / 500";
        f.cat = "all"; f.sort = "new"; f.q = ""; f.hideDone = false;
        $("sortBy").value = "new"; $("q").value = ""; $("hideDone").checked = false;
        renderFilters();
        closeSheet();
        toast("Pesan terkirim sebagai Anon #" + r.anon + (r.pending ? " dan menunggu persetujuan moderator." : "."));
        return refresh();
      })
      .catch(function (er) { $("formErr").textContent = er.message; })
      .then(function () { working = false; btn.disabled = false; renderList(); });
  });

  // Ambil daftar pesan dari server, dan segarkan otomatis tiap 20 detik
  function refresh() {
    return api("get_feed", { p_tokens: Object.keys(mine).map(function (k) { return mine[k]; }).concat(Object.keys(myReplies).map(function (k) { return myReplies[k]; })).slice(-300) }).then(function (rows) {
      posts = rows || []; loaded = true; loadErr = "";
    }, function (er) {
      if (!loaded) loadErr = er.message;
    }).then(renderList);
  }
  setInterval(function () {
    var a = document.activeElement;
    if (document.hidden || working || (a && a.tagName === "INPUT" && $("list").contains(a))) return;
    refresh();
  }, 20000);

  setInterval(function () {
    Array.prototype.forEach.call(document.querySelectorAll("#list time.ago"), function (el) {
      var ts = el.getAttribute("data-ts");
      if (ts) el.textContent = MA.timeAgo(ts, el.getAttribute("data-d"));
    });
  }, 60000);

  MA.initTheme($("themeBtn"));
  renderFilters();
  renderList();
  refresh();
})();
