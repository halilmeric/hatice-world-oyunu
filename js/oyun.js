// Oyun motoru: mahalle haritası, mekan geçişleri, sürükle-bırak, düşme, dokun-yürü,
// iki elle tutma, yemek, giyinme, oturma, yatma, salıncak, kaydırak, tezgah, ocak, TV, lamba, araçlar ve kayıt.

const VERI = window.OYUN_VERI;
const KAYIT_ANAHTARI = "cizim-dunyasi-v3";
const SURUKLE_ESIGI = 12; // piksel; daha az kayan dokunuş "dokunma" sayılır
const YERCEKIMI = 2600;
const EKRAN_W = 1280, EKRAN_H = 720;

const k = kaplay({ width: EKRAN_W, height: EKRAN_H, letterbox: true, background: [40, 40, 60], global: false, crisp: false });
// İki parmakla yakınlaştırma. Haritadaki sahne kendi işleyicisini buraya koyar.
let cimdikIsleyici = null;
k.canvas.addEventListener("touchmove", (e) => { if (e.touches.length === 2 && cimdikIsleyici) { e.preventDefault(); cimdikIsleyici(e.touches); } }, { passive: false });
k.canvas.addEventListener("touchend", (e) => { if (e.touches.length < 2 && cimdikIsleyici) cimdikIsleyici(null); });
const G = window.GECICI(k);
const K = window.KARAKTER(k, VERI);
const KALEM = k.rgb(70, 50, 40);

// --- Dünya durumu ve kayıt ---
function dunyaOku() {
  try {
    const s = JSON.parse(localStorage.getItem(KAYIT_ANAHTARI));
    if (s && VERI.mekanlar[s.mekan] && Array.isArray(s.varliklar)) {
      // Silinmiş bir şablon ya da mekan kayıtta kalırsa onu atla.
      s.varliklar = s.varliklar.filter((v) => (v.tur === "karakter" ? VERI.karakterler : VERI.esyalar)[v.sablon] && VERI.mekanlar[v.mekan]);
      // Başlangıca sonradan eklenen varlıklar eski kayda da gelir. Yenmiş ya da bilinen varlık geri gelmez.
      const bilinen = new Set(s.bilinen || []);
      s.varliklar.forEach((v) => bilinen.add(v.id));
      VERI.baslangic.varliklar.forEach((v) => { if (!bilinen.has(v.id)) { s.varliklar.push(JSON.parse(JSON.stringify(v))); bilinen.add(v.id); } });
      s.bilinen = [...bilinen];
      // Eski kayıt uzun sokak haritasından gelir. Haritadakiler yeni kasabanın başlangıç yerine taşınır.
      if (s.harita !== 2) {
        const g = VERI.mekanlar.dunya.giris;
        s.varliklar.filter((v) => v.mekan === "dunya").forEach((v, i) => { v.x = g.x + (i % 6) * 70 - 140; v.y = g.y + Math.floor(i / 6) * 40; });
        delete s.kamera; delete s.kameraY;
        s.harita = 2;
      }
      return s;
    }
  } catch (e) {}
  const yeni = JSON.parse(JSON.stringify(VERI.baslangic));
  yeni.bilinen = yeni.varliklar.map((v) => v.id);
  yeni.harita = 2;
  return yeni;
}
const dunya = dunyaOku();
dunya.acik = dunya.acik || {}; // açık TV, lamba ve ocak gözleri: "mekan:nokta" anahtarı
dunya.bitki = dunya.bitki || {}; // çiçeklerin hali (0 filiz, 1 tomurcuk, 2 çiçek): "mekan:nokta:sıra" anahtarı
const KAYBOLMA = 6; // saniye; raftan alınan eşya yerde bu kadar kalınca kaybolur
function kaydet() {
  try { localStorage.setItem(KAYIT_ANAHTARI, JSON.stringify(dunya)); } catch (e) {}
}

// --- Varlık yükleme ---
// Karakterler, eşyalar ve simgeler küçüktür: baştan yüklenir.
// Mekan resimleri büyüktür: bir mekana ilk kez gidilince yüklenir, sonra bellekte kalır.
K.yukle();
Object.entries(VERI.esyalar).forEach(([id, e]) => { if (e.resim) k.loadSprite("esya-" + id, e.resim); });
Object.entries(VERI.simgeler).forEach(([ad, yolu]) => k.loadSprite("simge-" + ad, yolu));
Object.entries(VERI.bitkiler).forEach(([ad, haller]) => haller.forEach((yolu, i) => k.loadSprite("bitki-" + ad + "-" + i, yolu)));
Object.entries(VERI.calisanlar).forEach(([ad, c]) => { k.loadSprite("calisan-" + ad, c.resim); k.loadSprite("calisan-" + ad + "-konus", c.konus); });
// Karakter simgeleri için her karakterin tam resmi. Simgede sadece başı görünür.
Object.entries(VERI.karakterler).forEach(([id, s]) => k.loadSprite("portre-" + id, s.resim));

function mekanResimleri(id) {
  const m = VERI.mekanlar[id], r = [];
  if (m.resim) r.push(m.resim);
  (m.haritaResim || []).forEach((h) => r.push(h));
  if (m.zeminResim) r.push(m.zeminResim);
  (m.yerler || []).forEach((y) => { if (y.resim) r.push(y.resim); });
  (m.susler || []).forEach((s) => r.push(s.resim));
  (m.araclar || []).forEach((a) => r.push(a));
  (m.noktalar || []).forEach((n) => { if (n.resim) r.push(n.resim); });
  return r;
}
// Mekanın resimlerini yükler. Aynı resim iki kez yüklenmez: resmin yolu aynı zamanda adıdır.
function mekanYukle(id) {
  const bekle = [];
  mekanResimleri(id).forEach((yolu) => {
    const a = k.getSprite(yolu) || k.loadSprite(yolu, yolu);
    if (!a.loaded) bekle.push(new Promise((bitti) => { a.onLoad(bitti); a.onError(bitti); }));
  });
  return Promise.all(bekle);
}

// --- Merkezi geçiş: her mekan değişimi buradan geçer ---
let geciyor = false;
function gec(hedef) {
  if (geciyor || !VERI.mekanlar[hedef]) return;
  geciyor = true;
  kaydet();
  SES.gecis();
  // Ekran kararır, bu sırada yeni mekanın resimleri yüklenir.
  const perde = k.add([k.rect(EKRAN_W, EKRAN_H), k.pos(0, 0), k.color(30, 30, 45), k.opacity(0), k.fixed(), k.z(9000)]);
  const kararma = new Promise((bitti) => k.tween(0, 1, 0.22, (o) => (perde.opacity = o)).onEnd(bitti));
  Promise.all([kararma, mekanYukle(hedef)]).then(() => { geciyor = false; k.go("mekan", hedef); });
}

// Haritada bir yerin kapısı: dünya koordinatında dikdörtgen.
const DUNYA = VERI.mekanlar.dunya;
function yerKapisi(y) {
  if (y.alan) return { ...y.alan, on: y.on, hedef: y.hedef, yer: y.id };
  const taban = DUNYA.taban || 472;
  return { x: y.x + y.kapi.x, y: taban - y.kapi.h, w: y.kapi.w, h: y.kapi.h, hedef: y.hedef, yer: y.id };
}
// Kapıdan geçen karakterin öbür tarafta durduğu yer.
function girisYeri(d) {
  if (d.giris) return d.giris;
  if (d.hedef === "dunya") {
    const y = DUNYA.yerler.find((y) => y.id === d.yer);
    if (y && y.on) return y.on;
    if (y) { const kp = yerKapisi(y); return { x: kp.x + kp.w / 2, y: DUNYA.zemin.ust + 50 }; }
  }
  return VERI.mekanlar[d.hedef].giris || { x: 640, y: 600 };
}

k.scene("mekan", (mekanId) => {
  const m = VERI.mekanlar[mekanId];
  const z = m.zemin;
  const genis = m.genislik || EKRAN_W;
  const yuksek = m.yukseklik || EKRAN_H;
  const harita = m.tur === "dunya";
  dunya.mekan = mekanId;
  kaydet();

  // --- Arka plan ---
  if (m.resim) k.add([k.sprite(m.resim, { width: EKRAN_W, height: EKRAN_H }), k.z(-100)]);
  (m.haritaResim || []).forEach((h, i, t) => k.add([k.sprite(h, { width: genis / t.length, height: yuksek }), k.pos((i * genis) / t.length, 0), k.z(-100)]));
  if (m.zeminResim) for (let x = 0; x < genis; x += EKRAN_W) k.add([k.sprite(m.zeminResim), k.pos(x, 0), k.z(-100)]);
  (m.susler || []).forEach((s) => k.add([k.sprite(s.resim), k.pos(s.x, s.y), k.anchor("bot"), k.z(s.arka ? -99.5 : -98)]));
  (m.yerler || []).filter((y) => y.resim).forEach((y) => k.add([k.sprite(y.resim), k.pos(y.x, m.taban || 472), k.anchor("botleft"), k.z(-99)]));
  if (!m.resim && !m.zeminResim && m.gecici) G.mekanlar[m.gecici]();

  // --- Kapılar ---
  // Haritada her yerin kapısı bir kapıdır. Odada kapılar veriden gelir, üstlerinde gidilen yerin simgesi durur.
  const kapilar = harita ? m.yerler.map(yerKapisi) : m.kapilar;
  if (!harita) kapilar.forEach((d) => G.kapi(d, !!m.resim, VERI.mekanlar[d.hedef].simge));
  // Kapının üstündeki ok: kamera tek başına öbür mekana geçer. Karakterler yerinde kalır.
  const okBul = (p) => (harita ? null : kapilar.find((d) => p.dist(k.vec2(d.x + d.w / 2, d.y - 40)) < 50));
  const kapiBul = (p) => kapilar.find((d) => p.x > d.x && p.x < d.x + d.w && p.y > d.y && p.y < d.y + d.h);
  // Haritada binanın herhangi bir yerine dokunmak da o yerin kapısına gider.
  const yerBul = (p) => {
    if (!harita) return null;
    const y = m.yerler.find((y) => {
      if (y.alan) return false; // alanı olan yer kapiBul ile bulunur
      const s = k.getSprite(y.resim), w = s && s.data ? s.data.width : 300, h = s && s.data ? s.data.height : 300;
      return p.x > y.x && p.x < y.x + w && p.y > (m.taban || 472) - h && p.y < (m.taban || 472);
    });
    return y ? yerKapisi(y) : null;
  };

  // --- Noktalar: musluk, fıskiye, dolap, raf, küvet, oturak, yatak, salıncak, kaydırak ---
  const noktalar = (m.noktalar || []).map((n, i) => {
    const o = { ...n, anahtar: mekanId + ":" + i };
    if (n.tur === "musluk") { o.akis = G.su(n.su.x, n.su.y, n.su.boy, n.su.renk); o.akis.hidden = true; }
    if (n.tur === "fiskiye") { o.akis = G.fiskiye(n.su.x, n.su.y); o.akis.hidden = !n.acik; }
    if (n.tur === "dolap") {
      // Açık dolap resmi. Kapalıyken gizli.
      o.acik = k.add([k.sprite(n.resim), k.pos(n.x0, n.y0), k.z(-90)]);
      o.acik.hidden = true;
    }
    if (n.raflar) {
      o.raflar = n.raflar.map((r) => ({
        ...r,
        boy: VERI.esyalar[r.sablon].boy * 0.62,
        resim: k.add([k.sprite("esya-" + r.sablon, { height: VERI.esyalar[r.sablon].boy * 0.62 }), k.pos(r.x, r.y), k.anchor("bot"), k.z(-89)]),
      }));
      o.raflar.forEach((r) => (r.resim.hidden = n.tur === "dolap"));
    }
    if (n.tur === "kuvet") {
      o.on = k.add([k.sprite(n.resim), k.pos(n.x0, n.y0), k.z(-80)]);
      o.yerler = n.yerler.map((y) => ({ ...y, dolu: null }));
    }
    if (n.tur === "tv") {
      // Ekranda renkleri değişen ışık ve zıplayan top: TV oynuyor.
      o.isik = k.add([k.rect(n.ekran.w, n.ekran.h, { radius: 14 }), k.pos(n.ekran.x, n.ekran.y), k.color(120, 200, 255), k.opacity(0.7), k.z(-88)]);
      o.top = o.isik.add([k.circle(14), k.pos(30, 30), k.color(255, 255, 255), k.opacity(0.9)]);
      o.isik.hidden = !dunya.acik[o.anahtar];
    }
    if (n.tur === "lamba") {
      // Yanan lamba: sarı hale ve parlak abajur.
      o.isik = k.add([k.pos(n.isik.x, n.isik.y), k.z(-87)]);
      o.isik.add([k.circle(170), k.anchor("center"), k.color(255, 235, 150), k.opacity(0.18)]);
      o.isik.add([k.circle(80), k.anchor("center"), k.color(255, 240, 170), k.opacity(0.3)]);
      if (n.abajur !== false) o.isik.add([k.polygon([k.vec2(-25, -18), k.vec2(25, -18), k.vec2(35, 18), k.vec2(-35, 18)]), k.color(255, 250, 210), k.outline(3, KALEM)]);
      o.isik.hidden = !dunya.acik[o.anahtar];
    }
    if (n.tur === "ocak") {
      // Her gözün kırmızı ateşi. Yanınca titrer.
      o.gozler = n.gozler.map((g, j) => {
        const ates = k.add([k.circle(27), k.pos(g.x, g.y), k.anchor("center"), k.scale(1, 0.27), k.color(240, 50, 30), k.outline(3, k.rgb(255, 150, 60)), k.opacity(0.95), k.z(-87)]);
        const anahtar = o.anahtar + ":" + j;
        ates.hidden = !dunya.acik[anahtar];
        return { ...g, ates, anahtar, dolu: null };
      });
    }
    if (n.tur === "salincak") {
      // İpler ve oturak: asma noktasında döner. Karakter oturunca ipler önünde kalır, tutuyormuş gibi durur.
      o.kol = k.add([k.pos(n.asma.x, n.asma.y), k.rotate(0), k.z(-83)]);
      // ara: iplerin merkezden uzaklığı. Resimdeki salıncağın üstüne tam otursun diye ayarlanır.
      const ara = n.ara || 36;
      for (const dx of [-ara, ara]) o.kol.add([k.rect(5, n.ip, { radius: 2 }), k.pos(dx, 0), k.anchor("top"), k.color(...(n.ipRenk || [120, 110, 100]))]);
      o.kol.add([k.rect(ara * 2 + 24, 16, { radius: 6 }), k.pos(0, n.ip), k.anchor("center"), k.color(...(n.renk || [90, 160, 230])), k.outline(3, KALEM)]);
      o.genlik = 0;
    }
    return o;
  });
  const icinde = (n, p) => n.w && p.x > n.x && p.x < n.x + n.w && p.y > n.y && p.y < n.y + n.h;
  const noktaBul = (p, tur) => noktalar.find((n) => (!tur || tur.includes(n.tur)) && icinde(n, p));
  const kuvetler = noktalar.filter((n) => n.tur === "kuvet");
  const OTURAK = ["klozet", "otur", "yatak", "salincak"];
  // Açılıp kapanan şeyler (TV, lamba, ocak gözü) kayıtta açık kalır.
  function acKapa(nesne, anahtar, ates = false) {
    nesne.hidden = !nesne.hidden;
    if (ates && !nesne.hidden) SES.ates();
    else SES.klik();
    if (nesne.hidden) delete dunya.acik[anahtar];
    else dunya.acik[anahtar] = true;
    kaydet();
  }
  const tvAcik = () => noktalar.some((n) => n.tur === "tv" && !n.isik.hidden);
  function dolapAcKapa(n) {
    const ac = n.acik.hidden;
    SES.dolap();
    n.acik.hidden = !ac;
    n.raflar.forEach((r) => (r.resim.hidden = !ac || r.bos));
  }
  // Açık dolapta ya da rafta dokunulan yiyecek veya eşya.
  function rafBul(p) {
    for (const n of noktalar) {
      if (!n.raflar || (n.acik && n.acik.hidden)) continue;
      const r = n.raflar.find((r) => !r.bos && p.dist(k.vec2(r.x, r.y - r.boy / 2)) < Math.max(28, r.boy * 0.8));
      if (r) return { n, r };
    }
    return null;
  }

  const ust = m.derinlikUst ?? 0.62;
  const derinlik = (y) => (ust + (1 - ust) * Math.max(0, Math.min(1, (y - z.ust) / (z.alt - z.ust)))) * (m.olcek || 1);
  const zemineSabitle = (y) => Math.max(z.ust, Math.min(z.alt, y));
  // Odada zemin arkaya doğru daralır. y derinliğinde basılabilen en sol ve en sağ x.
  function xSinir(y) {
    if (!z.ufuk) return [z.sol, z.sag];
    const t = (y - z.ufuk.y) / (z.arka.y - z.ufuk.y), pay = 45;
    return [Math.max(z.sol, z.ufuk.x + (z.arka.sol - z.ufuk.x) * t + pay), Math.min(z.sag, z.ufuk.x + (z.arka.sag - z.ufuk.x) * t - pay)];
  }
  const xSabitle = (x, y) => { const [a, b] = xSinir(y); return Math.max(a, Math.min(b, x)); };

  // --- Bitkiler: bahçede dikili çiçekler. Taşınmaz. Sulanınca filiz tomurcuk olur, tomurcuk açar. ---
  const bitkiler = [];
  noktalar.filter((n) => n.tur === "bitki").forEach((n) => n.bitkiler.forEach((b, j) => {
    const anahtar = n.anahtar + ":" + j, hal = dunya.bitki[anahtar] ?? b.hal ?? 0, s = derinlik(b.y) * 0.85;
    const sp = k.add([k.sprite("bitki-" + b.tur + "-" + hal), k.pos(b.x, b.y), k.anchor("bot"), k.scale(s), k.rotate(0), k.z(b.y)]);
    bitkiler.push({ ...b, anahtar, hal, s, sp, salla: 0 });
  }));
  const bitkiBul = (p) => bitkiler.find((b) => Math.abs(p.x - b.x) < Math.max(30, (b.sp.width * b.s) / 2) && p.y < b.y + 10 && p.y > b.y - b.sp.height * b.s);
  function enYakinBitki(o, enFazla = Infinity) {
    const d = (b) => Math.hypot(b.x - o.v.x, (b.y - o.zemY) * 2);
    const b = bitkiler.slice().sort((a, c) => d(a) - d(c))[0];
    return b && d(b) < enFazla ? b : null;
  }
  function bitkiBuyut(b) {
    b.salla = k.time() + 0.8;
    SES.buyu();
    if (b.hal >= 2) {
      for (let i = 0; i < 3; i++) k.wait(i * 0.25, () => kucukKalp(k.vec2(b.x + k.rand(-30, 30), b.y - b.sp.height * b.s)));
      return;
    }
    b.hal++;
    dunya.bitki[b.anahtar] = b.hal;
    b.sp.use(k.sprite("bitki-" + b.tur + "-" + b.hal));
    for (let i = 0; i < 8; i++) G.parilti(b.x + k.rand(-40, 40), b.y - k.rand(0.2, 1) * b.sp.height * b.s);
    kaydet();
  }

  // --- Çalışan: mekanın sabit kişisi. Gelen karaktere selam verir, dokununca mesleğiyle ilgili konuşur. ---
  const calisan = m.calisan ? (() => {
    const c = m.calisan, boy = 470 * derinlik(c.y);
    k.add([k.circle(50), k.pos(c.x, c.y), k.color(40, 25, 20), k.opacity(0.3), k.scale((boy / 470) * 1.7, (boy / 470) * 0.42), k.z(c.y - 0.5)]);
    const sp = k.add([k.sprite("calisan-" + c.meslek, { height: boy }), k.pos(c.x, c.y), k.anchor("bot"), k.scale(1), k.rotate(0), k.z(c.y)]);
    return { ...c, boy, sp, sira: Math.floor(Math.random() * c.sozler.length), balon: null, bitis: 0, agiz: false, pes: 0.8 + (c.meslek.length % 5) * 0.1 };
  })() : null;
  const calisanUstunde = (p) => calisan && Math.abs(p.x - calisan.x) < calisan.boy * 0.22 && p.y < calisan.y + 10 && p.y > calisan.y - calisan.boy;
  // Konuşma balonu kişinin başının üstünde durur. Ağzı konuşurken açılıp kapanır.
  function calisanKonus(metin) {
    const c = calisan;
    if (c.balon) c.balon.destroy();
    const x = Math.max(210, Math.min(EKRAN_W - 210, c.x));
    const b = k.add([k.pos(x, 0), k.z(7000)]);
    const yazi = b.add([k.text(metin, { size: 26, width: 340, font: "sans-serif", align: "center" }), k.anchor("center"), k.color(70, 50, 40)]);
    const w = yazi.width + 40, h = yazi.height + 30;
    b.pos.y = Math.max(h + 16, c.y - c.boy - 26);
    yazi.pos = k.vec2(0, -h / 2);
    b.add([k.rect(w, h, { radius: 22 }), k.anchor("bot"), k.color(255, 255, 255), k.outline(4, KALEM), k.z(-1)]);
    const uc = Math.max(-w / 2 + 24, Math.min(w / 2 - 24, c.x - x));
    b.add([k.polygon([k.vec2(uc - 14, -3), k.vec2(uc + 14, -3), k.vec2(uc, 22)]), k.color(255, 255, 255), k.outline(4, KALEM), k.z(-2)]);
    b.add([k.rect(30, 8), k.pos(uc, -2), k.anchor("center"), k.color(255, 255, 255), k.z(-0.5)]);
    c.balon = b;
    SES.konus(metin.length, c.pes || 1);
    c.bitis = k.time() + 2.6 + metin.length * 0.05;
    c.konusma = k.time() + 0.6 + metin.length * 0.04;
  }

  // --- Kamera: geniş mekanda (harita) sağa sola, yüksek mekanda yukarı aşağı kayar ---
  // Haritada yakınlaşıp uzaklaşılır: zum 1 normal, en küçük zumda bütün kasaba ekrana sığar.
  let kameraX = EKRAN_W / 2, kameraY = EKRAN_H / 2, takip = false, panYon = 0;
  const kayar = genis > EKRAN_W || yuksek > EKRAN_H;
  const ZUM_EN_AZ = Math.max(EKRAN_W / genis, EKRAN_H / yuksek), ZUM_EN_COK = 2;
  let zum = harita ? Math.max(ZUM_EN_AZ, Math.min(ZUM_EN_COK, dunya.zum || 1)) : 1;
  const kameraSinirla = () => {
    const yw = EKRAN_W / (2 * zum), yh = EKRAN_H / (2 * zum);
    kameraX = genis <= 2 * yw ? genis / 2 : Math.max(yw, Math.min(genis - yw, kameraX));
    kameraY = yuksek <= 2 * yh ? yuksek / 2 : Math.max(yh, Math.min(yuksek - yh, kameraY));
  };
  // Yakınlaşınca parmağın altındaki yer yerinde kalır.
  function zumla(yeni, e = k.vec2(EKRAN_W / 2, EKRAN_H / 2)) {
    yeni = Math.max(ZUM_EN_AZ, Math.min(ZUM_EN_COK, yeni));
    const wx = kameraX + (e.x - EKRAN_W / 2) / zum, wy = kameraY + (e.y - EKRAN_H / 2) / zum;
    zum = yeni;
    kameraX = wx - (e.x - EKRAN_W / 2) / zum; kameraY = wy - (e.y - EKRAN_H / 2) / zum;
    takip = false; kameraSinirla();
    dunya.zum = zum;
  }
  const ekran = () => k.mousePos();
  const fare = () => k.toWorld(k.mousePos());

  // --- Varlıkları kur ---
  // Her varlık: v (kayıt), zemY (zemindeki derinlik), h (zeminden yükseklik), hal, hedef.
  const varliklar = dunya.varliklar.filter((v) => v.mekan === mekanId).map(varlikKur);

  function varlikKur(v) {
    const o = { v, zemY: zemineSabitle(v.y), h: 0, vy: 0, yon: 1, hal: "dur", hedef: null, varinca: null, salla: 0 };
    // Zemindeki gölge: varlık yükseldikçe küçülür ve solar.
    o.golge = k.add([k.circle(50), k.pos(0, 0), k.color(40, 25, 20), k.opacity(0.3), k.scale(1, 0.25), k.z(0)]);
    if (v.tur === "karakter") {
      o.kr = K.kur(v.sablon, v.renk);
      o.kok = o.kr.kok;
      o.golgeEn = o.kr.genislik * 0.34;
    } else {
      const s = VERI.esyalar[v.sablon];
      o.boy = s.boy;
      o.kok = k.add([k.pos(0, 0), k.scale(1), k.rotate(0), k.z(0)]);
      if (s.resim) {
        const sp = o.kok.add([k.sprite("esya-" + v.sablon, { height: s.boy }), k.anchor("bot")]);
        o.golgeEn = sp.width * 0.55;
        o.en = sp.width;
      } else {
        G.sus[s.sekil](o.kok.add([...G.esya[s.sekil](), k.pos(0, -s.boy / 2), k.anchor("center")]));
        o.golgeEn = s.boy * 0.55;
      }
    }
    o.v.x = xSabitle(o.v.x, o.zemY);
    // Raftan alınan eşyanın kimliği zaman damgasıyla biter. Eski kayıttakiler de geçici sayılır.
    if (v.tur === "esya" && /\d{12}$/.test(v.id)) v.gecici = true;
    o.yenir = !o.kr && VERI.esyalar[v.sablon].yenir;
    o.eylemTur = !o.kr && VERI.esyalar[v.sablon].eylem;
    o.evcil = o.kr && VERI.karakterler[v.sablon].evcil;
    o.isirik = 0;
    return o;
  }
  // Kayıtta küvette olanları yerine koy.
  varliklar.forEach((o) => {
    if (o.v.kuvet == null) return;
    const kv = kuvetler[0], yer = kv && kv.yerler[o.v.kuvet];
    if (o.kr && yer && !yer.dolu) { o.kuvet = { kv, yer }; yer.dolu = o; o.kuvetT = k.time(); }
    else if (!o.kr && kv) o.yuzuyor = kv;
    else delete o.v.kuvet;
  });
  // Kayıtta oturan ya da yatanı yerine koy.
  varliklar.forEach((o) => {
    if (o.v.oturak == null) return;
    const n = noktalar[o.v.oturak];
    if (o.kr && n && OTURAK.includes(n.tur) && !n.dolu) otur(o, n, false);
    else delete o.v.oturak;
  });
  // Kayıtta elde duran ve giyilen eşyaları sahibine bağla.
  varliklar.forEach((o) => {
    if (o.v.elde) {
      o.elde = varliklar.find((c) => c.kr && c.v.id === o.v.elde) || null;
      if (!o.elde) { delete o.v.elde; delete o.v.el; }
    }
    if (o.v.giyili) {
      o.giyili = varliklar.find((c) => c.kr && c.v.id === o.v.giyili) || null;
      if (!o.giyili) delete o.v.giyili;
    }
  });
  // Kayıtta tezgahta, ocakta ya da dolapta duran eşyaları yerine koy.
  varliklar.forEach((o) => {
    if (o.v.yuzey == null) return;
    const n = noktalar[o.v.yuzey];
    if (o.kr || !n || !["tezgah", "ocak", "dolap"].includes(n.tur)) { delete o.v.yuzey; delete o.v.goz; return; }
    o.yuzey = n; o.yuzeyY = o.v.yy; o.zemY = z.ust;
    if (n.tur === "ocak") { o.goz = n.gozler[o.v.goz]; if (o.goz) o.goz.dolu = o; }
  });

  function olcek(o) {
    return o.kr ? (o.kr.boy / o.kr.yukseklik) * derinlik(o.zemY) : derinlik(o.zemY);
  }

  // Ekrandaki noktaya dokunulan en öndeki varlık.
  function dokunulan(p) {
    const adaylar = varliklar.filter((o) => {
      if (o.kr) return karakterUstunde(o, p);
      if (o.yeniyor || o.kok.hidden && o.yuzey) return false; // kapalı dolaptaki eşya
      const r = o.giyili ? o.boy * Math.abs(o.kok.scale.y) * 0.4 : Math.max(26, o.boy * olcek(o) * 0.75);
      return p.dist(merkez(o)) < r;
    });
    // Önce tutulan, sonra elde ya da üstte duran eşya, sonra karakter, sonra öndeki.
    const oncelik = (o) => (o === tutulan ? 3 : o.elde || o.giyili ? 2 : o.kr ? 1 : 0);
    adaylar.sort((a, b) => oncelik(b) - oncelik(a) || b.zemY - a.zemY);
    return adaylar[0] || null;
  }
  function karakterUstunde(o, p) {
    const s = olcek(o), ay = o.kok.pos.y;
    if (o.oturak && o.oturak.tur === "yatak") {
      const y = o.oturak.yatis;
      const uc = y.x + (o.oturak.yon || 1) * o.oturak.uzunluk;
      return p.x > Math.min(y.x, uc) - 20 && p.x < Math.max(y.x, uc) + 20 && Math.abs(p.y - y.y) < 70;
    }
    const alt = o.kuvet ? o.kuvet.kv.su + 10 : ay + 10;
    return Math.abs(p.x - o.kok.pos.x) < (o.kr.genislik * s) / 2 && p.y < alt && p.y > ay - o.kr.yukseklik * s;
  }

  // --- Küvet ---
  // Karakter küvete girer: suyun altında kalan gövdesini küvetin ön yüzü örter.
  function kuveteGir(o, kv) {
    const yer = kv.yerler.filter((y) => !y.dolu).sort((a, b) => Math.abs(a.x - o.v.x) - Math.abs(b.x - o.v.x))[0];
    if (!yer) return false;
    o.kuvet = { kv, yer }; yer.dolu = o; o.kuvetT = k.time();
    o.v.kuvet = kv.yerler.indexOf(yer);
    o.hedef = null; o.vy = 0; o.zemY = z.ust; o.v.x = yer.x; o.v.y = z.ust;
    for (let i = 0; i < 12; i++) G.kopuk(yer.x + k.rand(-70, 70), kv.su + k.rand(-6, 6));
    SES.sicrama();
    kaydet();
    return true;
  }
  function kuvettenCik(o) {
    const p = o.kok.pos;
    if (o.kuvet) { o.kuvet.yer.dolu = null; o.kuvet = null; }
    o.yuzuyor = null;
    delete o.v.kuvet;
    o.zemY = z.ust; o.v.x = p.x; o.h = Math.max(0, o.zemY - p.y);
  }
  function suyaBirak(o, kv, p) {
    o.yuzuyor = kv; o.v.kuvet = 0;
    o.v.x = Math.max(kv.x + 50, Math.min(kv.x + kv.w - 50, p.x)); o.zemY = z.ust; o.v.y = z.ust;
    o.h = 0; o.vy = 0;
    for (let i = 0; i < 5; i++) G.kopuk(o.v.x + k.rand(-30, 30), kv.su);
    SES.sicrama();
    kaydet();
  }

  // --- Oturaklar: klozet, sandalye, yatak, salıncak ---
  function otur(o, n, kayit = true) {
    n.dolu = o; o.oturak = n; o.v.oturak = noktalar.indexOf(n);
    o.hedef = null; o.vy = 0; o.vx = 0; o.h = 0; o.zemY = z.ust;
    const yer = n.oturma || n.yatis || n.asma;
    o.v.x = yer.x; o.v.y = z.ust;
    o.oturT = k.time();
    if (n.tur === "klozet") o.sansur = G.sansur();
    if (n.tur === "yatak") {
      // Yorgan karakterin bacaklarını örter.
      const y = n.yorgan;
      o.yorgan = k.add([k.rect(y.w, y.h, { radius: 18 }), k.pos(y.x, y.y), k.color(...n.renk), k.outline(3, KALEM), k.z(-83)]);
      o.uyku = 0;
    }
    if (n.tur === "salincak") n.genlik = Math.max(n.genlik, 18);
    if (kayit) kaydet();
  }
  function kalk(o) {
    const n = o.oturak, p = o.kok.pos;
    n.dolu = null; o.oturak = null; delete o.v.oturak;
    if (o.sansur) { o.sansur.destroy(); o.sansur = null; }
    if (o.yorgan) { o.yorgan.destroy(); o.yorgan = null; }
    o.kok.angle = 0;
    o.zemY = z.ust; o.v.x = p.x; o.h = Math.max(0, o.zemY - p.y);
    if (n.tur === "klozet") sifon(n);
  }
  // Sifon: klozetin içinde su döner, köpükler çıkar.
  function sifon(n) {
    const m = k.vec2(n.oturma.x, 382);
    SES.sifon();
    for (let i = 0; i < 10; i++) k.wait(i * 0.06, () => G.kopuk(m.x + Math.cos(i) * 30, m.y + Math.sin(i) * 6, -79, k.rand(3, 7)));
    G.kirinti(m, [120, 180, 240]);
  }

  // --- Kaydırak: karakter üstten alta kayar, sonra yere atlar ---
  function kaymayaBasla(o, n) {
    o.kayiyor = { n, t0: k.time() };
    SES.kay();
    o.hedef = null; o.vy = 0; o.vx = 0; o.h = 0;
  }

  // Eşyanın ekrandaki orta noktası (yerde, havada ya da elde).
  function merkez(o) {
    return k.vec2(o.kok.pos.x, o.kok.pos.y - (o.boy * o.kok.scale.y) / 2);
  }

  // --- Seçili karakter: dokun-yürü onu yürütür ---
  let secili = varliklar.find((o) => o.kr && o.v.id === dunya.secili) || varliklar.find((o) => o.kr) || null;
  if (secili) dunya.secili = secili.v.id;
  const isaret = k.add([k.polygon([k.vec2(-14, -12), k.vec2(14, -12), k.vec2(0, 6)]), k.pos(0, 0), k.color(255, 210, 50), k.outline(3, KALEM), k.z(4500)]);
  function sec(o) {
    if (!o || !o.kr) return;
    secili = o;
    dunya.secili = o.v.id;
  }

  function yuru(o, p, sonra = null) {
    const y = zemineSabitle(p.y);
    o.hedef = k.vec2(xSabitle(p.x, y), y);
    o.varinca = sonra;
    if (harita && o === secili) takip = true;
  }

  // Varlığı başka mekana gönderir. Karakter ise kamera da onunla gider.
  function kapidanGec(o, d) {
    const g = girisYeri(d);
    o.v.mekan = d.hedef;
    // Eşyalar girişte üst üste binmesin diye biraz dağılır.
    o.v.x = g.x + (o.kr ? 0 : k.rand(-80, 80)); o.v.y = g.y + (o.kr ? 0 : k.rand(0, 80));
    if (o.kr) {
      // Karakter ve üstündekiler bu sahneden hemen çıkar. Yoksa ekran kararırken oda onları duvarın önüne çeker.
      varliklar.filter((e) => e.elde === o || e.giyili === o).forEach((e) => { e.v.mekan = d.hedef; e.v.x = o.v.x; e.v.y = o.v.y; kaldir(e); });
      kaldir(o);
      if (o === secili) secili = null;
      dunya.secili = o.v.id;
      if (d.hedef === "dunya") { dunya.kamera = g.x; dunya.kameraY = g.y; }
      return gec(d.hedef);
    }
    kaldir(o);
    kaydet();
  }
  function kaldir(o) {
    varliklar.splice(varliklar.indexOf(o), 1);
    o.kok.destroy();
    o.golge.destroy();
  }

  // --- Ele alma ve yeme ---
  // Karakterin iki eli var. Önce sağ el dolar, sonra sol el. İki el doluysa sağdaki yere düşer.
  function eleVer(sahip, o) {
    if (o.giyili) giysiCikar(o);
    if (o.yuzey) yuzeydenAl(o);
    let diger = varliklar.filter((e) => e.elde === sahip && e !== o);
    if (diger.length >= sahip.kr.eller) {
      eldenBirak(diger.find((e) => e.v.el !== "sol") || diger[0]);
      diger = varliklar.filter((e) => e.elde === sahip && e !== o);
    }
    o.v.el = diger.some((e) => e.v.el !== "sol") ? "sol" : "sag";
    o.elde = sahip; o.v.elde = sahip.v.id;
    o.h = 0; o.vy = 0;
    kaydet();
  }
  function eldenBirak(o) {
    const p = o.kok.pos;
    o.zemY = o.elde.zemY; o.v.x = p.x; o.h = Math.max(0, o.zemY - p.y);
    o.elde = null; delete o.v.elde; delete o.v.el;
  }

  // --- Giyinme: kıyafet karakterin gövdesine ya da başına oturur ---
  function giydir(sahip, o) {
    const yer = VERI.esyalar[o.v.sablon].giy;
    // Aynı yerde ya da aynı bölgeyi boyayan başka kıyafet varsa çıkar ve yere düşer. Örnek: pantolon elbiseyi çıkarır.
    const boya = VERI.esyalar[o.v.sablon].boya || [];
    varliklar.filter((e) => {
      if (e.giyili !== sahip || e === o) return false;
      const ee = VERI.esyalar[e.v.sablon];
      return ee.giy === yer || (ee.boya || []).some((b) => boya.includes(b));
    }).forEach(giysiCikar);
    if (o.elde) { o.elde = null; delete o.v.elde; delete o.v.el; }
    if (o.yuzey) yuzeydenAl(o);
    o.giyili = sahip; o.v.giyili = sahip.v.id;
    SES.giy();
    o.h = 0; o.vy = 0; o.vx = 0;
    const s = olcek(sahip);
    for (let i = 0; i < 6; i++) G.parilti(sahip.kok.pos.x + k.rand(-60, 60) * s * 2, sahip.kok.pos.y - k.rand(0.2, 0.9) * sahip.kr.yukseklik * s);
    kaydet();
  }
  function giysiCikar(o) {
    const p = o.kok.pos, e = VERI.esyalar[o.v.sablon];
    (e.boya || []).forEach((b) => K.boya(o.giyili.kr, b, null));
    o.kok.hidden = false;
    o.zemY = o.giyili.zemY; o.v.x = p.x; o.h = Math.max(0, o.zemY - p.y);
    o.giyili = null; delete o.v.giyili;
    o.kok.angle = 0;
  }

  // --- Tezgah, ocak ve dolap: eşya üstüne ya da içine konur, düşmez. Kapalı dolaptaki eşya görünmez. ---
  function yuzeyeKoy(o, n, p) {
    if (n.tur === "ocak") {
      if (!VERI.esyalar[o.v.sablon].ocak) return false;
      const g = n.gozler.filter((g) => !g.dolu).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
      if (!g) return false;
      o.goz = g; g.dolu = o; o.v.goz = n.gozler.indexOf(g);
      o.v.x = g.x; o.yuzeyY = g.y + 3;
    } else if (n.tur === "dolap") {
      // Dolapta eşya bir rafın üstüne oturur: bırakılan yerin altındaki en yakın raf.
      const raflar = [...new Set(n.raflar.map((r) => r.y))].sort((a, b) => a - b);
      o.v.x = Math.max(n.x + 25, Math.min(n.x + n.w - 25, p.x));
      o.yuzeyY = raflar.find((y) => y >= p.y - 20) || raflar[raflar.length - 1];
      for (let i = 0; i < 4; i++) G.parilti(o.v.x + k.rand(-25, 25), o.yuzeyY - k.rand(0, 40));
    } else {
      o.v.x = Math.max(n.x + 25, Math.min(n.x + n.w - 25, p.x));
      o.yuzeyY = n.ust;
    }
    o.yuzey = n; o.v.yuzey = noktalar.indexOf(n); o.v.yy = o.yuzeyY;
    o.zemY = z.ust; o.h = 0; o.vy = 0; o.vx = 0;
    kaydet();
    return true;
  }
  function yuzeydenAl(o) {
    const p = o.kok.pos;
    if (o.goz) { o.goz.dolu = null; o.goz = null; }
    o.yuzey = null; delete o.v.yuzey; delete o.v.goz; delete o.v.yy;
    o.kok.hidden = false;
    o.zemY = z.ust; o.v.x = p.x; o.h = Math.max(0, o.zemY - p.y);
  }
  // Üç ısırık: her ısırıkta eşya küçülür, kırıntı düşer. Sonunda eşya biter, kalp çıkar.
  function ye(sahip, o) {
    if (o.yeniyor) return;
    eleVer(sahip, o);
    o.yeniyor = true;
    sahip.mesgul = k.time() + 1.6;
    sahip.hedef = null;
    let n = 0;
    const isir = () => {
      if (!varliklar.includes(o)) return;
      n++; o.isirik = n;
      G.kirinti(K.agizYeri(sahip.kr), o.yenir);
      SES.isir();
      if (n < 3) return k.wait(0.45, isir);
      kaldir(o);
      dunya.varliklar.splice(dunya.varliklar.indexOf(o.v), 1);
      kalpCikar(sahip);
      kaydet();
    };
    k.wait(0.35, isir);
  }
  function kalpCikar(o) {
    const s = olcek(o);
    const kl = G.kalp(o.kok.pos.x, o.kok.pos.y - o.kr.yukseklik * s - 30);
    k.tween(0, 1, 1.2, (t) => { kl.pos.y -= 1.2; kl.opacity = 1 - t; kl.scale = k.vec2(1 + t * 0.3); }).onEnd(() => kl.destroy());
  }
  // Küçük kalp: steteskop, çiçek koklama.
  function kucukKalp(p) {
    const kl = G.kalp(p.x, p.y);
    kl.scale = k.vec2(0.45);
    k.tween(0, 1, 1, (t) => { kl.pos.y -= 1; kl.opacity = 1 - t; }).onEnd(() => kl.destroy());
  }
  // Eşyanın hareketi. Yiyecek yenir; atılan eşya fırlar; diğerleri elde bir süre oynatılır.
  const EYLEM_SURE = { konus: 2.4, oku: 2.6, ic: 1.8, fircala: 2.2, yaz: 2.6, yika: 2.4, kurula: 2.2, sik: 1.2, dinle: 2.4, tara: 2.4, kurut: 2.4, sula: 2.6, kaz: 2.0, kokla: 2.0, karistir: 2.4, kumanda: 1.0,
    olc: 2.4, yapistir: 1.4, kes: 2.4, bak: 2.4, ucur: 4.5, birak: 3.4, saril: 2.2, ufle: 1.6 };
  function eylemYap(sahip, o, vardi = false) {
    if (o.yenir) return ye(sahip, o);
    const tur = o.eylemTur;
    if (!tur || o.eylem || o.yeniyor) return;
    if (tur === "giy") return giydir(sahip, o);
    eleVer(sahip, o);
    sahip.hedef = null;
    // Sulama kabını tutan karakter en yakın çiçeğin yanına yürür, ona döner ve sular.
    const bitki = tur === "sula" && enYakinBitki(sahip);
    if (bitki && !vardi) {
      const yan = sahip.v.x < bitki.x ? -1 : 1;
      return yuru(sahip, k.vec2(bitki.x + yan * 95, bitki.y + 12), () => { sahip.yon = -yan; eylemYap(sahip, o, true); });
    }
    if (tur === "at" || tur === "sur") {
      SES.eylem(tur);
      const yer = o.kok.pos;
      eldenBirak(o);
      o.vx = sahip.yon * (tur === "at" ? 380 : 520);
      if (tur === "at") { o.vy = -950; o.h = Math.max(o.h, 1); }
      else { o.h = 0; o.vy = 0; o.zemY = zemineSabitle(sahip.zemY + 12); o.v.x = yer.x; }
      kaydet();
      return;
    }
    const t0 = k.time(), sure = EYLEM_SURE[tur];
    o.eylem = { tur, t0, sayac: 0 };
    SES.eylem(tur, sure);
    sahip.mesgul = t0 + sure;
    if (tur === "yaz") {
      const el = K.elYeri(sahip.kr, o.v.el);
      o.eylem.kagit = G.kagit(el.x + sahip.yon * 30, el.y + 10, sahip.kok.z + 0.3);
    }
    if (tur === "sik") G.nota(o.kok.pos.x, o.kok.pos.y - 40, [250, 190, 40]);
    // Kumanda odadaki TV'yi açar ya da kapatır.
    if (tur === "kumanda") { const tv = noktalar.find((n) => n.tur === "tv"); if (tv) acKapa(tv.isik, tv.anahtar); G.nota(o.kok.pos.x, o.kok.pos.y - 30); }
    // Uçurtma ve balon: elden eşyaya bir ip çizilir.
    if (tur === "ucur" || tur === "birak") {
      o.eylem.ip = k.add([k.z(sahip.kok.z + 0.4), { draw() {
        if (!o.elde) return;
        const el = K.elYeri(o.elde.kr, o.v.el), s = o.kok.scale.y, uc = o.kok.pos.sub(0, tur === "ucur" ? o.boy * s * 0.3 : 0);
        k.drawLine({ p1: el, p2: uc, width: 2, color: KALEM });
      } }]);
    }
    k.wait(sure, () => {
      if (o.eylem && o.eylem.kagit) { const kg = o.eylem.kagit; k.wait(1.2, () => kg.destroy()); }
      if (o.eylem && o.eylem.ip) o.eylem.ip.destroy();
      o.eylem = null;
      if (!varliklar.includes(o)) return;
      // Ateş ölçülünce, yara bandı yapışınca ve ayıya sarılınca karakter sevinir.
      if (["olc", "yapistir", "saril", "bak"].includes(tur) && varliklar.includes(sahip)) kalpCikar(sahip);
      // Yara bandı yapışınca biter.
      if (tur === "yapistir") { kaldir(o); dunya.varliklar.splice(dunya.varliklar.indexOf(o.v), 1); kaydet(); return; }
      // Mumlar üflenince söner. Sönük pasta yenir.
      if (tur === "ufle") {
        const yeni = VERI.esyalar[o.v.sablon].sonra, e = VERI.esyalar[yeni];
        o.v.sablon = yeni; o.boy = e.boy; o.yenir = e.yenir; o.eylemTur = e.eylem;
        o.kok.children[0].use(k.sprite("esya-" + yeni, { height: e.boy }));
        SES.buyu();
        for (let i = 0; i < 6; i++) G.parilti(o.kok.pos.x + k.rand(-30, 30), o.kok.pos.y - o.boy * o.kok.scale.y - k.rand(0, 30));
        kaydet();
      }
      if (tur === "sula" && varliklar.includes(sahip)) { const b = enYakinBitki(sahip, 260); if (b) bitkiBuyut(b); }
    });
  }
  // Bırakılan eşya bir karakterin üstündeyse: yiyecek ağza yakınsa yenir, değilse ele alınır.
  function karakteraBirak(o, p) {
    const sahip = varliklar.filter((c) => c.kr && !(c.oturak && c.oturak.tur === "yatak") && karakterUstunde(c, p)).sort((a, b) => b.zemY - a.zemY)[0];
    if (!sahip) return false;
    const agiz = K.agizYeri(sahip.kr), s = olcek(sahip);
    if (o.yenir && p.dist(agiz) < sahip.kr.genislik * s * 0.35) ye(sahip, o);
    else if (o.eylemTur === "giy") giydir(sahip, o);
    else eleVer(sahip, o);
    return true;
  }

  // Raftan al: rafta duran yerde gerçek bir eşya olur, parmak onu tutar.
  // Raf biraz sonra yeniden dolar.
  function raftanAl({ n, r }) {
    if (varliklar.filter((o) => !o.kr).length >= 24) return null;
    const v = { id: r.sablon + Date.now(), tur: "esya", sablon: r.sablon, mekan: mekanId, x: r.x, y: z.ust + 50, gecici: true };
    SES.pop();
    dunya.varliklar.push(v);
    dunya.bilinen.push(v.id);
    const o = varlikKur(v);
    varliklar.push(o);
    o.h = o.zemY - r.y;
    o.kok.pos = k.vec2(r.x, r.y);
    o.kok.scale = k.vec2(derinlik(o.zemY));
    r.bos = true; r.resim.hidden = true;
    k.wait(1.5, () => {
      // Rafın renk sırası varsa sıradaki renk gelir.
      if (r.sira) {
        r.sablon = r.sira[(r.sira.indexOf(r.sablon) + 1) % r.sira.length];
        r.resim.use(k.sprite("esya-" + r.sablon, { height: VERI.esyalar[r.sablon].boy * 0.62 }));
      }
      r.bos = false; r.resim.hidden = !!(n.acik && n.acik.hidden);
    });
    kaydet();
    return o;
  }

  // --- Arayüz: ekrana sabit düğmeler ---
  // Odada: sol üstte haritaya dönüş. Haritada: iki yanda kaydırma okları. Her yerde: sağ üstte karakter simgeleri.
  const dugmeler = [];
  function dugme(x, y, ciz, tur, yon = 0) {
    const o = k.add([k.pos(x, y), k.fixed(), k.z(6000), k.opacity(1)]);
    ciz(o);
    dugmeler.push({ o, x, y, r: 46, tur, yon });
    return o;
  }
  if (!harita) dugme(66, 66, (o) => o.add([k.sprite("simge-harita", { width: 88, height: 88 }), k.anchor("center"), k.fixed()]), "harita");
  else if (!m.yukseklik) {
    for (const yon of [-1, 1]) {
      dugme(yon < 0 ? 50 : EKRAN_W - 50, 330, (o) => {
        o.add([k.circle(36), k.color(255, 255, 255), k.outline(4, KALEM), k.opacity(0.85), k.fixed()]);
        o.add([k.polygon([k.vec2(-12 * yon, -18), k.vec2(16 * yon, 0), k.vec2(-12 * yon, 18)]), k.color(70, 50, 40), k.fixed()]);
      }, "kaydir", yon);
    }
  }
  // Haritada yakınlaştırma düğmeleri: sol tarafta artı ve eksi.
  if (harita) {
    for (const yon of [1, -1]) {
      dugme(50, yon > 0 ? 470 : 550, (o) => {
        o.add([k.circle(32), k.color(255, 255, 255), k.outline(4, KALEM), k.opacity(0.85), k.fixed()]);
        o.add([k.rect(28, 7, { radius: 3 }), k.anchor("center"), k.color(70, 50, 40), k.fixed()]);
        if (yon > 0) o.add([k.rect(7, 28, { radius: 3 }), k.anchor("center"), k.color(70, 50, 40), k.fixed()]);
      }, "zum", yon);
    }
    // Fare tekerleği ve iki parmak.
    k.onScroll((d) => zumla(zum * (d.y > 0 ? 0.9 : 1.1), ekran()));
    let cimdik = null;
    cimdikIsleyici = (t) => {
      if (!t) { if (cimdik) kaydet(); cimdik = null; return; }
      if (tutulan && surukluyor) return;
      tutulan = null; basla = null; kaydirma = null; kaydiriyor = false;
      const r = k.canvas.getBoundingClientRect(), olcek = EKRAN_W / r.width;
      const a = t[0], b = t[1];
      const uzak = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const orta = k.vec2(((a.clientX + b.clientX) / 2 - r.left) * olcek, ((a.clientY + b.clientY) / 2 - r.top) * olcek);
      if (cimdik) zumla(zum * uzak / cimdik, orta);
      cimdik = uzak;
    };
    k.onSceneLeave(() => (cimdikIsleyici = null));
  }
  // Ses düğmesi: sol altta hoparlör. Kapalıyken üstünde kırmızı çizgi olur.
  let sesCizgi;
  dugme(50, EKRAN_H - 50, (o) => {
    o.add([k.circle(32), k.color(255, 255, 255), k.outline(4, KALEM), k.opacity(0.85), k.fixed()]);
    o.add([k.polygon([k.vec2(-16, -7), k.vec2(-7, -7), k.vec2(4, -16), k.vec2(4, 16), k.vec2(-7, 7), k.vec2(-16, 7)]), k.color(70, 50, 40), k.fixed()]);
    for (const r of [9, 15]) o.add([k.rect(3, r * 1.4, { radius: 2 }), k.pos(6 + r * 0.6, 0), k.anchor("center"), k.color(70, 50, 40), k.fixed()]);
    sesCizgi = o.add([k.rect(52, 6, { radius: 3 }), k.anchor("center"), k.rotate(-45), k.color(230, 60, 60), k.fixed()]);
  }, "ses");
  sesCizgi.hidden = SES.acik();
  function sesDugmesi() { SES.baslat(); sesCizgi.hidden = SES.acKapa(); }
  // Ortam sesi: haritada şehir, bahçe ve parkta kuşlar, odada sessizlik.
  SES.ortam(harita ? "sehir" : z.ufuk ? null : "bahce");
  // Karakter simgeleri: sağ üstte, her karakter için bir yuvarlak. Dokununca o karaktere gidilir.
  const portreler = dunya.varliklar.filter((v) => v.tur === "karakter").map((v, i) => {
    let halka;
    dugme(EKRAN_W - 50 - i * 80, 50, (o) => {
      halka = o.add([k.circle(42), k.color(255, 210, 50), k.outline(4, KALEM), k.fixed()]);
      o.add([k.circle(34), k.color(255, 255, 255), k.outline(4, KALEM), k.fixed()]);
      const q = VERI.karakterler[v.sablon].portre || [0.12, 0, 0.76, 0.44];
      const sp = o.add([k.sprite("portre-" + v.sablon, { quad: k.quad(...q) }), k.anchor("center"), k.pos(0, 4), k.scale(1), k.fixed()]);
      sp.scale = k.vec2(62 / Math.max(sp.width, sp.height));
    }, "karakter");
    dugmeler[dugmeler.length - 1].id = v.id;
    dugmeler[dugmeler.length - 1].r = 40;
    return { id: v.id, halka };
  });
  // Karaktere git: aynı mekandaysa onu seç, başka mekandaysa o mekana geç.
  function karaktereGit(id) {
    const v = dunya.varliklar.find((v) => v.id === id);
    if (!v) return;
    dunya.secili = id;
    if (v.mekan === mekanId) {
      const o = varliklar.find((o) => o.v === v);
      sec(o);
      if (harita) takip = true;
      if (o && !o.oturak && !o.kuvet) { o.salla = k.time() + 1.2; kalpCikar(o); }
      return kaydet();
    }
    if (v.mekan === "dunya") { dunya.kamera = v.x; dunya.kameraY = v.y; }
    gec(v.mekan);
  }
  // Harita düğmesi: seçili karakter bu yerin kapısından sokağa çıkar, yerin önünde durur.
  // Evin iç odalarından çıkınca evin önüne çıkılır.
  function disariCik() {
    const d = m.kapilar.find((d) => d.hedef === "dunya") || (m.ev && { hedef: "dunya", yer: m.ev });
    if (!d || !secili || !varliklar.includes(secili)) return gec("dunya");
    const o = secili;
    if (o.oturak) kalk(o);
    if (o.kuvet || o.yuzuyor) kuvettenCik(o);
    o.kayiyor = null; o.hedef = null;
    kapidanGec(o, { hedef: "dunya", yer: d.yer });
  }
  const dugmeBul = (e) => dugmeler.find((d) => !d.o.hidden && e.dist(k.vec2(d.x, d.y)) < d.r);

  // Mekanın adı: girişte üstte kısa bir süre görünür.
  const tabela = k.add([k.pos(EKRAN_W / 2, 44), k.fixed(), k.z(6000), k.opacity(1)]);
  const tabelaYazi = tabela.add([k.text(m.ad || "", { size: 30, font: "sans-serif" }), k.anchor("center"), k.pos(26, 2), k.color(70, 50, 40), k.fixed(), k.opacity(1)]);
  const tabelaEn = tabelaYazi.width + 110;
  tabela.add([k.rect(tabelaEn, 60, { radius: 30 }), k.anchor("center"), k.color(255, 250, 235), k.outline(4, KALEM), k.fixed(), k.opacity(1), k.z(-1)]);
  if (m.simge) tabela.add([k.sprite("simge-" + m.simge, { width: 48, height: 48 }), k.anchor("center"), k.pos(-tabelaEn / 2 + 34, 0), k.fixed(), k.opacity(1)]);
  k.wait(1.8, () => k.tween(1, 0, 0.5, (a) => tabela.children.forEach((c) => (c.opacity = a))).onEnd(() => tabela.destroy()));
  // Giriş perdesi: kararmış ekran açılır.
  const perde = k.add([k.rect(EKRAN_W, EKRAN_H), k.pos(0, 0), k.color(30, 30, 45), k.opacity(1), k.fixed(), k.z(9000)]);
  k.tween(1, 0, 0.3, (a) => (perde.opacity = a)).onEnd(() => perde.destroy());

  // Kameranın başlangıç yeri: haritada kayıtlı yer, yoksa seçili karakter.
  if (harita) {
    kameraX = dunya.kamera != null ? dunya.kamera : secili ? secili.v.x : m.giris.x;
    kameraY = dunya.kameraY != null ? dunya.kameraY : secili ? secili.v.y : m.giris.y;
    kameraSinirla();
  }
  k.setCamPos(kameraX, kameraY);
  k.setCamScale(zum);

  // --- Sokaktan araç geçer: ara sıra bir araba ya da otobüs ekranın bir ucundan öbür ucuna gider ---
  // Uzak şeritte sola, yakın şeritte sağa gider. Önünde karakter varsa korna çalar.
  function aracGonder() {
    const saga = k.rand() < 0.5, y = saga ? 688 : 618, yon = saga ? 1 : -1;
    const s = derinlik(y);
    const a = k.add([k.sprite(k.choose(m.araclar)), k.pos(kameraX - yon * (EKRAN_W / (2 * zum) + 450), y), k.anchor("bot"), k.scale(s * yon, s), k.z(y)]);
    const hiz = yon * k.rand(260, 380), korna = new Set();
    SES.motor((EKRAN_W + 900) / Math.abs(hiz));
    if (k.rand() < 0.3) k.wait(k.rand(1, 2.5), () => SES.korna()); // bazen önünde kimse yokken de korna çalar
    a.onUpdate(() => {
      a.pos.x += hiz * k.dt();
      a.pos.y = y - Math.abs(Math.sin(k.time() * 18)) * 1.5;
      for (const o of varliklar) {
        const on = (o.v.x - a.pos.x) * yon;
        if (!o.kr || korna.has(o) || Math.abs(o.zemY - y) > 70 || on < 0 || on > a.width * s * 0.5 + 160) continue;
        korna.add(o);
        G.nota(a.pos.x + yon * a.width * s * 0.4, y - a.height * s, [240, 80, 60]);
        SES.korna();
        k.wait(0.2, () => G.nota(a.pos.x + yon * a.width * s * 0.4, y - a.height * s, [240, 80, 60]));
        o.salla = k.time() + 1;
      }
      if ((a.pos.x - kameraX) * yon > EKRAN_W / (2 * zum) + 500) a.destroy();
    });
  }
  if (harita && m.araclar) {
    let sonraki = k.time() + 3;
    k.onUpdate(() => { if (k.time() > sonraki) { sonraki = k.time() + k.rand(6, 12); aracGonder(); } });
  }

  // --- Dokunma ve sürükleme ---
  let tutulan = null, basla = null, kayma = null, surukluyor = false;
  let basiliDugme = null, kaydirma = null, kaydiriyor = false;

  // Tutulan varlığın ayak noktası parmağı izler. Zemin bandındaysa derinlik değişir, üstündeyse havaya kalkar.
  function tasi() {
    const p = fare();
    const ayakX = p.x + kayma.x, ayakY = p.y + kayma.y;
    tutulan.v.x = Math.max(20, Math.min(genis - 20, ayakX));
    if (ayakY >= z.ust) {
      tutulan.zemY = zemineSabitle(ayakY); tutulan.h = 0;
      tutulan.v.x = xSabitle(tutulan.v.x, tutulan.zemY);
    } else tutulan.h = tutulan.zemY - ayakY;
    tutulan.hal = "tutuluyor";
  }

  k.onMousePress(() => {
    SES.baslat();
    const e = ekran();
    basiliDugme = dugmeBul(e);
    if (basiliDugme) { if (basiliDugme.tur === "kaydir") panYon = basiliDugme.yon; return; }
    const p = fare();
    basla = p;
    surukluyor = false;
    tutulan = dokunulan(p);
    if (!tutulan) { const r = rafBul(p); if (r) tutulan = raftanAl(r); }
    if (tutulan) kayma = k.vec2(tutulan.kok.pos.x - p.x, tutulan.kok.pos.y - p.y);
    // Boş yerde parmak kayarsa harita kayar.
    else if (kayar) kaydirma = { x0: e.x, y0: e.y, kam0: kameraX, kamY0: kameraY };
  });

  k.onMouseMove(() => {
    if (basiliDugme) return;
    if (kaydirma) {
      const dx = ekran().x - kaydirma.x0, dy = ekran().y - kaydirma.y0;
      if (!kaydiriyor && Math.hypot(dx, dy) > SURUKLE_ESIGI) kaydiriyor = true;
      if (kaydiriyor) { kameraX = kaydirma.kam0 - dx / zum; kameraY = kaydirma.kamY0 - dy / zum; takip = false; kameraSinirla(); }
      return;
    }
    if (!tutulan || !basla) return;
    const p = fare();
    if (!surukluyor && p.dist(basla) < SURUKLE_ESIGI) return;
    if (!surukluyor) {
      surukluyor = true;
      tutulan.hedef = null;
      tutulan.vy = 0;
      tutulan.vx = 0;
      if (tutulan.elde) eldenBirak(tutulan);
      if (tutulan.giyili) giysiCikar(tutulan);
      if (tutulan.yuzey) yuzeydenAl(tutulan);
      if (tutulan.kuvet || tutulan.yuzuyor) kuvettenCik(tutulan);
      if (tutulan.oturak) kalk(tutulan);
      tutulan.kayiyor = null;
      if (tutulan.kr) sec(tutulan);
    }
    tasi();
  });

  k.onMouseRelease(() => {
    if (basiliDugme) {
      const d = basiliDugme;
      basiliDugme = null; panYon = 0;
      if (d.tur === "harita") return disariCik();
      if (d.tur === "ses") return sesDugmesi();
      if (d.tur === "zum") { zumla(zum * (d.yon > 0 ? 1.4 : 1 / 1.4)); return kaydet(); }
      if (d.tur === "karakter") karaktereGit(d.id);
      return;
    }
    if (kaydiriyor || kaydirma) {
      const kaydi = kaydiriyor;
      kaydiriyor = false; kaydirma = null;
      if (kaydi) { basla = null; dunya.kamera = kameraX; dunya.kameraY = kameraY; kaydet(); return; }
    }
    const p = fare();
    const o = tutulan;
    tutulan = null;
    if (surukluyor && o) {
      surukluyor = false;
      o.hal = "dur";
      const d = kapiBul(p) || yerBul(p);
      if (d) return kapidanGec(o, d);
      if (!o.kr && karakteraBirak(o, p)) return;
      if (!o.kr) for (const n of noktalar) if (["ocak", "tezgah", "dolap"].includes(n.tur) && icinde(n, p) && yuzeyeKoy(o, n, p)) return;
      if (o.kr) {
        const n = noktaBul(p, OTURAK);
        if (n && !n.dolu) return otur(o, n);
        const kd = noktaBul(p, ["kaydirak"]);
        if (kd) return kaymayaBasla(o, kd);
      }
      const kv = noktaBul(p, ["kuvet"]);
      if (kv && o.kr && kuveteGir(o, kv)) return;
      if (kv && !o.kr) return suyaBirak(o, kv, p);
      if (o.h <= 0) { o.v.y = o.zemY; kaydet(); }
      return;
    }
    if (!basla) return;
    basla = null;
    // Dokunma
    if (o && o.kr) {
      sec(o);
      // Uyuyan karakter uyanır ve kalkar.
      if (o.oturak && o.oturak.tur === "yatak") { kalk(o); o.salla = k.time() + 1.6; kalpCikar(o); kaydet(); return; }
      // Salıncaktaki karakter itilir.
      if (o.oturak && o.oturak.tur === "salincak") { o.oturak.genlik = Math.min(34, o.oturak.genlik + 10); return; }
      // Elinde eşya varsa onunla oynar (yiyecekse yer), yoksa el sallar.
      const eldekiler = varliklar.filter((e) => e.elde === o && (e.yenir || e.eylemTur));
      const eldeki = eldekiler.find((e) => e.v.el !== "sol") || eldekiler[0];
      if (eldeki) return eylemYap(o, eldeki);
      o.salla = k.time() + 1.6;
      kalpCikar(o);
      if (o.evcil) SES.hav(); else SES.selam();
      if (o.kuvet) for (let i = 0; i < 8; i++) G.kopuk(o.v.x + k.rand(-60, 60), o.kuvet.kv.su);
      kaydet();
      return;
    }
    // Giyilen kıyafete dokununca karakter el sallar, parıltı çıkar.
    if (o && o.giyili) { SES.giy(); o.giyili.salla = k.time() + 1.2; for (let i = 0; i < 4; i++) G.parilti(o.kok.pos.x + k.rand(-30, 30), o.kok.pos.y - k.rand(0, 60)); return; }
    if (o && o.elde) return eylemYap(o.elde, o);
    // Ocaktaki tencereye dokunmak altındaki ocağı yakar ya da söndürür.
    if (o && o.yuzey) { o.salla = k.time() + 0.5; if (o.goz) acKapa(o.goz.ates, o.goz.anahtar, true); return; }
    if (o && o.yuzuyor) { SES.kopuk(); for (let i = 0; i < 4; i++) G.kopuk(o.v.x + k.rand(-20, 20), o.yuzuyor.su); return; }
    if (o) { o.vy = -700; o.h = Math.max(o.h, 1); SES.zipla(); return; } // eşya zıplar
    if (calisanUstunde(p)) { calisan.sira = (calisan.sira + 1) % calisan.sozler.length; return calisanKonus(calisan.sozler[calisan.sira]); }
    const bk = bitkiBul(p);
    if (bk) { SES.pop(); bk.salla = k.time() + 0.8; if (bk.hal >= 2) kucukKalp(k.vec2(bk.x, bk.y - bk.sp.height * bk.s)); return; }
    const ok = okBul(p);
    if (ok) return gec(ok.hedef);
    const n = noktaBul(p);
    if (n && (n.tur === "musluk" || n.tur === "fiskiye")) { n.akis.hidden = !n.akis.hidden; if (!n.akis.hidden) SES.su(); else SES.klik(); return; }
    if (n && n.tur === "dolap") return dolapAcKapa(n);
    if (n && (n.tur === "tv" || n.tur === "lamba")) return acKapa(n.isik, n.anahtar);
    if (n && n.tur === "ocak") { const g = n.gozler.slice().sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0]; return acKapa(g.ates, g.anahtar, true); }
    if (n && n.tur === "klozet" && !n.dolu) return sifon(n);
    if (n && n.tur === "salincak" && !n.dolu) { n.genlik = Math.min(30, n.genlik + 14); return; }
    const d = kapiBul(p) || yerBul(p);
    if (d) {
      const on = d.on ? k.vec2(d.on.x, d.on.y) : k.vec2(d.x + d.w / 2, z.ust + 20);
      if (secili && !secili.oturak) return yuru(secili, on, () => kapidanGec(secili, d));
      return gec(d.hedef);
    }
    if (secili && !secili.oturak && !secili.kuvet) yuru(secili, p);
  });

  // --- Her kare ---
  const kaybolacak = [];
  // Gelen karakter varsa çalışan selam verir. Tabela kaybolunca konuşur.
  if (calisan && varliklar.some((o) => o.kr)) k.wait(2, () => calisanKonus(calisan.selam));
  k.onUpdate(() => {
    const t = k.time(), dt = k.dt();
    // Salıncaklar: ip asma noktasında döner. Boş salıncak yavaşça durur.
    for (const n of noktalar) {
      if (n.tur !== "salincak") continue;
      n.genlik = n.dolu ? Math.max(14, n.genlik - dt * 3) : Math.max(0, n.genlik - dt * 6);
      n.aci = n.genlik * Math.sin(t * 2.6);
      n.kol.angle = n.aci;
    }
    // TV açıkken ekranın rengi değişir, top zıplar, notalar çıkar.
    const dansVar = tvAcik();
    SES.tvMuzik(dansVar);
    for (const n of noktalar) {
      if (n.tur === "tv" && !n.isik.hidden) {
        const r = (t * 0.6) % 1;
        n.isik.color = k.hsl2rgb(r, 0.7, 0.7);
        n.top.pos = k.vec2(14 + ((Math.sin(t * 2.3) + 1) / 2) * (n.ekran.w - 28), n.ekran.h - 14 - Math.abs(Math.sin(t * 5)) * (n.ekran.h - 28));
        n.nota = (n.nota || 0) - dt;
        if (n.nota <= 0) { n.nota = 0.6; G.nota(n.ekran.x + n.ekran.w + 10, n.ekran.y + 10, k.choose([[120, 90, 220], [240, 80, 120], [60, 170, 120]])); }
      }
      if (n.tur === "ocak") for (const g of n.gozler) if (!g.ates.hidden) g.ates.opacity = 0.8 + Math.sin(t * 17 + g.x) * 0.15;
    }
    for (const o of varliklar) {
      // Elde ve üstte duran eşyalar sahibinden sonra güncellenir.
      if (o.elde || o.giyili) continue;
      if (o.yuzey) { yuzeyGuncelle(o, t, dt); continue; }
      if (o.kuvet || o.yuzuyor) { kuvetGuncelle(o, t, dt); continue; }
      if (o.oturak) { oturakGuncelle(o, t, dt); continue; }
      if (o.kayiyor) { kaymaGuncelle(o, t); continue; }
      let hal = o === tutulan && surukluyor ? "tutuluyor" : "dur";
      // Evcil hayvan boş durunca kendi kendine bir yere yürür.
      if (o.evcil && o !== tutulan && !o.hedef && o.h === 0 && !dansVar) {
        if (o.gez == null) o.gez = t + k.rand(1.5, 4);
        else if (t > o.gez) {
          o.gez = null;
          const y = zemineSabitle(k.rand(z.ust, z.alt));
          o.hedef = k.vec2(xSabitle(o.v.x + k.rand(-320, 320), y), y);
          o.varinca = () => { if (k.rand() < 0.4) kalpCikar(o); };
        }
      }
      // Düşme
      if (o !== tutulan && (o.h > 0 || o.vy !== 0)) {
        o.vy += YERCEKIMI * dt;
        o.h -= o.vy * dt;
        if (o.h <= 0) {
          o.h = 0;
          // Yere çarpma sesi: hızlı düşen daha yüksek ses çıkarır. Cam eşya çok hızlı düşerse şıngırdar.
          if (o.vy > 250) SES.dus(Math.min(1, o.vy / 1600));
          if (!o.kr && o.vy > 1100 && VERI.esyalar[o.v.sablon].kirilir) { SES.kir(); G.kirinti(k.vec2(o.v.x, o.zemY), [220, 240, 255]); }
          // Eşya biraz zıplar, karakter yere basar
          o.vy = !o.kr && o.vy > 300 ? -o.vy * 0.35 : 0;
          if (o.vy === 0) { o.v.y = o.zemY; kaydet(); }
        }
        if (o.h > 0) hal = "tutuluyor";
      }
      // Yürüme
      if (o.hedef && o.h === 0 && o !== tutulan) {
        const fark = k.vec2(o.hedef.x - o.v.x, o.hedef.y - o.zemY), adim = 340 * dt * (harita ? 1.5 : 1);
        if (Math.abs(fark.x) > 2) o.yon = fark.x < 0 ? -1 : 1;
        if (fark.len() <= adim) {
          o.v.x = o.hedef.x; o.zemY = o.hedef.y; o.v.y = o.zemY; o.hedef = null;
          kaydet();
          if (o.varinca) { const f = o.varinca; o.varinca = null; f(); }
        } else {
          const a = fark.unit().scale(adim);
          o.v.x += a.x; o.zemY += a.y;
          hal = "yuru";
        }
      }
      // Atılan ya da sürülen eşya yatay kayar. Yerde sürtünme yavaşlatır, duvardan seker.
      if (o.vx && o !== tutulan) {
        o.v.x += o.vx * dt;
        const [sol, sag] = xSinir(o.zemY);
        if ((o.v.x < sol && o.vx < 0) || (o.v.x > sag && o.vx > 0)) o.vx = -o.vx * 0.6;
        if (o.h === 0) o.vx *= 1 - Math.min(1, dt * (o.eylemTur === "sur" ? 0.7 : 2.5));
        if (Math.abs(o.vx) < 8) { o.vx = 0; o.v.y = o.zemY; kaydet(); }
      }
      // Duvarın önüne düşen varlık zemine doğru kayar.
      if (o.h === 0 && o !== tutulan) {
        const x2 = xSabitle(o.v.x, o.zemY);
        if (Math.abs(x2 - o.v.x) > 0.5) o.v.x += (x2 - o.v.x) * Math.min(1, dt * 8);
      }
      if (hal === "dur" && t < o.mesgul) hal = "ye";
      if (hal === "dur" && t < o.salla) hal = "salla";
      // TV açıkken boşta duran karakter dans eder. Her bir iki saniyede başka bir hareket seçer.
      let dans = null;
      if (hal === "dur" && o.kr && dansVar) {
        if (!o.dans || t > o.dans.son) o.dans = { tur: k.choose(["zipla", "don", "kollar", "egil", "zipla"]), son: t + k.rand(1.2, 2.2) };
        dans = o.dans.tur;
        hal = dans === "kollar" || dans === "zipla" ? "dans" : "dans2";
        if (dans === "don") o.yon = Math.sin(t * 10) > 0 ? 1 : -1;
      }
      const s = olcek(o);
      let ziplama = hal === "yuru" ? Math.abs(Math.sin(t * 11)) * 10 * (m.olcek || 1) : 0;
      if (dans === "zipla") ziplama = Math.abs(Math.sin(t * 7)) * 40 * (m.olcek || 1);
      o.kok.pos = k.vec2(o.v.x, o.zemY - o.h - ziplama);
      o.kok.z = o === tutulan ? 5000 : o.zemY;
      const yukseklik = Math.min(o.h, 500);
      o.golge.hidden = false;
      o.golge.pos = k.vec2(o.v.x, o.zemY);
      o.golge.z = o.zemY - 0.5;
      const gs = (o.golgeEn / 50) * s * (1 - yukseklik / 900);
      o.golge.scale = k.vec2(gs, gs * 0.25);
      o.golge.opacity = 0.3 * (1 - yukseklik / 700);
      if (o.kr) {
        o.kok.angle = hal === "yuru" ? Math.sin(t * 11) * 3 : hal === "tutuluyor" ? Math.sin(t * 7) * 6 : dans === "egil" ? Math.sin(t * 6) * 14 : dans ? Math.sin(t * 6) * 5 : Math.sin(t * 1.6);
        const nefes = hal === "dur" ? Math.sin(t * 2.4) * 0.015 : hal === "ye" ? Math.abs(Math.sin(t * 14)) * 0.03 : 0;
        o.kok.scale = k.vec2(s * o.yon * (1 - nefes), s * (1 + nefes));
        K.canlandir(o.kr, t, hal);
      } else {
        o.kok.scale = k.vec2(s);
        o.kok.angle = hal === "tutuluyor" ? Math.sin(t * 8) * 10 : 0;
        // Raftan alınan eşya yerde kalırsa küçülür ve kaybolur. Elde, üstte ya da tezgahta duran kaybolmaz.
        if (o.v.gecici) {
          o.yerde = o !== tutulan && o.h === 0 && !o.vx ? (o.yerde || 0) + dt : 0;
          if (o.yerde > KAYBOLMA - 0.5) o.kok.scale = k.vec2(s * Math.max(0, (KAYBOLMA - o.yerde) / 0.5));
          if (o.yerde > KAYBOLMA) kaybolacak.push(o);
        }
      }
    }
    kaybolacak.splice(0).forEach((o) => {
      for (let i = 0; i < 4; i++) G.parilti(o.v.x + k.rand(-25, 25), o.zemY - k.rand(0, 40), [255, 255, 255]);
      SES.puf();
      kaldir(o);
      dunya.varliklar.splice(dunya.varliklar.indexOf(o.v), 1);
      kaydet();
    });
    // Bitkiler hafifçe sallanır. Sulanınca ya da dokununca daha çok sallanır.
    for (const b of bitkiler) b.sp.angle = t < b.salla ? Math.sin(t * 20) * 8 : Math.sin(t * 1.5 + b.x) * 2;
    // Çalışan nefes alır. Konuşurken ağzı açılıp kapanır, balon süre bitince kaybolur.
    if (calisan) {
      const c = calisan, konusuyor = t < c.konusma;
      c.sp.scale = k.vec2(1, 1 + Math.sin(t * 2.4) * 0.012 + (konusuyor ? Math.abs(Math.sin(t * 9)) * 0.01 : 0));
      const agiz = konusuyor && Math.floor(t * 6) % 2 === 0;
      if (agiz !== c.agiz) { c.agiz = agiz; c.sp.use(k.sprite("calisan-" + c.meslek + (agiz ? "-konus" : ""), { height: c.boy })); }
      if (c.balon && t > c.bitis) { c.balon.destroy(); c.balon = null; }
    }
    for (const o of varliklar) {
      if (o.elde) eldeGuncelle(o);
      else if (o.giyili) giyiliGuncelle(o);
    }
    // Tezgahta ya da ocakta duran eşya: rafta duran eşya kadar küçük görünür. Yanan ocaktaki tencereden buhar çıkar.
    function yuzeyGuncelle(o, t, dt) {
      const s = derinlik(z.ust);
      o.kok.pos = k.vec2(o.v.x, o.yuzeyY);
      o.kok.scale = k.vec2(s);
      o.kok.angle = t < o.salla ? Math.sin(t * 30) * 10 : 0;
      o.kok.z = -86;
      o.golge.hidden = true;
      o.kok.hidden = !!(o.yuzey.acik && o.yuzey.acik.hidden);
      if (o.goz && !o.goz.ates.hidden) {
        o.buhar = (o.buhar || 0) - dt;
        if (o.buhar <= 0) { o.buhar = 0.2; G.kopuk(o.v.x + k.rand(-15, 15), o.yuzeyY - o.boy * s, -85, k.rand(4, 8)); }
      }
    }
    // Giyilen kıyafet karakterle birlikte durur, döner ve küçülür. Yeri karakterin giyim verisinden gelir.
    // govde: [x, omuz çizgisi, en]. Kıyafetin üstü omuza değer. alt: [x, bel çizgisi, en]. Pantolonun üstü bele değer. bas: [x, başın tepesi, en]. Şapka tepeye oturur.
    function giyiliGuncelle(o) {
      const sahip = o.giyili, kr = sahip.kr, yer = VERI.esyalar[o.v.sablon].giy;
      const g = { govde: [0, 0.63, 0.46], alt: [0, 0.42, 0.4], bas: [0, 0.9, 0.42], ...(VERI.karakterler[sahip.v.sablon].giyim || {}) }[yer];
      const sx = (g[2] * kr.genislik * sahip.kok.scale.x) / o.en;
      const sy = Math.abs(sx) * Math.abs(sahip.kok.scale.y / sahip.kok.scale.x);
      const alt = yer !== "bas" ? g[1] - (o.boy * sy) / (kr.yukseklik * Math.abs(sahip.kok.scale.y)) : g[1];
      o.kok.pos = K.yer(kr, g[0], alt);
      o.kok.scale = k.vec2(sx, sy);
      o.kok.angle = sahip.kok.angle;
      o.kok.z = sahip.kok.z + 0.4;
      o.zemY = sahip.zemY; o.v.x = sahip.v.x; o.v.y = sahip.v.y; o.h = 0;
      o.golge.hidden = true;
      // Karakterin kıyafet bölgesi varsa kıyafet görünmez, karakterin kendi kıyafeti bu renge boyanır.
      const e = VERI.esyalar[o.v.sablon], boyar = e.boya && e.boya.some((b) => kr.kiyafet[b]);
      o.kok.hidden = !!boyar;
      if (boyar) e.boya.forEach((b) => K.boya(kr, b, e.renk));
    }
    // Elde duran eşya elin ucunda durur. Yenirken ağza gider ve her ısırıkta küçülür.
    function eldeGuncelle(o) {
      const sahip = o.elde, s = derinlik(sahip.zemY) * (1 - o.isirik * 0.25);
      let yer = o.yeniyor ? K.agizYeri(sahip.kr) : K.elYeri(sahip.kr, o.v.el), aci = 0, olc = 1;
      if (o.eylem) ({ yer, aci, olc } = eylemKaresi(o, sahip, s));
      // İpli eşya (balon) ipin ucundan tutulur: resmin altı eldedir.
      const ipli = VERI.esyalar[o.v.sablon].ipli && !o.eylem;
      o.kok.pos = k.vec2(yer.x, yer.y + (ipli ? 0 : (o.boy * s * olc) / 2));
      o.kok.scale = k.vec2(s * olc);
      o.kok.angle = aci;
      o.kok.z = sahip.kok.z + 0.5;
      o.zemY = sahip.zemY; o.v.x = sahip.v.x; o.v.y = sahip.v.y; o.h = 0;
      o.golge.hidden = true;
    }
    // Eylemin bu karedeki hali: eşyanın yeri, açısı ve ölçeği. Köpük, damla, nota ve çizgi de burada çıkar.
    function eylemKaresi(o, sahip, s) {
      const e = o.eylem, t = k.time() - e.t0, cs = olcek(sahip);
      const gen = sahip.kr.genislik * cs, boyu = sahip.kr.yukseklik * cs, yon = sahip.yon;
      const agiz = K.agizYeri(sahip.kr), on = sahip.kok.z + 1;
      e.sayac -= k.dt();
      const sira = (aralik) => { if (e.sayac > 0) return false; e.sayac = aralik; return true; };
      switch (e.tur) {
        case "fircala":
          if (sira(0.1)) G.kopuk(agiz.x + k.rand(-12, 12), agiz.y + k.rand(-6, 6), on, k.rand(3, 6));
          // Fırçanın başı sağ uçtadır: baş ağza gelsin diye eşya sola kayar.
          return { yer: agiz.add(Math.sin(t * 28) * gen * 0.07 - o.en * s * 0.4, 4), aci: 0, olc: 1 };
        case "ic": {
          const es = VERI.esyalar[o.v.sablon];
          if (sira(0.3)) G.kirinti(agiz, es.damla || [120, 180, 240]);
          // Sıcak içecekten buhar çıkar.
          if (es.buhar && Math.random() < 0.15) G.kopuk(agiz.x + yon * gen * 0.1 + k.rand(-6, 6), agiz.y - o.boy * s * 0.6, on, k.rand(3, 6));
          return { yer: agiz.add(yon * gen * 0.08, 0), aci: -35 * yon, olc: 1 };
        }
        case "olc": {
          // Termometre ağızda durur. Kırmızı ucu ağızdadır, ucundan parıltı çıkar.
          if (t > 1.2 && sira(0.3)) G.parilti(agiz.x + yon * o.en * s * 0.8, agiz.y - 10, [240, 80, 80]);
          return { yer: agiz.add(yon * o.en * s * 0.42, 0), aci: 0, olc: 1 };
        }
        case "yapistir": {
          // Yara bandı yanağa gider ve bastırılır.
          const yanak = agiz.add(-yon * gen * 0.12, -boyu * 0.04);
          return { yer: yanak, aci: 15 * yon, olc: 1 + 0.15 * Math.max(0, 1 - t * 2) };
        }
        case "kes": {
          // Makas başın yanında açılıp kapanır, saç kırpıntıları düşer.
          const bas = agiz.add(0, -boyu * 0.2);
          if (sira(0.18)) { G.kirinti(bas.add(yon * gen * 0.25, 0), [120, 80, 50]); SES.klik(); }
          return { yer: bas.add(yon * gen * 0.32 + Math.sin(t * 3) * gen * 0.12, 0), aci: -20 * yon, olc: 1 - 0.15 * Math.abs(Math.sin(t * 18)) };
        }
        case "bak": {
          // Ayna yüzün önünde tutulur, parlar.
          const on2 = agiz.add(yon * gen * 0.32, -boyu * 0.02);
          if (sira(0.25)) G.parilti(on2.x + k.rand(-20, 20), on2.y - k.rand(10, 50), [255, 255, 255]);
          if (t > 1 && Math.random() < 0.02) kucukKalp(agiz.add(0, -boyu * 0.2));
          return { yer: on2, aci: -8 * yon, olc: 1.1 };
        }
        case "ucur": {
          // Uçurtma yükselir, havada sallanır, sonunda ele iner.
          const el = K.elYeri(sahip.kr, o.v.el), sure = EYLEM_SURE.ucur;
          const yuk = Math.min(1, t / 0.8, (sure - t) / 0.6);
          return { yer: el.add(yon * gen * (0.4 + 0.5 * yuk) + Math.sin(t * 1.7) * 30 * yuk, -boyu * 0.9 * yuk + Math.sin(t * 2.6) * 14 * yuk), aci: Math.sin(t * 2.2) * 14, olc: 1 };
        }
        case "birak": {
          // Balon ipiyle yükselir, sonra yavaşça ele geri iner.
          const el = K.elYeri(sahip.kr, o.v.el), f = Math.sin(Math.min(1, t / EYLEM_SURE.birak) * Math.PI);
          return { yer: el.add(Math.sin(t * 2) * 25 * f, -boyu * 0.75 * f - o.boy * s * 0.5), aci: Math.sin(t * 3) * 8, olc: 1 };
        }
        case "saril": {
          // Ayı göğse bastırılır, kalpler çıkar.
          const gogus = sahip.kok.pos.add(yon * gen * 0.08, -boyu * 0.42);
          if (sira(0.45)) kucukKalp(gogus.add(k.rand(-gen * 0.2, gen * 0.2), -boyu * 0.3));
          return { yer: gogus, aci: Math.sin(t * 5) * 6, olc: 1 + Math.abs(Math.sin(t * 5)) * 0.06 };
        }
        case "ufle": {
          // Pasta ağzın önünde durur. Ağızdan mumlara rüzgar gider.
          const pasta = agiz.add(yon * gen * 0.3, boyu * 0.12);
          if (sira(0.07)) G.kopuk(agiz.x + yon * (gen * 0.08 + k.rand(0, gen * 0.2)), agiz.y + k.rand(-4, 8), on, k.rand(2, 4));
          return { yer: pasta, aci: 0, olc: 1 };
        }
        case "oku":
          return { yer: agiz.add(0, boyu * 0.14), aci: Math.sin(t * 2) * 4, olc: 1.3 };
        case "konus":
          if (sira(0.45)) G.nota(agiz.x + yon * gen * 0.35, agiz.y - boyu * 0.15);
          return { yer: agiz.add(yon * gen * 0.22, -boyu * 0.04), aci: 15 * yon, olc: 1 };
        case "yaz": {
          const kg = e.kagit.pos, uc = kg.add(-30 + ((t * 40) % 60), -18 + Math.floor((t * 40) / 60) * 18 + Math.sin(t * 30) * 4);
          if (uc.y < kg.y + 30 && sira(0.03)) e.kagit.add([k.circle(2.5), k.pos(uc.sub(kg)), k.anchor("center"), k.color(140, 90, 220)]);
          // Kalemin ucu sağ uçtadır: ucu kağıda değsin diye eşya sola kaydırılır.
          return { yer: uc.add((-o.en * s) / 2, (-o.boy * s) / 2), aci: -25, olc: 1 };
        }
        case "yika": {
          const govde = sahip.kok.pos.add(0, -boyu * 0.45);
          if (sira(0.08)) G.kopuk(govde.x + k.rand(-gen * 0.3, gen * 0.3), govde.y + k.rand(-boyu * 0.3, boyu * 0.3), on);
          return { yer: govde.add(Math.cos(t * 6) * gen * 0.22, Math.sin(t * 6) * boyu * 0.15), aci: Math.sin(t * 6) * 15, olc: 1 };
        }
        case "kurula":
          if (sira(0.15)) G.kirinti(agiz.add(0, -boyu * 0.2), [120, 180, 240]);
          return { yer: agiz.add(Math.sin(t * 14) * gen * 0.2, -boyu * 0.24), aci: Math.sin(t * 14) * 10, olc: 1 };
        case "sik":
          if (sira(0.35)) G.nota(o.kok.pos.x, o.kok.pos.y - 40, [250, 190, 40]);
          return { yer: K.elYeri(sahip.kr, o.v.el), aci: 0, olc: 1 - 0.25 * Math.abs(Math.sin(t * 10)) };
        case "dinle": {
          // Steteskop göğüste gezer, kalp atışı küçük kalpler olarak çıkar.
          const gogus = sahip.kok.pos.add(yon * gen * 0.05, -boyu * 0.5);
          if (sira(0.5)) kucukKalp(gogus.add(yon * gen * 0.3, -boyu * 0.1));
          return { yer: gogus.add(Math.sin(t * 3) * gen * 0.12, Math.cos(t * 2) * boyu * 0.06), aci: 0, olc: 1 };
        }
        case "tara": {
          // Tarak başın üstünde ileri geri gider, saçtan parıltı çıkar.
          const bas = agiz.add(0, -boyu * 0.2);
          if (sira(0.2)) G.parilti(bas.x + k.rand(-gen * 0.3, gen * 0.3), bas.y + k.rand(-10, 10));
          return { yer: bas.add(Math.sin(t * 8) * gen * 0.2, 0), aci: Math.sin(t * 8) * 8, olc: 1 };
        }
        case "kurut": {
          // Fön başın yanında durur, ağzı başa bakar. Sıcak hava küçük baloncuklarla gösterilir.
          const bas = agiz.add(0, -boyu * 0.12), fon = bas.add(-gen * 0.5, Math.sin(t * 5) * 6);
          if (sira(0.06)) G.kopuk(fon.x + o.en * s * 0.5, fon.y + k.rand(-8, 8), on, k.rand(2, 4));
          if (sira(0.3)) G.parilti(bas.x + k.rand(-gen * 0.2, gen * 0.2), bas.y - 10, [255, 255, 255]);
          return { yer: fon, aci: 0, olc: 1 };
        }
        case "sula": {
          // Sulama kabı öne eğilir, ağzından damlalar düşer.
          const el = K.elYeri(sahip.kr, o.v.el).add(yon * gen * 0.2, 0);
          if (sira(0.08)) G.kirinti(el.add(o.en * s * 0.45, -o.boy * s * 0.2), [120, 190, 250]);
          return { yer: el, aci: 25 + Math.sin(t * 3) * 5, olc: 1 };
        }
        case "kaz": {
          // Kova sallanır, içinden kum dökülür.
          const el = K.elYeri(sahip.kr, o.v.el);
          if (sira(0.15)) G.kirinti(el.add(0, -o.boy * s * 0.4), [240, 210, 150]);
          return { yer: el, aci: Math.sin(t * 6) * 20, olc: 1 };
        }
        case "kokla": {
          // Çiçek buruna gelir, kalpler çıkar.
          const burun = agiz.add(yon * gen * 0.12, -boyu * 0.02);
          if (sira(0.5)) kucukKalp(burun.add(yon * gen * 0.2, -boyu * 0.15));
          return { yer: burun, aci: -10 * yon, olc: 1 };
        }
        case "karistir": {
          // Tencere önde tutulur, sallanır, içinden buhar çıkar.
          const el = K.elYeri(sahip.kr, o.v.el).add(yon * gen * 0.1, 0);
          if (sira(0.15)) G.kopuk(el.x + k.rand(-10, 10), el.y - o.boy * s, on, k.rand(4, 8));
          return { yer: el, aci: Math.sin(t * 9) * 12, olc: 1 };
        }
        case "kumanda":
          return { yer: K.elYeri(sahip.kr, o.v.el), aci: -30 * yon, olc: 1 };
      }
      return { yer: K.elYeri(sahip.kr, o.v.el), aci: 0, olc: 1 };
    }
    // Oturan karakter biraz basık durur. Klozette hafifçe titrer, beli sansürle örtülür.
    // Yataktaki karakter uzanır ve uyur. Salıncaktaki ip ile birlikte sallanır.
    function oturakGuncelle(o, t, dt) {
      const n = o.oturak, s = olcek(o);
      // Klozette 10 saniye oturan karakter kendi kalkar, sifon çekilir.
      if (n.tur === "klozet" && t - o.oturT > 10) { kalk(o); kalpCikar(o); kaydet(); return; }
      o.golge.hidden = true;
      o.kok.z = -84;
      if (n.tur === "yatak") {
        // Boyu yatağa sığar: ayaklar yatis noktasında, baş yastıkta. Yandan bakılınca ince görünür.
        const sy = n.uzunluk / o.kr.yukseklik;
        o.kok.pos = k.vec2(n.yatis.x, n.yatis.y);
        o.kok.angle = 90 * (n.yon || 1); // yon -1: yastık solda
        o.kok.scale = k.vec2(sy * 0.55 * (1 + Math.sin(t * 1.8) * 0.03), sy);
        K.canlandir(o.kr, t, "uyu");
        o.uyku -= dt;
        if (o.uyku <= 0) { o.uyku = 1.1; G.zzz(n.yatis.x + (n.yon || 1) * n.uzunluk * 0.95, n.yatis.y - 60); }
        return;
      }
      const bas = 0.85;
      if (n.tur === "salincak") {
        const r = (n.aci * Math.PI) / 180;
        o.kok.pos = k.vec2(n.asma.x - n.ip * Math.sin(r), n.asma.y + n.ip * Math.cos(r) + 6);
        o.kok.angle = n.aci;
      } else {
        o.kok.pos = k.vec2(n.oturma.x, n.oturma.y);
        o.kok.angle = n.tur === "klozet" ? Math.sin(t * 22) * 1.2 : 0;
      }
      o.kok.scale = k.vec2(s * o.yon, s * bas);
      K.canlandir(o.kr, t, t < o.salla ? "salla" : "dur");
      if (o.sansur) {
        const boyu = o.kr.yukseklik * s * bas, gen = o.kr.genislik * s;
        o.sansur.ayarla(n.oturma.x, n.oturma.y - boyu * 0.3, gen * 0.6, boyu * 0.24, -83);
      }
    }
    // Kaydırakta: hızlanarak iner, sonunda yere atlar ve biraz kayar.
    function kaymaGuncelle(o, t) {
      const { n, t0 } = o.kayiyor, u = Math.min(1, ((t - t0) / 1.1) ** 2), s = olcek(o);
      o.golge.hidden = true;
      o.kok.pos = k.vec2(n.ust.x + (n.alt.x - n.ust.x) * u, n.ust.y + (n.alt.y - n.ust.y) * u);
      o.kok.angle = -12;
      o.kok.scale = k.vec2(s * o.yon, s * 0.85);
      o.kok.z = n.alt.y;
      K.canlandir(o.kr, t, "salla");
      if (u < 1) return;
      o.kayiyor = null;
      o.kok.angle = 0;
      o.zemY = zemineSabitle(n.alt.y + 30); o.v.x = n.alt.x; o.v.y = o.zemY; o.h = 0;
      o.vx = 260 * Math.sign(n.alt.x - n.ust.x);
      kalpCikar(o);
      kaydet();
    }
    // Küvetteki karakter yavaşça sallanır, çevresinden köpük çıkar. Eşya suyun üstünde yüzer.
    function kuvetGuncelle(o, t, dt) {
      const s = olcek(o);
      o.golge.hidden = true;
      if (o.yuzuyor) {
        o.kok.pos = k.vec2(o.v.x, o.yuzuyor.su + 8 + Math.sin(t * 2 + o.v.x) * 3);
        o.kok.scale = k.vec2(s); o.kok.angle = Math.sin(t * 1.7 + o.v.x) * 6; o.kok.z = -78;
        return;
      }
      const { kv, yer } = o.kuvet;
      o.v.x = yer.x;
      // Küçük karakter (köpek) suya batmasın: boyunun yarısı suyun üstünde kalır, dokunup çıkarılabilir.
      const dip = Math.min(kv.dip, kv.su + o.kr.yukseklik * s * 0.5);
      o.kok.pos = k.vec2(yer.x, dip + Math.sin(t * 2 + yer.x) * 3);
      // Evcil hayvan biraz yıkanınca kendi çıkar, silkinir.
      if (o.evcil && o !== tutulan && t - o.kuvetT > 8) {
        kuvettenCik(o);
        o.v.x = Math.max(xSinir(z.ust + 60)[0], kv.x - 40); o.zemY = z.ust + 60; o.h = 120; o.vy = -500;
        for (let i = 0; i < 10; i++) G.kirinti(o.kok.pos.add(k.rand(-30, 30), -20), [120, 180, 240]);
        kaydet();
        return;
      }
      o.kok.z = -85;
      o.kok.angle = Math.sin(t * 1.5 + yer.x) * 3;
      o.kok.scale = k.vec2(s * o.yon, s);
      K.canlandir(o.kr, t, t < o.salla ? "salla" : "dur");
      o.kopukSayac = (o.kopukSayac || 0) - dt;
      if (o.kopukSayac <= 0) { o.kopukSayac = 0.18; G.kopuk(yer.x + k.rand(-65, 65), kv.su + k.rand(-4, 4)); }
    }
    // Seçili karakterin simgesi sarı halkayla belli olur.
    for (const p of portreler) p.halka.hidden = p.id !== dunya.secili;
    // Seçili karakterin üstündeki ok
    isaret.hidden = !secili;
    if (secili) {
      const s = olcek(secili);
      const yatiyor = secili.oturak && secili.oturak.tur === "yatak";
      const ust = yatiyor ? secili.kok.pos.y - 60 : secili.kok.pos.y - secili.kr.yukseklik * s * (secili.oturak || secili.kayiyor ? 0.85 : 1);
      const x = yatiyor ? secili.kok.pos.x + (secili.oturak.yon || 1) * secili.oturak.uzunluk * 0.5 : secili.kok.pos.x;
      isaret.pos = k.vec2(x, ust - 18 + Math.sin(t * 4) * 5);
      isaret.scale = k.vec2(harita ? 0.8 : 1);
    }
    // Kamera: okla ya da kenara sürüklenen varlıkla kayar, yürüyen seçili karakteri izler.
    if (kayar) {
      if (panYon) { kameraX += panYon * 900 * dt; takip = false; }
      else if (tutulan && surukluyor) {
        const e = ekran();
        if (e.x < 110) kameraX -= 700 * dt;
        else if (e.x > EKRAN_W - 110) kameraX += 700 * dt;
        if (e.y < 90) kameraY -= 500 * dt;
        else if (e.y > EKRAN_H - 90) kameraY += 500 * dt;
      } else if (takip && secili && varliklar.includes(secili)) {
        kameraX += (secili.v.x - kameraX) * Math.min(1, dt * 3);
        kameraY += (secili.zemY - 120 - kameraY) * Math.min(1, dt * 3);
      }
      const once = kameraX;
      kameraSinirla();
      if (once !== kameraX) panYon = 0;
      k.setCamPos(kameraX, kameraY);
      k.setCamScale(zum);
      if (tutulan && surukluyor) tasi();
      dunya.kamera = kameraX;
      dunya.kameraY = kameraY;
      for (const d of dugmeler) if (d.tur === "kaydir") d.o.hidden = d.yon < 0 ? kameraX <= EKRAN_W / 2 + 1 : kameraX >= genis - EKRAN_W / 2 - 1;
    }
  });
});

k.onLoad(() => mekanYukle(dunya.mekan).then(() => k.go("mekan", dunya.mekan)));
