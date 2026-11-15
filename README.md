# Kırıntı Peşinde — Hamam Kaçağı

Eski bir hamamda geçen, tarayıcıda çalışan 3D sonsuz koşu oyunu. Küçük bir hamam böceğini yönlendir; sabunlardan zıpla, boruların altından kay, kovaların çevresinden dolaş ve altın kırıntıları topla.

## Oyna

GitHub Pages yayını: `https://keykavus324-svg.github.io/Hamam-b-ce-i-surfers/`

## Kontroller

- **← / →** veya **A / D:** şerit değiştir
- **↑ / W / Space:** zıpla
- **↓ / S:** kay
- **P / Esc:** duraklat / devam et
- **Dokunmatik:** sola/sağa kaydır; yukarı kaydırarak zıpla, aşağı kaydırarak kay. Ekrandaki düğmeler de kullanılabilir.

## Geliştirme

Node.js 22+ ile:

```sh
npm ci
npm run dev
```

Mantık testleri ve üretim derlemesi:

```sh
npm test
npm run build
```

Oyun Three.js r187 ve Vite ile oluşturulmuştur. Karakter, hamam mimarisi ve oyun nesneleri Three.js geometrilerinden kodla üretilir; harici görsel/ses dosyası veya servis gerektirmez. Rekor tarayıcının `localStorage` alanında saklanır.

## Yayın

`.github/workflows/pages.yml` testleri çalıştırıp Vite çıktısını GitHub Pages'e dağıtır.
