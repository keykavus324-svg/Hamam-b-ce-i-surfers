# Hamamböceği Run — Şehir Kaçışı

Şehir sokaklarında Diva'dan kaçan kırmızı tişörtlü hamamböceğini yönet. Trafikten ve sokak engellerinden sıyrıl, zıpla/kay, tohumları topla ve güçlendirmeleri kap. Three.js ile tarayıcıda çalışan mobil uyumlu sonsuz koşu.

## Oyna

GitHub Pages hedefi: `https://keykavus324-svg.github.io/Hamam-b-ce-i-surfers/`

İlk dağıtım için repo yöneticisi GitHub **Settings → Pages → Build and deployment → Source: GitHub Actions** ayarını açmalı. Ardından Actions sekmesinde **Deploy game to GitHub Pages → Run workflow** çalıştırılmalı.

## Kontroller

- **← / →** veya **A / D:** şerit değiştir
- **↑ / W / Space:** zıpla
- **↓ / S:** kay
- **P / Esc:** duraklat / devam et
- **Mobil:** yatay kaydırarak şerit değiştir; yukarı kaydırarak zıpla, aşağı kaydırarak kay. Ekrandaki düğmeler de kullanılabilir.

## Özellikler

- Sonsuz şehir rotası, üç şerit ve giderek artan hız
- Trafik araçları, kasalar, bariyerler ve kayarak geçilen engeller
- Tohum/jeton toplama, mıknatıs, kalkan ve 2× skor güçlendirmeleri
- Tohumlarla açılan ve seçilebilen üç tişört görünümü
- Kalıcı rekor, toplam tohum, Türkçe karakter replikleri ve sentetik ses efektleri
- Masaüstü klavyesi ve mobil dokunmatik kontroller

## Geliştirme

Node.js 22+ ile:

```sh
npm ci
npm run dev
npm test
npm run build
```

Karakterler, arabalar, şehir cepheleri ve oyun nesneleri Three.js geometrilerinden kodla üretilir. Rekor, seçilen görünüm, açılan görünümler ve tohum cüzdanı tarayıcının `localStorage` alanında saklanır.
