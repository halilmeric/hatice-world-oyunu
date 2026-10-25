// Ses efektleri. Hiçbir ses dosyası yoktur: her ses tarayıcıda Web Audio ile üretilir.
// Tarayıcı sesi ilk dokunuştan sonra açar. Sesi kapatma tercihi tarayıcıda saklanır.

window.SES = (() => {
  const ANAHTAR = "cizim-dunyasi-ses";
  let ctx = null, ana = null;
  let acik = true;
  try { acik = localStorage.getItem(ANAHTAR) !== "kapali"; } catch (e) {}

  // İlk dokunuşta ses sistemi kurulur. Tarayıcılar dokunuştan önce ses çalmaya izin vermez.
  function baslat() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      ana = ctx.createGain();
      ana.gain.value = acik ? 0.5 : 0;
      ana.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    if (bekleyenOrtam !== undefined) { const o = bekleyenOrtam; bekleyenOrtam = undefined; ortam(o); }
  }
  const hazir = () => ctx && ctx.state === "running";
  const rnd = (a, b) => a + Math.random() * (b - a);

  function acKapa() {
    acik = !acik;
    try { localStorage.setItem(ANAHTAR, acik ? "acik" : "kapali"); } catch (e) {}
    if (ana) ana.gain.setTargetAtTime(acik ? 0.5 : 0, ctx.currentTime, 0.05);
    return acik;
  }

  // --- Temel parçalar ---
  // Ton: frekansı f0'dan f1'e kayan bir dalga. Ses yumuşak başlar, sonra söner.
  function ton(f0, f1, sure, tip = "sine", ses = 0.3, gecikme = 0) {
    if (!hazir()) return;
    const t = ctx.currentTime + gecikme;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tip;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + sure);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(ses, t + Math.min(0.02, sure / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
    o.connect(g).connect(ana);
    o.start(t); o.stop(t + sure + 0.05);
  }
  let gurultuTampon = null;
  function gurultuKaynak() {
    if (!gurultuTampon) {
      gurultuTampon = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = gurultuTampon.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource();
    s.buffer = gurultuTampon;
    s.loop = true;
    return s;
  }
  // Hışırtı: süzgeçten geçen gürültü. Su, ateş, fırça, rüzgar için. f1 verilirse süzgeç kayar.
  function hisirti(sure, f0, f1 = f0, tip = "bandpass", ses = 0.3, gecikme = 0, q = 1) {
    if (!hazir()) return;
    const t = ctx.currentTime + gecikme;
    const s = gurultuKaynak(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = tip; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + sure);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(ses, t + Math.min(0.03, sure / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
    s.connect(f).connect(g).connect(ana);
    s.start(t, Math.random()); s.stop(t + sure + 0.05);
  }

  // --- Efektler ---
  const efekt = {
    // Yere düşme: tok bir güm. guc 0..1
    dus(guc = 0.5) {
      ton(150, 55, 0.18, "sine", 0.25 + guc * 0.35);
      hisirti(0.08, 400, 200, "lowpass", 0.15 + guc * 0.2);
    },
    // Cam kırılma: ince çınlamalar ve kısa bir şıkırtı.
    kir() {
      hisirti(0.25, 5000, 2500, "highpass", 0.25);
      for (let i = 0; i < 6; i++) ton(rnd(2200, 4200), rnd(1800, 3500), rnd(0.15, 0.35), "triangle", 0.12, rnd(0, 0.12));
    },
    zipla() { ton(260, 620, 0.18, "sine", 0.25); },
    pop() { ton(500, 900, 0.07, "sine", 0.2); },
    puf() { hisirti(0.25, 1800, 400, "bandpass", 0.2); ton(700, 1400, 0.12, "sine", 0.1, 0.05); },
    klik() { hisirti(0.025, 3000, 3000, "highpass", 0.3); ton(1200, 900, 0.03, "square", 0.05); },
    // Ocak yanar: tık sesi ve alevin "puf" diye açılması.
    ates() {
      efekt.klik();
      hisirti(0.5, 300, 1400, "bandpass", 0.25, 0.05, 0.7);
    },
    dolap() { ton(180, 140, 0.08, "triangle", 0.25); ton(240, 200, 0.08, "triangle", 0.2, 0.09); },
    // Korna: iki tonlu kısa "dıt dıt".
    korna() {
      for (const g of [0, 0.22]) { ton(420, 420, 0.16, "square", 0.08, g); ton(530, 530, 0.16, "square", 0.08, g); }
    },
    // Geçen araç: yaklaşıp uzaklaşan motor uğultusu.
    motor(sure = 4) {
      if (!hazir()) return;
      const t = ctx.currentTime;
      const s = gurultuKaynak(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = "lowpass"; f.frequency.value = 260;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + sure / 2);
      g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
      s.connect(f).connect(g).connect(ana);
      s.start(t); s.stop(t + sure + 0.05);
    },
    su() { hisirti(0.6, 1200, 2200, "bandpass", 0.2, 0, 0.8); for (let i = 0; i < 4; i++) ton(rnd(500, 900), rnd(1200, 1800), 0.06, "sine", 0.08, rnd(0, 0.4)); },
    sicrama() { hisirti(0.35, 2500, 700, "bandpass", 0.3); ton(300, 800, 0.08, "sine", 0.1); },
    kopuk() { for (let i = 0; i < 4; i++) ton(rnd(600, 1000), rnd(1400, 2000), 0.05, "sine", 0.1, i * 0.12 + rnd(0, 0.05)); },
    sifon() { hisirti(1.6, 1800, 250, "bandpass", 0.35, 0, 0.6); hisirti(1.2, 600, 200, "lowpass", 0.2, 0.3); },
    isir() { hisirti(0.07, 2500, 1200, "bandpass", 0.35, 0, 2); hisirti(0.05, 2000, 1000, "bandpass", 0.25, 0.08, 2); },
    giy() { [880, 1110, 1320, 1760].forEach((f, i) => ton(f, f, 0.12, "triangle", 0.12, i * 0.06)); },
    buyu() { [523, 659, 784, 1047, 1319].forEach((f, i) => ton(f, f * 1.02, 0.18, "sine", 0.15, i * 0.08)); },
    kay() { ton(900, 250, 1.1, "sine", 0.18); },
    gecis() { hisirti(0.35, 400, 1500, "bandpass", 0.12, 0, 0.7); },
    selam() { ton(520, 780, 0.1, "sine", 0.18); ton(780, 660, 0.1, "sine", 0.15, 0.1); },
    hav() { for (const g of [0, 0.25]) { ton(420, 200, 0.12, "sawtooth", 0.12, g); hisirti(0.1, 700, 400, "bandpass", 0.2, g); } },
    // Kedi sevilince önce "miyav", sonra mırlar.
    mir() {
      ton(650, 900, 0.12, "triangle", 0.1); ton(900, 520, 0.3, "triangle", 0.1, 0.12);
      for (let i = 0; i < 16; i++) hisirti(0.06, 180, 140, "lowpass", 0.35, 0.5 + i * 0.075, 1);
    },
    // Kasada okutma: kısa tiz "bip".
    bip() { ton(1850, 1850, 0.12, "square", 0.08); },
    // Tebeşir tahtada: kısa cızırtı.
    tebesir() { hisirti(0.08, 4500, 3500, "bandpass", 0.12, 0, 3); },
    // Ördek sıkılınca "vak".
    vak() { ton(700, 450, 0.18, "sawtooth", 0.1); ton(1200, 800, 0.12, "square", 0.04); },
    // Konuşma: hece hece kısa sesler. Uzun cümle daha uzun konuşur.
    konus(uzunluk = 20, pes = 1) {
      const n = Math.min(14, Math.max(4, Math.round(uzunluk / 3.5)));
      for (let i = 0; i < n; i++) {
        const f = rnd(260, 420) * pes;
        ton(f, f * rnd(0.85, 1.15), 0.08, "triangle", 0.14, i * 0.11);
      }
    },
  };
  // Eşya hareketlerinin sesi. Uzun süren hareketlerde ses hareket boyunca sürer.
  const eylem = {
    sik: () => efekt.vak(),
    konus: () => efekt.konus(12, 1.3),
    fircala: (s) => hisirti(s, 3000, 3000, "bandpass", 0.12, 0, 3),
    yika: () => efekt.kopuk(),
    kurula: (s) => hisirti(s * 0.6, 800, 800, "bandpass", 0.1),
    kurut: (s) => { hisirti(s, 1500, 1500, "bandpass", 0.15, 0, 0.5); ton(220, 230, s, "sawtooth", 0.03); },
    sula: (s) => hisirti(s, 1800, 1500, "bandpass", 0.15, 0, 0.6),
    kaz: () => hisirti(0.4, 900, 500, "bandpass", 0.2),
    karistir: () => { for (let i = 0; i < 6; i++) ton(rnd(300, 500), rnd(600, 900), 0.06, "sine", 0.08, i * 0.3 + rnd(0, 0.1)); },
    kumanda: () => efekt.klik(),
    ic: () => { for (let i = 0; i < 3; i++) ton(300, 180, 0.08, "sine", 0.15, i * 0.4); },
    dinle: () => { for (let i = 0; i < 4; i++) { ton(90, 60, 0.08, "sine", 0.35, i * 0.6); ton(90, 60, 0.08, "sine", 0.25, i * 0.6 + 0.18); } },
    at: () => hisirti(0.25, 600, 2000, "bandpass", 0.15),
    sur: () => ton(300, 340, 0.6, "sawtooth", 0.04),
    dok: (s) => { for (let i = 0; i < 12; i++) hisirti(0.04, 2500, 2000, "bandpass", 0.12, i * s / 14, 2); },
    yaz: (s) => { for (let i = 0; i < 8; i++) hisirti(0.05, 4000, 4000, "bandpass", 0.08, i * s / 8, 2); },
    // Termometre ölçüm bitince üç kez öter.
    olc: (s) => { for (let i = 0; i < 3; i++) ton(2000, 2000, 0.08, "square", 0.05, s - 0.6 + i * 0.18); },
    yapistir: () => hisirti(0.18, 3000, 1500, "bandpass", 0.18),
    bak: () => efekt.buyu(),
    ucur: (s) => hisirti(s, 500, 700, "bandpass", 0.08, 0, 0.5),
    birak: () => ton(400, 900, 1.2, "sine", 0.1),
    saril: () => efekt.giy(),
    ufle: () => hisirti(0.9, 1200, 600, "bandpass", 0.25, 0, 0.6),
  };

  // --- Sürekli sesler: TV müziği ve ortam sesi ---
  // TV açıkken neşeli kısa bir ezgi döner.
  const EZGI = [523, 659, 784, 659, 587, 698, 880, 698, 523, 659, 784, 1047, 988, 784, 659, 587];
  const BAS = [131, 131, 175, 175, 147, 147, 196, 196];
  let tvZaman = null, tvSira = 0;
  function tvMuzik(ac) {
    if (ac && !tvZaman) {
      tvSira = 0;
      tvZaman = setInterval(() => {
        const i = tvSira++ % EZGI.length;
        ton(EZGI[i], EZGI[i], 0.17, "triangle", 0.1);
        if (i % 2 === 0) ton(BAS[(i / 2) % BAS.length], BAS[(i / 2) % BAS.length], 0.3, "sine", 0.12);
        if (i % 4 === 0) hisirti(0.05, 6000, 6000, "highpass", 0.06);
      }, 190);
    } else if (!ac && tvZaman) { clearInterval(tvZaman); tvZaman = null; }
  }

  // Ortam: "sehir" (uzak trafik uğultusu ve kuşlar), "bahce" (kuşlar ve rüzgar) ya da null (sessiz oda).
  let ortamDugum = null, kusZaman = null, bekleyenOrtam;
  function ortam(tur) {
    if (!hazir()) { bekleyenOrtam = tur; return; }
    if (ortamDugum) { const d = ortamDugum; d.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2); setTimeout(() => d.s.stop(), 800); ortamDugum = null; }
    if (kusZaman) { clearInterval(kusZaman); kusZaman = null; }
    if (!tur) return;
    const s = gurultuKaynak(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = "lowpass"; f.frequency.value = tur === "sehir" ? 380 : 900;
    g.gain.value = 0.0001;
    g.gain.setTargetAtTime(tur === "sehir" ? 0.07 : 0.025, ctx.currentTime, 0.5);
    s.connect(f).connect(g).connect(ana);
    s.start();
    ortamDugum = { s, g };
    // Kuş cıvıltısı: ara sıra iki üç hızlı ıslık.
    kusZaman = setInterval(() => {
      if (Math.random() < (tur === "sehir" ? 0.3 : 0.6)) {
        const f0 = rnd(2200, 3400), n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) ton(f0, f0 * rnd(1.15, 1.4), 0.07, "sine", 0.05, i * 0.1);
      }
    }, 1400);
  }

  return { baslat, acKapa, acik: () => acik, ...efekt, eylem: (tur, sure) => eylem[tur] && eylem[tur](sure), tvMuzik, ortam };
})();
