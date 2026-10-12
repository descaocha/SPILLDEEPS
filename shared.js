/* Data dan fungsi yang dipakai bersama oleh index.html dan moderator.html */
window.MA = (function () {
  var REQUIRE_APPROVAL = true; // true: pesan baru menunggu moderator. false: langsung tampil.
  var HIDE_AT = 3;             // pesan otomatis disembunyikan kalau dilaporkan sebanyak ini

  var FAK = [
    "FT · Teknik", "FEB · Ekonomika dan Bisnis", "FH · Hukum", "FISIP · Ilmu Sosial dan Ilmu Politik",
    "FIB · Ilmu Budaya", "FK · Kedokteran", "FKM · Kesehatan Masyarakat", "FPIK · Perikanan dan Kelautan",
    "FPP · Peternakan dan Pertanian", "FSM · Sains dan Matematika", "FPsi · Psikologi", "SV · Vokasi"
  ];
  var CATS = { curhat: "Curhat", kehilangan: "Kehilangan", ditemukan: "Barang ditemukan", info: "Info kampus", tanya: "Tanya" };
  var DONE_LABEL = { kehilangan: "Sudah ketemu", ditemukan: "Sudah kembali" };

  // Contoh pesan (fiktif)
  var SAMPLE = [
    { id: 1, cat: "kehilangan", fak: "FT · Teknik", date: "2026-10-07", relate: 34, anon: "k3f9",
      text: "Helm full face hitam doff hilang di parkiran depan gedung A. Ada stiker kecil di sisi kiri. Hilang Senin antara jam 9 sampai jam 12. Kalau ada yang lihat atau nemu, tolong titip ke pos satpam FT ya.",
      replies: [{ anon: "p2m8", text: "Coba cek juga ke satpam parkiran belakang, kadang barang temuan dikumpulkan di sana." }] },
    { id: 2, cat: "ditemukan", fak: "FEB · Ekonomika dan Bisnis", date: "2026-10-08", relate: 21, anon: "d7a1",
      text: "Dompet coklat ditemukan di meja kantin FEB, isinya ada kartu mahasiswa. Sudah dititipkan ke pos satpam FEB. Pemilik bisa datang membawa KTM untuk mengambilnya.", replies: [] },
    { id: 3, cat: "curhat", fak: "", date: "2026-10-09", relate: 58, anon: "x9q2",
      text: "Semester 5 rasanya capek banget. Tugas numpuk dan organisasi jalan terus. Ada yang ngerasa sama? Gimana cara kalian istirahat tanpa merasa bersalah?",
      replies: [{ anon: "m4n7", text: "Aku nyoba jadwalin istirahat kayak jadwalin kuliah. Awalnya aneh, lama-lama kebantu." }, { anon: "t1v6", text: "Kamu nggak sendirian. Semoga minggu ini ada waktu buat napas." }] },
    { id: 4, cat: "tanya", fak: "", date: "2026-10-09", relate: 12, anon: "w8c5",
      text: "Ada yang tau tempat fotokopi yang buka sampai malam deket kampus? Butuh jilid laporan besok pagi.", replies: [] },
    { id: 5, cat: "info", fak: "FISIP · Ilmu Sosial dan Ilmu Politik", date: "2026-10-06", relate: 47, anon: "h6j3",
      text: "Info: lampu parkiran belakang FISIP sudah menyala lagi sejak kemarin sore. Tetap hati-hati kalau pulang malam dan jangan sendirian.", replies: [] },
    { id: 6, cat: "tanya", fak: "", date: "2026-10-05", relate: 26, anon: "b2z4",
      text: "Rekomendasi tempat belajar yang sepi dan colokannya banyak selain perpustakaan? Lagi persiapan UTS.", replies: [{ anon: "r5e8", text: "Coba ruang diskusi di lantai atas gedung fakultasmu, sering kosong sore hari." }] },
    { id: 7, cat: "curhat", fak: "FSM · Sains dan Matematika", date: "2026-10-04", relate: 73, anon: "n0y7",
      text: "Makasih buat orang baik yang kemarin ngasih payung pas hujan deras di depan FSM. Kamu nggak kenal aku, tapi hari itu kamu nyelametin laptopku.", replies: [] },
    { id: 8, cat: "kehilangan", fak: "FIB · Ilmu Budaya", date: "2026-10-03", relate: 15, anon: "g3u1",
      text: "Kartu mahasiswa hilang, kemungkinan di sekitar kantin FIB. Kalau ada yang nemu, mohon titip ke pos satpam FIB. Terima kasih banyak.", replies: [] },
    { id: 9, cat: "ditemukan", fak: "FSM · Sains dan Matematika", date: "2026-09-30", relate: 9, anon: "u5s2", resolved: true,
      text: "Payung lipat hijau ditemukan di tangga gedung B. Sudah diambil pemiliknya. Terima kasih yang ikut menyebar.", replies: [] },
    { id: 10, cat: "info", fak: "", date: "2026-10-09", relate: 0, anon: "j8d4", reports: 4,
      text: "Jasa joki tugas dan skripsi murah, cek profil kami ya. Dijamin cepat dan aman.", replies: [] }
  ];

  var K = {
    posts: "madinganon.posts", relate: "madinganon.relate", hidden: "madinganon.hidden",
    replies: "madinganon.replies", reports: "madinganon.reports", mod: "madinganon.mod",
    rate: "madinganon.rate", theme: "madinganon.theme", modtry: "madinganon.modtry", session: "madinganon.modok"
  };

  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var fmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" });
  function dateLabel(iso) { return fmt.format(new Date(iso + "T00:00:00")); }

  // Semua data pesan dibaca dari localStorage lewat satu objek ini
  function createStore() {
    var s = {
      userPosts: load(K.posts, []),
      relateSet: load(K.relate, {}),
      hidden: load(K.hidden, {}),
      userReplies: load(K.replies, {}),
      myReports: load(K.reports, {}),
      mod: load(K.mod, { cleared: {}, removed: {} })
    };
    s.mod.cleared = s.mod.cleared || {}; s.mod.removed = s.mod.removed || {};
    s.posts = SAMPLE.concat(s.userPosts);

    s.relateOf = function (p) { return p.relate + (s.relateSet[p.id] ? 1 : 0); };
    s.repliesOf = function (p) { return (p.replies || []).concat(s.userReplies[p.id] || []); };
    s.reportsOf = function (p) { return (p.reports || 0) + (s.myReports[p.id] ? 1 : 0); };
    s.isRemoved = function (p) { return !!s.mod.removed[p.id]; };
    s.autoHidden = function (p) { return s.reportsOf(p) >= HIDE_AT && !s.mod.cleared[p.id]; };
    s.isPublic = function (p) { return !s.isRemoved(p) && !s.hidden[p.id] && !s.autoHidden(p) && (!p.pending || p.mine); };

    s.savePosts = function () { return save(K.posts, s.userPosts); };
    s.patch = function (id, fn) {
      s.posts.forEach(function (p) { if (p.id === id) fn(p); });
      s.userPosts.forEach(function (p) { if (p.id === id) fn(p); });
      s.savePosts();
    };
    s.restore = function (id) {
      s.mod.cleared[id] = 1; delete s.hidden[id];
      save(K.mod, s.mod); save(K.hidden, s.hidden);
    };
    s.deletePost = function (id) {
      var isSample = SAMPLE.some(function (x) { return x.id === id; });
      s.posts = s.posts.filter(function (p) { return p.id !== id; });
      s.userPosts = s.userPosts.filter(function (p) { return p.id !== id; });
      delete s.relateSet[id]; delete s.hidden[id]; delete s.userReplies[id]; delete s.myReports[id]; delete s.mod.cleared[id];
      if (isSample) s.mod.removed[id] = 1;
      s.savePosts(); save(K.relate, s.relateSet); save(K.hidden, s.hidden);
      save(K.replies, s.userReplies); save(K.reports, s.myReports); save(K.mod, s.mod);
    };
    return s;
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
    REQUIRE_APPROVAL: REQUIRE_APPROVAL, HIDE_AT: HIDE_AT, FAK: FAK, CATS: CATS, DONE_LABEL: DONE_LABEL, SAMPLE: SAMPLE,
    K: K, load: load, save: save, esc: esc, dateLabel: dateLabel, createStore: createStore, initTheme: initTheme
  };
})();