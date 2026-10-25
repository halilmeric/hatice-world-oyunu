// Dünyanın tüm içeriği burada durur.
// Yeni çizim, eşya ya da mekan eklemek için sadece bu dosya değişir.
// Resimler araclar/uret.py, araclar/dunya.py ve araclar/yerler.py ile üretilir.

// Odaların ortak perspektif çizgileri (araclar/uret.py ile aynı sayılar).
const ZEMIN = {
  ust: 480, alt: 690, sol: 30, sag: 1250,
  ufuk: { x: 640, y: 120 }, arka: { sol: 200, sag: 1080, y: 440 },
};
// Açık hava: çim her yere uzanır, zemin daralmaz.
const ZEMIN_ACIK = { ust: 480, alt: 690, sol: 60, sag: 1220 };
// Oda kapıları yan duvardadır. Dokunma alanı kapının resmini kapsar.
const KAPI_SOL = { x: 30, y: 185, w: 135, h: 380 };
const KAPI_SAG = { x: 1115, y: 185, w: 135, h: 380 };
// Bahçe ve parkta: soldaki ev duvarının kapısı, iki yandaki bahçe kapıları (araclar/yerler.py).
const EV_ARKA_KAPI = { x: 40, y: 290, w: 120, h: 285 };
const BAHCE_KAPI_SAG = { x: 1110, y: 360, w: 140, h: 210 };
const BAHCE_KAPI_SOL = { x: 30, y: 360, w: 140, h: 210 };
// Haritadan bir mekana girince karakterin durduğu yer.
const GIRIS_SOL = { x: 270, y: 590 };
const GIRIS_SAG = { x: 1010, y: 590 };

// Sandalye: araclar/yerler.py sandalye(x, alt) ile aynı sayılar. Karakter üstüne bırakılınca oturur.
const sandalye = (x, alt) => ({ tur: "otur", x: x - 50, y: alt - 150, w: 100, h: 150, oturma: { x, y: alt - 6 } });

window.OYUN_VERI = {
  // Şablonlar: bir çizim bir kez tanımlanır, dünyada birçok kez kullanılır.
  // Yeni karakter eklemek için: şeffaf PNG koy, buraya bir satır ekle. Ayrıntı: KARAKTER-EKLEME.md
  karakterler: {
    // resim: hacimli PNG. parcalar: araclar/parcala.py çıktısı (yoksa karakter tek parça oynar).
    // boy: ekranın önündeki piksel boyu. agiz: ağzın yüksekliği (0 ayak, 1 baş). Verilmezse 0.74.
    // kiyafet: karakterin kendi kıyafetinin bölgeleri (araclar/kiyafet.py üretir). Her bölgede parça adı ve katman resmi.
    // Tişört ya da elbise giyince bu bölgeler kıyafetin rengine boyanır. Bölgesi olmayan karakter kıyafeti üstüne giyer.
    kedi: {
      resim: "cizimler/hacimli/kedi.png", parcalar: "kedi", boy: 300, giyim: { govde: [0, 0.54, 0.4] },
      kiyafet: {
        ust: { "govde": "cizimler/kedi/govde-ust.png", "kol-sol": "cizimler/kedi/kol-sol-ust.png", "kol-sag": "cizimler/kedi/kol-sag-ust.png" },
        alt: { "govde": "cizimler/kedi/govde-alt.png", "bacak-sol": "cizimler/kedi/bacak-sol-alt.png", "bacak-sag": "cizimler/kedi/bacak-sag-alt.png" },
      },
    },
    kiz: {
      resim: "cizimler/hacimli/kiz.png", parcalar: "kiz", boy: 360,
      kiyafet: {
        ust: { "govde": "cizimler/kiz/govde-ust.png" },
        alt: { "govde": "cizimler/kiz/govde-alt.png", "bacak-sol": "cizimler/kiz/bacak-sol-alt.png", "bacak-sag": "cizimler/kiz/bacak-sag-alt.png" },
      },
    },
    ayi: { resim: "cizimler/hacimli/ayi.png", boy: 310 },
    // Evcil hayvan: kendi kendine gezer. Tek eli ağzıdır.
    // agizX ve el: ağzın ve elin yeri (genişliğin ve yüksekliğin oranı). portre: simgede görünen parça.
    // giyim: kıyafetin yeri. [x, alt kenar, en] oranları. Verilmezse insan boyuna göre durur.
    kopek: {
      resim: "cizimler/hacimli/kopek.png", boy: 150, evcil: true, eller: 1,
      agiz: 0.5, agizX: 0.42, el: [0.42, 0.5], portre: [0.5, 0, 0.5, 0.6],
      giyim: { govde: [-0.1, 0.62, 0.5], alt: [-0.1, 0.45, 0.5], bas: [0.2, 0.86, 0.36] },
    },
    // ses: dokununca çıkan ses. Köpek havlar (varsayılan), kedi mırlar.
    pisi: {
      resim: "cizimler/hacimli/pisi.png", boy: 120, evcil: true, eller: 1, ses: "mir",
      agiz: 0.5, agizX: 0.37, el: [0.37, 0.5], portre: [0.55, 0, 0.45, 0.62],
      giyim: { govde: [-0.1, 0.66, 0.5], alt: [-0.1, 0.48, 0.5], bas: [0.27, 0.92, 0.32] },
    },
  },
  esyalar: {
    // resim: eşyanın PNG dosyası. boy: ekranın önündeki piksel boyu.
    // yenir: karakterin ağzına götürülünce yenir. Değer kırıntının rengidir.
    // eylem: elinde tutan karaktere dokununca yaptığı hareket.
    //   at: fırlatır. sur: yerde sürer. Diğerleri elde oynanır:
    //   konus, oku, ic, fircala, yaz, yika, kurula, sik, dinle, tara, kurut, sula, kaz, kokla, karistir, kumanda,
    //   olc, yapistir, kes, bak, ucur, birak, saril, ufle.
    // damla: içerken ağızdan düşen damlanın rengi. buhar: içerken buhar çıkar. ipli: elde ipinin ucundan tutulur.
    // sonra: eylem bitince eşya bu eşyaya dönüşür (mumu sönen pasta).
    // ciz: tahtaya sürtülünce bu renkte çizer (tebeşir). sil: tahtadaki çizgiyi siler.
    // sepet: içine eşya konur, eşyalar sepetle taşınır.
    // mama: evcil hayvan gelip yer, kap "sonra" eşyasına döner. bos: boş kap. Mama dökülünce bu eşyaya döner.
    //   giy: karakter üstüne giyer. giy değeri yeridir: govde, alt (pantolon) ya da bas.
    // ocak: ocağın gözüne konabilir. kirilir: hızlı düşünce cam sesi çıkarır.
    top: { resim: "cizimler/esya/top.png", boy: 74, eylem: "at" },
    telefon: { resim: "cizimler/esya/telefon.png", boy: 62, eylem: "konus" },
    kitap: { resim: "cizimler/esya/kitap.png", boy: 58, eylem: "oku" },
    tahin: { resim: "cizimler/esya/tahin.png", boy: 70, yenir: [200, 160, 90] },
    elma: { resim: "cizimler/esya/elma.png", boy: 50, yenir: [235, 225, 180] },
    sut: { resim: "cizimler/esya/sut.png", boy: 84, yenir: [250, 250, 255] },
    kupa: { resim: "cizimler/esya/kupa.png", boy: 48, eylem: "ic", kirilir: true },
    ordek: { resim: "cizimler/esya/ordek.png", boy: 60, eylem: "sik" },
    sabun: { resim: "cizimler/esya/sabun.png", boy: 34, eylem: "yika" },
    sampuan: { resim: "cizimler/esya/sampuan.png", boy: 82, eylem: "yika" },
    muz: { resim: "cizimler/esya/muz.png", boy: 34, yenir: [250, 235, 170] },
    havuc: { resim: "cizimler/esya/havuc.png", boy: 70, yenir: [245, 150, 60] },
    ekmek: { resim: "cizimler/esya/ekmek.png", boy: 50, yenir: [225, 175, 110] },
    peynir: { resim: "cizimler/esya/peynir.png", boy: 42, yenir: [255, 220, 110] },
    cilek: { resim: "cizimler/esya/cilek.png", boy: 40, yenir: [230, 60, 80] },
    karpuz: { resim: "cizimler/esya/karpuz.png", boy: 46, yenir: [245, 90, 100] },
    kurabiye: { resim: "cizimler/esya/kurabiye.png", boy: 42, yenir: [215, 165, 95] },
    dondurma: { resim: "cizimler/esya/dondurma.png", boy: 74, yenir: [250, 190, 210] },
    portakal: { resim: "cizimler/esya/portakal.png", boy: 48, yenir: [250, 170, 60] },
    "portakal-suyu": { resim: "cizimler/esya/portakal-suyu.png", boy: 76, yenir: [255, 190, 60] },
    pasta: { resim: "cizimler/esya/pasta.png", boy: 64, yenir: [255, 225, 235] },
    araba: { resim: "cizimler/esya/araba.png", boy: 60, eylem: "sur" },
    kup: { resim: "cizimler/esya/kup.png", boy: 54, eylem: "at" },
    boya: { resim: "cizimler/esya/boya.png", boy: 22, eylem: "yaz" },
    "dis-fircasi": { resim: "cizimler/esya/dis-fircasi.png", boy: 26, eylem: "fircala" },
    "dis-macunu": { resim: "cizimler/esya/dis-macunu.png", boy: 28, eylem: "fircala" },
    havlu: { resim: "cizimler/esya/havlu.png", boy: 44, eylem: "kurula" },
    stetoskop: { resim: "cizimler/esya/stetoskop.png", boy: 70, eylem: "dinle" },
    tarak: { resim: "cizimler/esya/tarak.png", boy: 24, eylem: "tara" },
    fon: { resim: "cizimler/esya/fon.png", boy: 56, eylem: "kurut" },
    "sulama-kabi": { resim: "cizimler/esya/sulama-kabi.png", boy: 56, eylem: "sula" },
    kova: { resim: "cizimler/esya/kova.png", boy: 52, eylem: "kaz" },
    cicek: { resim: "cizimler/esya/cicek.png", boy: 70, eylem: "kokla" },
    tencere: { resim: "cizimler/esya/tencere.png", boy: 60, eylem: "karistir", ocak: true },
    "tencere-gri": { resim: "cizimler/esya/tencere-gri.png", boy: 60, eylem: "karistir", ocak: true },
    tava: { resim: "cizimler/esya/tava.png", boy: 34, eylem: "karistir", ocak: true },
    bardak: { resim: "cizimler/esya/bardak.png", boy: 50, eylem: "ic", kirilir: true },
    kumanda: { resim: "cizimler/esya/kumanda.png", boy: 50, eylem: "kumanda" },
    termometre: { resim: "cizimler/esya/termometre.png", boy: 16, eylem: "olc" },
    "yara-bandi": { resim: "cizimler/esya/yara-bandi.png", boy: 20, eylem: "yapistir" },
    surup: { resim: "cizimler/esya/surup.png", boy: 60, eylem: "ic", damla: [230, 90, 120] },
    makas: { resim: "cizimler/esya/makas.png", boy: 36, eylem: "kes" },
    ayna: { resim: "cizimler/esya/ayna.png", boy: 66, eylem: "bak" },
    ucurtma: { resim: "cizimler/esya/ucurtma.png", boy: 84, eylem: "ucur" },
    balon: { resim: "cizimler/esya/balon.png", boy: 120, eylem: "birak", ipli: true },
    ayi: { resim: "cizimler/esya/ayi.png", boy: 76, eylem: "saril" },
    tren: { resim: "cizimler/esya/tren.png", boy: 46, eylem: "sur" },
    cay: { resim: "cizimler/esya/cay.png", boy: 46, eylem: "ic", damla: [190, 70, 40], buhar: true },
    "sicak-cikolata": { resim: "cizimler/esya/sicak-cikolata.png", boy: 48, eylem: "ic", damla: [120, 70, 40], buhar: true },
    "dogum-gunu-pastasi": { resim: "cizimler/esya/dogum-gunu-pastasi.png", boy: 78, eylem: "ufle", sonra: "dogum-gunu-pastasi-sonuk" },
    "dogum-gunu-pastasi-sonuk": { resim: "cizimler/esya/dogum-gunu-pastasi-sonuk.png", boy: 68, yenir: [255, 225, 235] },
    tebesir: { resim: "cizimler/esya/tebesir.png", boy: 12, eylem: "yaz", ciz: [250, 250, 245] },
    "tebesir-pembe": { resim: "cizimler/esya/tebesir-pembe.png", boy: 12, eylem: "yaz", ciz: [250, 160, 200] },
    "tebesir-mavi": { resim: "cizimler/esya/tebesir-mavi.png", boy: 12, eylem: "yaz", ciz: [140, 200, 250] },
    silgi: { resim: "cizimler/esya/silgi.png", boy: 24, sil: true },
    zipzip: { resim: "cizimler/esya/zipzip.png", boy: 46, eylem: "sektir" },
    sepet: { resim: "cizimler/esya/sepet.png", boy: 80, sepet: true },
    "mama-kabi": { resim: "cizimler/esya/mama-kabi.png", boy: 32, mama: true, sonra: "mama-kabi-bos" },
    "mama-kabi-bos": { resim: "cizimler/esya/mama-kabi-bos.png", boy: 26, bos: "mama-kabi" },
    "mama-paketi": { resim: "cizimler/esya/mama-paketi.png", boy: 56, eylem: "dok" },
    kemik: { resim: "cizimler/esya/kemik.png", boy: 26, yenir: [250, 240, 215] },
    // boya: giyince karakterin kendi kıyafetinin hangi bölgeleri bu renge boyanır (karakterin "kiyafet" verisi).
    elbise: { resim: "cizimler/esya/elbise.png", boy: 150, eylem: "giy", giy: "govde", boya: ["ust", "alt"], renk: [245, 120, 170] },
    "elbise-mor": { resim: "cizimler/esya/elbise-mor.png", boy: 150, eylem: "giy", giy: "govde", boya: ["ust", "alt"], renk: [165, 120, 230] },
    tisort: { resim: "cizimler/esya/tisort.png", boy: 100, eylem: "giy", giy: "govde", boya: ["ust"], renk: [80, 160, 235] },
    "tisort-sari": { resim: "cizimler/esya/tisort-sari.png", boy: 100, eylem: "giy", giy: "govde", boya: ["ust"], renk: [255, 205, 60] },
    "tisort-yesil": { resim: "cizimler/esya/tisort-yesil.png", boy: 100, eylem: "giy", giy: "govde", boya: ["ust"], renk: [110, 200, 100] },
    pantolon: { resim: "cizimler/esya/pantolon.png", boy: 110, eylem: "giy", giy: "alt", boya: ["alt"], renk: [70, 110, 190] },
    "pantolon-pembe": { resim: "cizimler/esya/pantolon-pembe.png", boy: 110, eylem: "giy", giy: "alt", boya: ["alt"], renk: [240, 120, 160] },
    "pantolon-kahve": { resim: "cizimler/esya/pantolon-kahve.png", boy: 110, eylem: "giy", giy: "alt", boya: ["alt"], renk: [170, 115, 70] },
    sapka: { resim: "cizimler/esya/sapka.png", boy: 50, eylem: "giy", giy: "bas" },
  },

  // Yer simgeleri: kapıların üstünde, tabelada ve harita düğmesinde görünür.
  simgeler: {
    ev: "cizimler/simge/ev.png",
    harita: "cizimler/simge/harita.png",
    bahce: "cizimler/simge/bahce.png",
    park: "cizimler/simge/park.png",
    oyun: "cizimler/simge/oyun.png",
    okul: "cizimler/simge/okul.png",
    kafe: "cizimler/simge/kafe.png",
    market: "cizimler/simge/market.png",
    oyuncak: "cizimler/simge/oyuncak.png",
    hastane: "cizimler/simge/hastane.png",
    kuafor: "cizimler/simge/kuafor.png",
    kutuphane: "cizimler/simge/kutuphane.png",
    pastane: "cizimler/simge/pastane.png",
  },

  // Bahçede dikili çiçekler: üç hal (filiz, tomurcuk, çiçek). araclar/bitkiler.py üretir.
  // Sulama kabıyla sulanınca bir sonraki hale geçer.
  bitkiler: {
    lale: ["cizimler/bitki/lale-0.png", "cizimler/bitki/lale-1.png", "cizimler/bitki/lale-2.png"],
    papatya: ["cizimler/bitki/papatya-0.png", "cizimler/bitki/papatya-1.png", "cizimler/bitki/papatya-2.png"],
    aycicegi: ["cizimler/bitki/aycicegi-0.png", "cizimler/bitki/aycicegi-1.png", "cizimler/bitki/aycicegi-2.png"],
    gul: ["cizimler/bitki/gul-0.png", "cizimler/bitki/gul-1.png", "cizimler/bitki/gul-2.png"],
  },

  // Mekanlarda çalışan kişiler. araclar/calisanlar.py üretir. konus: ağzı açık hali.
  // İleride kızın çizimleri bu resimlerin yerine konabilir.
  calisanlar: {
    doktor: { resim: "cizimler/calisan/doktor.png", konus: "cizimler/calisan/doktor-konus.png" },
    kuafor: { resim: "cizimler/calisan/kuafor.png", konus: "cizimler/calisan/kuafor-konus.png" },
    garson: { resim: "cizimler/calisan/garson.png", konus: "cizimler/calisan/garson-konus.png" },
    kasiyer: { resim: "cizimler/calisan/kasiyer.png", konus: "cizimler/calisan/kasiyer-konus.png" },
    oyuncakci: { resim: "cizimler/calisan/oyuncakci.png", konus: "cizimler/calisan/oyuncakci-konus.png" },
    kutuphaneci: { resim: "cizimler/calisan/kutuphaneci.png", konus: "cizimler/calisan/kutuphaneci-konus.png" },
    pastaci: { resim: "cizimler/calisan/pastaci.png", konus: "cizimler/calisan/pastaci-konus.png" },
    ogretmen: { resim: "cizimler/calisan/ogretmen.png", konus: "cizimler/calisan/ogretmen-konus.png" },
    bahcivan: { resim: "cizimler/calisan/bahcivan.png", konus: "cizimler/calisan/bahcivan-konus.png" },
    gorevli: { resim: "cizimler/calisan/gorevli.png", konus: "cizimler/calisan/gorevli-konus.png" },
  },

  // Mekanlar. Her mekanın kimliği anahtarıdır.
  //   ad: tabelada görünen ad. simge: cizimler/simge/<simge>.png. ev: bağlı olduğu ev (varsa).
  //   resim: arka plan. zemin: karakterlerin durduğu bant. giris: haritadan girince karakterin yeri.
  //   kapilar: başka mekana geçiş. hedef: gidilen mekan. giris: orada durulan yer.
  //            hedef "dunya" ise yer: haritadaki hangi yerin önüne çıkılır.
  //   noktalar: dokununca ya da üstüne bırakınca bir şey olan yerler.
  //     musluk: su akar ya da durur. su: suyun başladığı yer, boyu ve rengi.
  //     fiskiye: yukarı fışkıran su. acik: başta açık mı.
  //     dolap: dokununca açılır ya da kapanır. resim: açık hali, sol üst köşesi x0, y0.
  //            Dolaba bırakılan eşya içinde saklanır. Dolap açıkken görünür ve geri alınır.
  //     raf: hep açık raf. Dolap ve rafta raflar: yiyecek ve eşyalar. Biri alınınca yerine yenisi gelir.
  //     kuvet: karakter bırakılınca içine girer, sadece başı görünür.
  //     klozet: karakter oturur, beli piksel sansürle örtülür. Kalkınca sifon çekilir.
  //     otur: sandalye, kanepe, bank. Karakter bırakılınca oturur.
  //     yatak: karakter bırakılınca yatar ve uyur. yatis: ayak ucu. uzunluk: ayaktan yastığa. yorgan: üstünü örten örtü.
  //            yon: -1 ise yastık soldadır (varsayılan 1, yastık sağda).
  //     salincak: karakter bırakılınca sallanır. asma: ipin bağlı olduğu nokta. ip: ipin boyu.
  //     kaydirak: karakter bırakılınca üstten alta kayar.
  //     tezgah: eşya bırakılınca üstüne konur. ust: eşyaların durduğu çizgi.
  //     ocak: tencere ve tava gözlere konur. Göze dokununca ocak yanar ve kırmızı olur.
  //     tv: dokununca açılır. Açıkken odadaki karakterler dans eder. ekran: renkli ışığın yeri.
  //     lamba: dokununca yanar ya da söner. isik: ışığın merkezi.
  //     bitki: dikili çiçekler. hal: başlangıç hali (0 filiz, 1 tomurcuk, 2 çiçek). Taşınmaz. Sulama kabını tutan karaktere dokununca gider ve en yakın çiçeği sular.
  //   calisan: mekanın sabit kişisi. Gelen karaktere selam verir. Dokununca sozler'den birini söyler.
  mekanlar: {
    // Kasaba haritası. Kuşbakışı tek resim: kamera dört yöne kayar.
    dunya: {
      ad: "Meriç Sokağı", simge: "harita", tur: "dunya",
      // Resim iki yarıdır: Kaplay 2048 pikselden geniş tek resim yükleyemez. Yarılar soldan sağa yan yana durur.
      haritaResim: ["cizimler/dunya/kasaba-1.jpg", "cizimler/dunya/kasaba-2.jpg"],
      genislik: 2560, yukseklik: 1429,
      zemin: { ust: 300, alt: 1410, sol: 30, sag: 2530 },
      olcek: 0.4, // haritada karakter ve eşyalar küçük görünür
      derinlikUst: 0.8, // en üstte (uzakta) boy bu kadar küçülür
      giris: { x: 1120, y: 580 },
      // Haritadaki yerler. alan: dokununca ya da üstüne bırakınca o yere gidilen dikdörtgen.
      // on: karakterin kapıya yürüdüğü ve dışarı çıkınca durduğu nokta. hedef: girilen mekan.
      yerler: [
        { id: "ev1", alan: { x: 190, y: 100, w: 420, h: 420 }, on: { x: 525, y: 540 }, hedef: "oda" },
        { id: "bahce1", alan: { x: 160, y: 520, w: 520, h: 260 }, on: { x: 400, y: 650 }, hedef: "bahce1" },
        { id: "pastane", alan: { x: 625, y: 120, w: 415, h: 360 }, on: { x: 965, y: 500 }, hedef: "pastane" },
        { id: "oyun", alan: { x: 1040, y: 160, w: 225, h: 350 }, on: { x: 1160, y: 520 }, hedef: "oyun" },
        { id: "park", alan: { x: 1265, y: 160, w: 265, h: 350 }, on: { x: 1300, y: 520 }, hedef: "park" },
        { id: "okul", alan: { x: 1530, y: 80, w: 365, h: 400 }, on: { x: 1712, y: 495 }, hedef: "okul" },
        { id: "ev2", alan: { x: 2010, y: 120, w: 375, h: 390 }, on: { x: 2120, y: 530 }, hedef: "ev2-salon" },
        { id: "bahce2", alan: { x: 1880, y: 510, w: 680, h: 260 }, on: { x: 1930, y: 660 }, hedef: "bahce2" },
        { id: "market", alan: { x: 720, y: 615, w: 350, h: 360 }, on: { x: 1000, y: 965 }, hedef: "market" },
        { id: "kutuphane", alan: { x: 1130, y: 585, w: 340, h: 375 }, on: { x: 1300, y: 965 }, hedef: "kutuphane" },
        { id: "oyuncakci", alan: { x: 1512, y: 610, w: 360, h: 270 }, on: { x: 1900, y: 930 }, hedef: "oyuncakci" },
        { id: "hastane", alan: { x: 1464, y: 880, w: 424, h: 500 }, on: { x: 1640, y: 1395 }, hedef: "hastane" },
        { id: "kuafor", alan: { x: 720, y: 990, w: 360, h: 390 }, on: { x: 1005, y: 1395 }, hedef: "kuafor" },
        { id: "kafe", alan: { x: 1085, y: 990, w: 355, h: 390 }, on: { x: 1368, y: 1395 }, hedef: "kafe" },
        { id: "ev3", alan: { x: 0, y: 800, w: 610, h: 580 }, on: { x: 290, y: 1300 }, hedef: "ev3-oda" },
      ],
    },

    // --- Ev 1: mavi çatılı ev. Salon, mutfak, banyo, yatak odası ve bahçe. ---
    oda: {
      ad: "Salon", simge: "ev", ev: "ev1",
      resim: "cizimler/mekan/oda.jpg", zemin: ZEMIN, giris: GIRIS_SOL,
      kapilar: [
        { x: 48, y: 210, w: 110, h: 345, hedef: "dunya", yer: "ev1" },
        { x: 1130, y: 210, w: 112, h: 300, hedef: "mutfak", giris: GIRIS_SOL },
      ],
      noktalar: [
        { tur: "tv", x: 827, y: 180, w: 180, h: 175, ekran: { x: 852, y: 250, w: 125, h: 87 } },
        {
          tur: "dolap", x: 802, y: 367, w: 240, h: 98,
          resim: "cizimler/mekan/tv-dolabi-acik.png", x0: 765, y0: 362,
          raflar: [
            { sablon: "kumanda", x: 860, y: 424 }, { sablon: "kitap", x: 930, y: 424 }, { sablon: "telefon", x: 1000, y: 424 },
            { sablon: "kup", x: 875, y: 452 }, { sablon: "ordek", x: 985, y: 452 },
          ],
        },
        // Sağ alttaki kanepe: karakter üstüne bırakılınca oturur.
        { tur: "otur", x: 1120, y: 490, w: 160, h: 190, oturma: { x: 1205, y: 645 } },
      ],
    },
    mutfak: {
      ad: "Mutfak", simge: "ev", ev: "ev1",
      resim: "cizimler/mekan/mutfak.jpg", zemin: ZEMIN, giris: GIRIS_SOL,
      kapilar: [
        { x: 48, y: 210, w: 110, h: 345, hedef: "oda", giris: GIRIS_SAG },
        { x: 1130, y: 210, w: 112, h: 300, hedef: "banyo", giris: GIRIS_SOL },
      ],
      noktalar: [
        {
          tur: "dolap", x: 225, y: 173, w: 183, h: 314,
          resim: "cizimler/mekan/buzdolabi-acik.png", x0: 160, y0: 170,
          raflar: [
            { sablon: "sut", x: 270, y: 251 }, { sablon: "portakal-suyu", x: 340, y: 251 },
            { sablon: "peynir", x: 262, y: 326 }, { sablon: "cilek", x: 308, y: 326 }, { sablon: "havuc", x: 352, y: 326 },
            { sablon: "karpuz", x: 275, y: 401 }, { sablon: "dondurma", x: 345, y: 401 },
          ],
        },
        { tur: "musluk", x: 645, y: 318, w: 70, h: 50, su: { x: 690, y: 342, boy: 20 } },
        { tur: "ocak", x: 755, y: 340, w: 140, h: 48, gozler: [{ x: 793, y: 372 }, { x: 857, y: 372 }] },
        { tur: "tezgah", x: 395, y: 270, w: 523, h: 115, ust: 372 },
        // Tezgahın altındaki beş dolap. Hepsi aynı açık dolap resmini kullanır.
        ...[["bardak", "tencere"], ["bardak", "tava"], ["kupa", "tencere-gri"], ["bardak", "tava"], ["kupa", "tencere"]].map(([ust, alt], i) => ({
          tur: "dolap", x: 410 + i * 100, y: 393, w: 90, h: 82,
          resim: "cizimler/mekan/mutfak-dolap-acik.png", x0: 358 + i * 100, y0: 385,
          raflar: [{ sablon: ust, x: 455 + i * 100, y: 431 }, { sablon: alt, x: 455 + i * 100, y: 470 }],
        })),
        // Sağ alttaki tabure: karakter üstüne bırakılınca oturur.
        sandalye(1200, 662),
      ],
    },

    banyo: {
      ad: "Banyo", simge: "ev", ev: "ev1",
      resim: "cizimler/mekan/banyo.jpg", zemin: ZEMIN, giris: GIRIS_SOL,
      kapilar: [
        { x: 48, y: 210, w: 110, h: 345, hedef: "mutfak", giris: GIRIS_SAG },
        { x: 1130, y: 210, w: 112, h: 300, hedef: "yatak", giris: GIRIS_SOL },
      ],
      noktalar: [
        { tur: "musluk", x: 330, y: 290, w: 90, h: 55, su: { x: 373, y: 322, boy: 20 } },
        { tur: "musluk", x: 1000, y: 305, w: 80, h: 50, su: { x: 1021, y: 336, boy: 36 } },
        {
          tur: "kuvet", x: 720, y: 300, w: 355, h: 200,
          resim: "cizimler/mekan/kuvet-on.png", x0: 715, y0: 345,
          su: 372, dip: 492, yerler: [{ x: 825 }, { x: 970 }],
        },
        { tur: "klozet", x: 555, y: 320, w: 115, h: 185, oturma: { x: 613, y: 483 } },
      ],
    },

    yatak: {
      ad: "Yatak odası", simge: "ev", ev: "ev1",
      resim: "cizimler/mekan/yatak.jpg", zemin: ZEMIN, giris: GIRIS_SOL,
      kapilar: [
        { x: 48, y: 210, w: 110, h: 345, hedef: "banyo", giris: GIRIS_SAG },
        { x: 1130, y: 210, w: 112, h: 300, hedef: "bahce1", giris: { x: 250, y: 590 } },
      ],
      noktalar: [
        { tur: "yatak", x: 230, y: 280, w: 350, h: 210, yatis: { x: 535, y: 420 }, uzunluk: 250, yon: -1, yorgan: { x: 335, y: 378, w: 205, h: 66 }, renk: [108, 141, 194] },
        { tur: "lamba", x: 585, y: 305, w: 85, h: 90, isik: { x: 627, y: 335 } },
        {
          tur: "dolap", x: 838, y: 192, w: 214, h: 288,
          resim: "cizimler/mekan/gardirop-acik.png", x0: 796, y0: 190,
          raflar: [
            // sira: biri alınınca rafa sıradaki renk gelir.
            { sablon: "sapka", x: 953, y: 252 },
            { sablon: "elbise", sira: ["elbise", "elbise-mor"], x: 908, y: 412 },
            { sablon: "tisort", sira: ["tisort", "tisort-sari", "tisort-yesil"], x: 998, y: 378 },
            { sablon: "pantolon", sira: ["pantolon", "pantolon-pembe", "pantolon-kahve"], x: 953, y: 456 },
          ],
        },
      ],
    },

    bahce1: {
      ad: "Bahçe", simge: "bahce", ev: "ev1",
      resim: "cizimler/mekan/bahce1.jpg",
      zemin: { ust: 490, alt: 700, sol: 60, sag: 1220 },
      giris: { x: 1060, y: 600 },
      kapilar: [
        { x: 45, y: 300, w: 110, h: 250, hedef: "yatak", giris: GIRIS_SAG },
        { x: 1115, y: 370, w: 135, h: 190, hedef: "dunya", yer: "bahce1" },
      ],
      noktalar: [
        // Resimdeki iki salıncağın üstüne oturan ipler ve oturaklar.
        { tur: "salincak", x: 438, y: 180, w: 74, h: 320, asma: { x: 475, y: 190 }, ip: 235, ara: 27, renk: [240, 190, 60], ipRenk: [90, 80, 75] },
        { tur: "salincak", x: 532, y: 180, w: 74, h: 320, asma: { x: 568, y: 190 }, ip: 235, ara: 28, renk: [240, 190, 60], ipRenk: [90, 80, 75] },
        { tur: "kaydirak", x: 680, y: 210, w: 340, h: 280, ust: { x: 765, y: 228 }, alt: { x: 1000, y: 472 } },
        // Mavi sandalye ve şemsiyeli masa.
        { tur: "otur", x: 200, y: 350, w: 70, h: 140, oturma: { x: 232, y: 478 } },
        { tur: "tezgah", x: 245, y: 495, w: 125, h: 30, ust: 515 },
        {
          tur: "bitki", bitkiler: [
            { tur: "lale", x: 470, y: 660, hal: 2 }, { tur: "gul", x: 560, y: 680, hal: 1 },
            { tur: "papatya", x: 720, y: 665 }, { tur: "aycicegi", x: 880, y: 650, hal: 2 }, { tur: "lale", x: 1080, y: 680 },
          ],
        },
      ],
    },

    // --- Ev 2: kırmızı çatılı aile evi. Salon, çocuk odası ve bahçe. ---
    "ev2-salon": {
      ad: "Salon", simge: "ev", ev: "ev2",
      resim: "cizimler/mekan/ev2-salon.jpg", zemin: ZEMIN, giris: GIRIS_SOL,
      kapilar: [
        { ...KAPI_SOL, hedef: "dunya", yer: "ev2" },
        { ...KAPI_SAG, hedef: "ev2-cocuk", giris: GIRIS_SOL },
      ],
      noktalar: [
        { tur: "otur", x: 480, y: 300, w: 160, h: 170, oturma: { x: 570, y: 462 } },
        { tur: "otur", x: 640, y: 300, w: 160, h: 170, oturma: { x: 710, y: 462 } },
      ],
    },
    "ev2-cocuk": {
      ad: "Çocuk odası", simge: "ev", ev: "ev2",
      resim: "cizimler/mekan/ev2-cocuk.jpg", zemin: ZEMIN, giris: GIRIS_SOL,
      kapilar: [
        { ...KAPI_SOL, hedef: "ev2-salon", giris: GIRIS_SAG },
        { ...KAPI_SAG, hedef: "bahce2", giris: { x: 250, y: 590 } },
      ],
      noktalar: [
        { tur: "yatak", x: 220, y: 280, w: 340, h: 200, yatis: { x: 246, y: 318 }, uzunluk: 270, yorgan: { x: 232, y: 300, w: 190, h: 84 }, renk: [250, 130, 150] },
        sandalye(920, 470),
      ],
    },
    bahce2: {
      ad: "Bahçe", simge: "bahce", ev: "ev2",
      resim: "cizimler/mekan/bahce2.jpg",
      zemin: { ust: 500, alt: 700, sol: 60, sag: 1220 },
      giris: { x: 1060, y: 610 },
      kapilar: [
        { x: 45, y: 330, w: 110, h: 230, hedef: "ev2-cocuk", giris: GIRIS_SAG },
        { x: 1115, y: 370, w: 135, h: 195, hedef: "dunya", yer: "bahce2" },
      ],
      noktalar: [
        { tur: "kaydirak", x: 360, y: 210, w: 340, h: 290, ust: { x: 445, y: 232 }, alt: { x: 690, y: 478 } },
        // Sarı sandalye, şemsiyeli masa ve ön sağdaki bank.
        { tur: "otur", x: 975, y: 345, w: 75, h: 140, oturma: { x: 1010, y: 483 } },
        { tur: "tezgah", x: 800, y: 370, w: 160, h: 35, ust: 395 },
        { tur: "otur", x: 1045, y: 585, w: 155, h: 75, oturma: { x: 1120, y: 652 } },
        {
          tur: "bitki", bitkiler: [
            { tur: "aycicegi", x: 300, y: 650, hal: 1 }, { tur: "papatya", x: 470, y: 670, hal: 2 },
            { tur: "gul", x: 640, y: 660, hal: 2 }, { tur: "lale", x: 900, y: 660 }, { tur: "papatya", x: 960, y: 690 },
          ],
        },
      ],
    },

    // --- Ev 3: küçük sarı ev. Tek oda. ---
    "ev3-oda": {
      ad: "Küçük ev", simge: "ev", ev: "ev3",
      resim: "cizimler/mekan/ev3-oda.jpg", zemin: ZEMIN, giris: GIRIS_SOL,
      kapilar: [{ ...KAPI_SOL, hedef: "dunya", yer: "ev3" }],
      noktalar: [
        { tur: "yatak", x: 220, y: 280, w: 320, h: 200, yatis: { x: 240, y: 318 }, uzunluk: 255, yorgan: { x: 236, y: 300, w: 178, h: 84 }, renk: [170, 140, 240] },
        { tur: "musluk", x: 830, y: 290, w: 120, h: 70, su: { x: 915, y: 318, boy: 24 } },
        sandalye(760, 480),
      ],
    },

    // --- Kamusal ve sosyal mekanlar ---
    park: {
      ad: "Park", simge: "park",
      resim: "cizimler/mekan/park.jpg",
      zemin: { ust: 510, alt: 705, sol: 60, sag: 1220 },
      giris: { x: 250, y: 600 },
      kapilar: [{ x: 35, y: 350, w: 135, h: 215, hedef: "dunya", yer: "park" }],
      calisan: {
        meslek: "bahcivan", x: 420, y: 560,
        selam: "Hoş geldiniz! Parkımız bugün çok güzel.",
        sozler: ["Çiçeklere dikkat edelim, koparmayalım.", "Ağaçları her sabah ben suluyorum.", "Fıskiyenin suyu çok serin!", "Çöpleri çöp kutusuna atalım lütfen.", "Bankta oturup dinlenebilirsiniz."],
      },
      noktalar: [
        // Havuzlu çeşme. Dokununca su açılır, kapanır.
        { tur: "fiskiye", x: 520, y: 250, w: 360, h: 265, su: { x: 700, y: 322 }, acik: true },
        // Arkadaki büyük bank ve öndeki küçük bank: ikişer kişilik.
        { tur: "otur", x: 950, y: 330, w: 100, h: 150, oturma: { x: 1000, y: 472 } },
        { tur: "otur", x: 1050, y: 330, w: 100, h: 150, oturma: { x: 1100, y: 472 } },
        { tur: "otur", x: 905, y: 560, w: 100, h: 100, oturma: { x: 955, y: 648 } },
        { tur: "otur", x: 1005, y: 560, w: 100, h: 100, oturma: { x: 1055, y: 648 } },
      ],
    },
    oyun: {
      ad: "Oyun alanı", simge: "oyun",
      resim: "cizimler/mekan/oyun.jpg", zemin: ZEMIN_ACIK, giris: { x: 270, y: 590 },
      kapilar: [{ ...BAHCE_KAPI_SOL, hedef: "dunya", yer: "oyun" }],
      calisan: {
        meslek: "gorevli", x: 610, y: 510,
        selam: "Hoş geldiniz! Hadi oyun oynayalım!",
        sozler: ["Kaydıraktan sırayla kayalım.", "Salıncakta sıkı tutunun!", "Kumdan kale yapalım mı?", "Koşarken dikkat edin, düşmeyin!", "Su içmeyi unutmayın."],
      },
      noktalar: [
        { tur: "salincak", x: 300, y: 180, w: 240, h: 300, asma: { x: 420, y: 192 }, ip: 200 },
        { tur: "kaydirak", x: 660, y: 200, w: 360, h: 290, ust: { x: 755, y: 232 }, alt: { x: 1000, y: 470 } },
      ],
    },
    okul: {
      ad: "Okul", simge: "okul",
      // Sınıf resminin kendi perspektifi var: arka duvar daha yukarıda, kapı daha dar.
      resim: "cizimler/mekan/okul.jpg",
      zemin: { ust: 380, alt: 705, sol: 30, sag: 1250, ufuk: { x: 660, y: 58 }, arka: { sol: 321, sag: 1000, y: 342 } },
      olcek: 0.65, // sıralar küçük çizili: karakterler de küçük görünür
      giris: { x: 240, y: 590 },
      kapilar: [{ x: 70, y: 200, w: 105, h: 355, hedef: "dunya", yer: "okul" }],
      calisan: {
        meslek: "ogretmen", x: 1010, y: 480,
        selam: "Günaydın çocuklar, hoş geldiniz!",
        sozler: ["Kitaplarınızı açın, bugün okuma yapacağız.", "Bugün resim dersimiz var.", "Aferin, çok güzel cevap!", "Parmak kaldırıp söz alalım.", "Teneffüs zili çaldı!"],
      },
      // Öğrenci sıralarının ve öğretmen masasının sandalyeleri.
      noktalar: [
        // Kara tahta: tebeşir sürtülünce yazar, silgi siler. Tebeşir rafı sırayla beyaz, pembe, mavi verir.
        { tur: "tahta", x: 495, y: 128, w: 295, h: 132 },
        { tur: "raf", raflar: [{ sablon: "tebesir", x: 712, y: 270, sira: ["tebesir", "tebesir-pembe", "tebesir-mavi"] }, { sablon: "silgi", x: 530, y: 268 }] },
        sandalye(395, 460), sandalye(677, 460), sandalye(893, 460),
        sandalye(316, 609), sandalye(586, 612), sandalye(686, 609),
        sandalye(1181, 660),
      ],
    },
    kafe: {
      ad: "Kafe", simge: "kafe",
      resim: "cizimler/mekan/kafe.jpg",
      zemin: { ust: 490, alt: 705, sol: 30, sag: 1250, ufuk: { x: 640, y: 190 }, arka: { sol: 205, sag: 1090, y: 470 } },
      giris: { x: 240, y: 600 },
      kapilar: [{ x: 45, y: 200, w: 112, h: 345, hedef: "dunya", yer: "kafe" }],
      calisan: {
        meslek: "garson", x: 610, y: 600,
        selam: "Hoş geldiniz! Ne içersiniz? Çay, kahve ya da sıcak çikolata?",
        sozler: ["Kurabiyelerimiz fırından yeni çıktı.", "Şekerli mi olsun, şekersiz mi?", "Siparişiniz hemen geliyor.", "Buyurun, masanız hazır.", "Afiyet olsun!"],
      },
      noktalar: [
        // Kahve makinesi: dokununca kahve akar.
        { tur: "musluk", x: 345, y: 250, w: 140, h: 95, su: { x: 420, y: 333, boy: 18, renk: [130, 80, 45] } },
        { tur: "tezgah", x: 250, y: 330, w: 370, h: 60, ust: 368 },
        // Pasta vitrini ve sağdaki raflar. Alınanın yerine yenisi gelir.
        {
          tur: "raf", raflar: [
            { sablon: "ekmek", x: 665, y: 378 }, { sablon: "kurabiye", x: 718, y: 378 }, { sablon: "kurabiye", x: 770, y: 378 },
            { sablon: "pasta", x: 665, y: 427 }, { sablon: "kurabiye", x: 718, y: 427 }, { sablon: "kurabiye", x: 770, y: 427 },
            { sablon: "kupa", x: 1222, y: 330 }, { sablon: "kupa", x: 1200, y: 424 },
            { sablon: "cay", x: 465, y: 368 }, { sablon: "sicak-cikolata", x: 515, y: 368 },
          ],
        },
        // Yuvarlak masa, iki pembe sandalye ve kanepe.
        { tur: "tezgah", x: 835, y: 455, w: 175, h: 50, ust: 490 },
        sandalye(785, 605), sandalye(1040, 600),
        { tur: "otur", x: 845, y: 335, w: 215, h: 115, oturma: { x: 950, y: 455 } },
      ],
    },
    market: {
      ad: "Market", simge: "market",
      resim: "cizimler/mekan/market.jpg",
      zemin: { ust: 490, alt: 705, sol: 30, sag: 1250, ufuk: { x: 715, y: 290 }, arka: { sol: 300, sag: 1090, y: 465 } },
      giris: { x: 230, y: 600 },
      kapilar: [{ x: 40, y: 200, w: 110, h: 345, hedef: "dunya", yer: "market" }],
      calisan: {
        meslek: "kasiyer", x: 975, y: 520,
        selam: "Hoş geldiniz! Aradığınızı bulabildiniz mi?",
        sozler: ["Meyveler bugün çok taze.", "Poşet ister misiniz?", "Kasaya buyurun, ürünleri okutayım.", "Fişiniz burada. İyi günler!", "Bugün sütte indirim var."],
      },
      noktalar: [
        // İki mavi rafın üç katı. Raftan alınan ürünün yerine yenisi gelir.
        {
          tur: "raf", raflar: [
            { sablon: "elma", x: 362, y: 278 }, { sablon: "muz", x: 427, y: 278 }, { sablon: "portakal", x: 492, y: 278 }, { sablon: "cilek", x: 557, y: 278 },
            { sablon: "ekmek", x: 375, y: 356 }, { sablon: "peynir", x: 460, y: 356 }, { sablon: "havuc", x: 545, y: 356 },
            { sablon: "sut", x: 370, y: 434 }, { sablon: "portakal-suyu", x: 455, y: 434 }, { sablon: "karpuz", x: 545, y: 434 },
            { sablon: "tahin", x: 685, y: 278 }, { sablon: "kurabiye", x: 765, y: 278 }, { sablon: "dondurma", x: 845, y: 278 },
            { sablon: "sabun", x: 685, y: 356 }, { sablon: "sampuan", x: 765, y: 356 }, { sablon: "dis-macunu", x: 845, y: 356 },
            { sablon: "mama-paketi", x: 685, y: 434 }, { sablon: "kemik", x: 765, y: 434 }, { sablon: "ekmek", x: 845, y: 434 },
            // Kapının yanındaki sepetler.
            { sablon: "sepet", x: 250, y: 372 },
          ],
        },
        // Kasa: konan eşya "bip" diye okunur. Sepet konunca içindekiler tek tek okunur.
        { tur: "kasa", x: 1025, y: 380, w: 125, h: 85, ust: 440, okut: { x: 1060, y: 412 } },
      ],
    },

    oyuncakci: {
      ad: "Oyuncakçı", simge: "oyuncak",
      resim: "cizimler/mekan/oyuncakci.jpg",
      zemin: { ust: 470, alt: 705, sol: 30, sag: 1250, ufuk: { x: 640, y: 200 }, arka: { sol: 235, sag: 1050, y: 440 } },
      giris: { x: 240, y: 610 },
      kapilar: [{ x: 40, y: 215, w: 110, h: 330, hedef: "dunya", yer: "oyuncakci" }],
      calisan: {
        meslek: "oyuncakci", x: 880, y: 565,
        selam: "Hoş geldin! Hangi oyuncağa bakmıştın?",
        sozler: ["Bu top çok yükseğe zıplıyor!", "Yeni oyuncak arabalar geldi.", "Hediye paketi yapalım mı?", "Ayıcığımız çok yumuşak, sarılabilirsin.", "Pilleri de vereyim mi?"],
      },
      noktalar: [
        // Arkadaki büyük raf ve öndeki raf. Alınan oyuncağın yerine yenisi gelir.
        {
          tur: "raf", raflar: [
            { sablon: "ordek", x: 335, y: 263 }, { sablon: "araba", x: 452, y: 263 }, { sablon: "tren", x: 545, y: 263 }, { sablon: "kup", x: 612, y: 263 },
            { sablon: "ayi", x: 330, y: 350 }, { sablon: "top", x: 605, y: 350 },
            { sablon: "balon", x: 1062, y: 300 },
            { sablon: "boya", x: 400, y: 503 }, { sablon: "araba", x: 490, y: 503 }, { sablon: "kup", x: 570, y: 503 },
            { sablon: "kitap", x: 400, y: 600 }, { sablon: "kova", x: 490, y: 600 }, { sablon: "top", x: 620, y: 600 },
          ],
        },
        { tur: "tezgah", x: 918, y: 340, w: 215, h: 45, ust: 378 },
        // Kırmızı tabure.
        { tur: "otur", x: 1075, y: 425, w: 75, h: 80, oturma: { x: 1112, y: 495 } },
      ],
    },
    hastane: {
      ad: "Hastane", simge: "hastane",
      resim: "cizimler/mekan/hastane.jpg",
      zemin: { ust: 480, alt: 705, sol: 30, sag: 1250, ufuk: { x: 640, y: 170 }, arka: { sol: 205, sag: 1075, y: 440 } },
      giris: { x: 240, y: 600 },
      kapilar: [{ x: 45, y: 200, w: 112, h: 350, hedef: "dunya", yer: "hastane" }],
      calisan: {
        meslek: "doktor", x: 690, y: 530,
        selam: "Hoş geldiniz! Ne rahatsızlığınız vardı?",
        sozler: ["Ağzınızı açın, aaa deyin.", "Derin nefes alın, verin.", "Ateşiniz var mı? Bir ölçelim.", "Şurubunuzu günde üç kez için.", "Geçmiş olsun! Bol su için, dinlenin."],
      },
      noktalar: [
        // Hasta yatağı. Yastık sağda.
        { tur: "yatak", x: 310, y: 295, w: 320, h: 190, yatis: { x: 355, y: 362 }, uzunluk: 240, yorgan: { x: 320, y: 335, w: 200, h: 62 }, renk: [96, 140, 196] },
        { tur: "tezgah", x: 745, y: 320, w: 285, h: 45, ust: 352 },
        // Doktorun döner sandalyesi.
        { tur: "otur", x: 890, y: 365, w: 105, h: 150, oturma: { x: 935, y: 505 } },
        // Kapının yanındaki sabunluk.
        { tur: "musluk", x: 8, y: 328, w: 45, h: 75, su: { x: 28, y: 398, boy: 12, renk: [200, 230, 255] } },
        // Araba ve masa: havlu, sabun, termometre, şurup ve ilk yardım çantasından yara bandı.
        {
          tur: "raf", raflar: [
            { sablon: "havlu", x: 1215, y: 548 }, { sablon: "sabun", x: 1235, y: 450 }, { sablon: "termometre", x: 1175, y: 450 },
            { sablon: "surup", x: 775, y: 352 }, { sablon: "yara-bandi", x: 966, y: 345 },
          ],
        },
      ],
    },
    kuafor: {
      ad: "Kuaför", simge: "kuafor",
      resim: "cizimler/mekan/kuafor.jpg",
      zemin: { ust: 470, alt: 705, sol: 30, sag: 1250, ufuk: { x: 640, y: 160 }, arka: { sol: 210, sag: 1080, y: 455 } },
      giris: { x: 230, y: 600 },
      kapilar: [{ x: 40, y: 200, w: 118, h: 360, hedef: "dunya", yer: "kuafor" }],
      calisan: {
        meslek: "kuafor", x: 655, y: 565,
        selam: "Hoş geldiniz! Saçınızı bugün nasıl kesmemi istersiniz?",
        sozler: ["Uçlarını mı alalım, kısa mı keselim?", "Önce saçınızı yıkayalım.", "Fön mü çekelim, maşa mı yapalım?", "Kakül ister misiniz?", "Saçınız çok güzel oldu!"],
      },
      noktalar: [
        // Pembe kuaför koltuğu, aynanın önünde.
        { tur: "otur", x: 330, y: 360, w: 180, h: 180, oturma: { x: 410, y: 500 } },
        // Turuncu kanepe.
        { tur: "otur", x: 1090, y: 395, w: 190, h: 170, oturma: { x: 1175, y: 535 } },
        { tur: "tezgah", x: 290, y: 300, w: 335, h: 80, ust: 372 },
        // Masada makas ve el aynası.
        { tur: "raf", raflar: [{ sablon: "makas", x: 470, y: 372 }, { sablon: "ayna", x: 575, y: 372 }] },
        { tur: "musluk", x: 705, y: 295, w: 155, h: 90, su: { x: 786, y: 322, boy: 22 } },
        // Su sebili.
        { tur: "musluk", x: 1050, y: 290, w: 65, h: 165, su: { x: 1070, y: 408, boy: 16 } },
      ],
    },
    kutuphane: {
      ad: "Kütüphane", simge: "kutuphane",
      resim: "cizimler/mekan/kutuphane.jpg",
      zemin: { ust: 470, alt: 705, sol: 30, sag: 1250, ufuk: { x: 640, y: 190 }, arka: { sol: 205, sag: 1075, y: 455 } },
      giris: { x: 240, y: 600 },
      kapilar: [{ x: 45, y: 210, w: 115, h: 345, hedef: "dunya", yer: "kutuphane" }],
      calisan: {
        meslek: "kutuphaneci", x: 285, y: 600,
        selam: "Hoş geldiniz! Hangi kitabı arıyorsunuz?",
        sozler: ["Kütüphanede sessiz olalım, şşş.", "Masal kitapları şu rafta.", "Kitabı iki hafta sonra geri getirin.", "Kütüphane kartınız var mı?", "Okumak çok güzel, değil mi?"],
      },
      noktalar: [
        // İki kitaplığın orta rafı. Alınan kitabın yerine yenisi gelir.
        {
          tur: "raf", raflar: [
            { sablon: "kitap", x: 430, y: 205 }, { sablon: "kitap", x: 395, y: 295 }, { sablon: "kitap", x: 450, y: 295 },
            { sablon: "kitap", x: 870, y: 295 }, { sablon: "kitap", x: 950, y: 295 }, { sablon: "kitap", x: 1030, y: 295 },
          ],
        },
        { tur: "tezgah", x: 485, y: 430, w: 315, h: 75, ust: 478 },
        { tur: "lamba", x: 705, y: 345, w: 65, h: 95, isik: { x: 725, y: 388 }, abajur: false },
        sandalye(460, 600), sandalye(822, 600),
        // Sağdaki minderler ve soldaki yeşil puf.
        { tur: "otur", x: 1020, y: 440, w: 160, h: 110, oturma: { x: 1095, y: 540 } },
        { tur: "otur", x: 0, y: 565, w: 165, h: 140, oturma: { x: 80, y: 698 } },
      ],
    },
    pastane: {
      ad: "Pastane", simge: "pastane",
      resim: "cizimler/mekan/pastane.jpg",
      zemin: { ust: 490, alt: 705, sol: 30, sag: 1250, ufuk: { x: 640, y: 200 }, arka: { sol: 230, sag: 1080, y: 440 } },
      giris: { x: 240, y: 600 },
      kapilar: [{ x: 40, y: 215, w: 110, h: 330, hedef: "dunya", yer: "pastane" }],
      calisan: {
        meslek: "pastaci", x: 820, y: 560,
        selam: "Hoş geldiniz! Bugün taze pastalarımız var.",
        sozler: ["Doğum günü pastası mı istersiniz?", "Çilekli mi olsun, çikolatalı mı?", "Kurabiyeler fırından yeni çıktı.", "Mumlarını da koyayım mı?", "Afiyet olsun!"],
      },
      noktalar: [
        // İki camlı vitrinin iki katı. Alınanın yerine yenisi gelir.
        {
          tur: "raf", raflar: [
            { sablon: "pasta", x: 295, y: 370 }, { sablon: "kurabiye", x: 365, y: 370 }, { sablon: "dondurma", x: 435, y: 370 },
            { sablon: "pasta", x: 550, y: 370 }, { sablon: "cilek", x: 620, y: 370 }, { sablon: "kurabiye", x: 690, y: 370 },
            { sablon: "ekmek", x: 300, y: 432 }, { sablon: "kurabiye", x: 370, y: 432 }, { sablon: "ekmek", x: 440, y: 432 },
            { sablon: "kurabiye", x: 555, y: 432 }, { sablon: "pasta", x: 625, y: 432 }, { sablon: "ekmek", x: 695, y: 432 },
          ],
        },
        { tur: "tezgah", x: 250, y: 270, w: 505, h: 40, ust: 298 },
        // Vitrinin üstünde mumlu doğum günü pastası.
        { tur: "raf", raflar: [{ sablon: "dogum-gunu-pastasi", x: 570, y: 298 }] },
        // Taş fırın: dokununca ateş yanar. Tencere ve tava ateşe konur.
        { tur: "ocak", x: 880, y: 250, w: 165, h: 140, gozler: [{ x: 960, y: 380 }] },
        // Sağdaki tahta masa ve bank, soldaki ön masa.
        { tur: "tezgah", x: 905, y: 395, w: 280, h: 40, ust: 418 },
        { tur: "otur", x: 1120, y: 450, w: 160, h: 180, oturma: { x: 1195, y: 610 } },
        { tur: "tezgah", x: 140, y: 560, w: 215, h: 40, ust: 582 },
      ],
    },
  },

  // Oyun ilk açıldığında dünyanın hali. Sonra her değişiklik kaydedilir.
  baslangic: {
    mekan: "dunya",
    varliklar: [
      { id: "kiz1", tur: "karakter", sablon: "kiz", mekan: "dunya", x: 1080, y: 570 },
      { id: "kedi1", tur: "karakter", sablon: "kedi", mekan: "dunya", x: 1160, y: 585 },
      { id: "kopek1", tur: "karakter", sablon: "kopek", mekan: "dunya", x: 1250, y: 600 },
      { id: "top4", tur: "esya", sablon: "top", mekan: "dunya", x: 1320, y: 590 },
      { id: "telefon1", tur: "esya", sablon: "telefon", mekan: "oda", x: 330, y: 650 },
      { id: "kitap1", tur: "esya", sablon: "kitap", mekan: "oda", x: 930, y: 660 },
      { id: "top1", tur: "esya", sablon: "top", mekan: "oda", x: 640, y: 665 },
      { id: "araba1", tur: "esya", sablon: "araba", mekan: "oda", x: 560, y: 690 },
      { id: "kup1", tur: "esya", sablon: "kup", mekan: "oda", x: 800, y: 670 },
      { id: "boya1", tur: "esya", sablon: "boya", mekan: "oda", x: 220, y: 680 },
      { id: "elma1", tur: "esya", sablon: "elma", mekan: "mutfak", x: 500, y: 640 },
      { id: "elma2", tur: "esya", sablon: "elma", mekan: "mutfak", x: 545, y: 670 },
      { id: "tahin1", tur: "esya", sablon: "tahin", mekan: "mutfak", x: 880, y: 650 },
      { id: "sut1", tur: "esya", sablon: "sut", mekan: "mutfak", x: 960, y: 610 },
      { id: "kupa1", tur: "esya", sablon: "kupa", mekan: "mutfak", x: 400, y: 600 },
      { id: "muz1", tur: "esya", sablon: "muz", mekan: "mutfak", x: 620, y: 690 },
      { id: "ekmek1", tur: "esya", sablon: "ekmek", mekan: "mutfak", x: 770, y: 685 },
      { id: "kurabiye1", tur: "esya", sablon: "kurabiye", mekan: "mutfak", x: 440, y: 690 },
      { id: "portakal1", tur: "esya", sablon: "portakal", mekan: "mutfak", x: 1000, y: 680 },
      { id: "pasta1", tur: "esya", sablon: "pasta", mekan: "mutfak", x: 1080, y: 640 },
      { id: "ordek1", tur: "esya", sablon: "ordek", mekan: "banyo", x: 720, y: 650 },
      { id: "sabun1", tur: "esya", sablon: "sabun", mekan: "banyo", x: 520, y: 640 },
      { id: "sampuan1", tur: "esya", sablon: "sampuan", mekan: "banyo", x: 420, y: 610 },
      { id: "fircasi1", tur: "esya", sablon: "dis-fircasi", mekan: "banyo", x: 600, y: 690 },
      { id: "macun1", tur: "esya", sablon: "dis-macunu", mekan: "banyo", x: 880, y: 685 },
      { id: "havlu1", tur: "esya", sablon: "havlu", mekan: "banyo", x: 1000, y: 640 },
      { id: "kitap3", tur: "esya", sablon: "kitap", mekan: "yatak", x: 700, y: 640 },
      { id: "sulama1", tur: "esya", sablon: "sulama-kabi", mekan: "bahce1", x: 700, y: 620 },
      { id: "kova1", tur: "esya", sablon: "kova", mekan: "bahce1", x: 880, y: 640 },
      { id: "cicek1", tur: "esya", sablon: "cicek", mekan: "bahce1", x: 400, y: 660 },
      { id: "araba2", tur: "esya", sablon: "araba", mekan: "ev2-cocuk", x: 600, y: 660 },
      { id: "kup2", tur: "esya", sablon: "kup", mekan: "ev2-cocuk", x: 760, y: 640 },
      { id: "telefon2", tur: "esya", sablon: "telefon", mekan: "ev2-salon", x: 900, y: 640 },
      { id: "top3", tur: "esya", sablon: "top", mekan: "bahce2", x: 860, y: 630 },
      { id: "sulama2", tur: "esya", sablon: "sulama-kabi", mekan: "bahce2", x: 620, y: 640 },
      { id: "kupa3", tur: "esya", sablon: "kupa", mekan: "ev3-oda", x: 650, y: 620 },
      { id: "ayi1", tur: "karakter", sablon: "ayi", mekan: "park", x: 820, y: 600 },
      { id: "cicek2", tur: "esya", sablon: "cicek", mekan: "park", x: 400, y: 640 },
      { id: "top2", tur: "esya", sablon: "top", mekan: "park", x: 560, y: 660 },
      { id: "ucurtma1", tur: "esya", sablon: "ucurtma", mekan: "park", x: 680, y: 640 },
      { id: "balon1", tur: "esya", sablon: "balon", mekan: "park", x: 760, y: 610 },
      { id: "zipzip1", tur: "esya", sablon: "zipzip", mekan: "okul", x: 880, y: 660 },
      { id: "pisi1", tur: "karakter", sablon: "pisi", mekan: "oda", x: 900, y: 650 },
      { id: "mama1", tur: "esya", sablon: "mama-kabi", mekan: "oda", x: 1060, y: 680 },
      { id: "mama2", tur: "esya", sablon: "mama-kabi", mekan: "bahce1", x: 1000, y: 680 },
      { id: "kemik1", tur: "esya", sablon: "kemik", mekan: "bahce1", x: 560, y: 690 },
      { id: "kova2", tur: "esya", sablon: "kova", mekan: "oyun", x: 1100, y: 620 },
      { id: "boya2", tur: "esya", sablon: "boya", mekan: "okul", x: 500, y: 640 },
      { id: "kitap2", tur: "esya", sablon: "kitap", mekan: "okul", x: 760, y: 660 },
      { id: "kupa2", tur: "esya", sablon: "kupa", mekan: "kafe", x: 860, y: 620 },
      { id: "stetoskop1", tur: "esya", sablon: "stetoskop", mekan: "hastane", x: 760, y: 640 },
      { id: "tarak1", tur: "esya", sablon: "tarak", mekan: "kuafor", x: 545, y: 630 },
      { id: "fon1", tur: "esya", sablon: "fon", mekan: "kuafor", x: 470, y: 670 },
      { id: "sampuan2", tur: "esya", sablon: "sampuan", mekan: "kuafor", x: 930, y: 600 },
    ],
  },
};
