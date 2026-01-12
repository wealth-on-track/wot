# Mobile Version Documentation

## Overview

Modern, minimal ve elegant bir mobil deneyim için tamamen ayrı bir mobil versiyonu oluşturuldu. Web versiyonundan bağımsız olarak çalışır ve mobil cihazlar için optimize edilmiştir.

## Klasör Yapısı

```
src/
├── components/mobile/          # Mobil bileşenler (WEB İLE KARIŞMAZ!)
│   ├── MobileDashboard.tsx    # Ana mobil dashboard
│   ├── MobileHeader.tsx       # Mobil header (sticky)
│   ├── MobilePortfolioSummary.tsx  # Total wealth ve allocation görünümü
│   ├── MobileAssetList.tsx    # Pozisyonlar listesi
│   ├── MobileBottomNav.tsx    # Alt navigasyon bar
│   ├── MobileAssetModal.tsx   # Asset ekleme/düzenleme modal
│   ├── MobileDesktopToggle.tsx # Desktop versiyona geçiş butonu
│   └── MobileClientWrapper.tsx # Client wrapper
├── app/
│   ├── mobile.css             # Mobil-özel stiller
│   └── [username]/mobile/     # Mobil route
│       ├── layout.tsx         # Mobil layout
│       └── page.tsx           # Mobil sayfa
└── lib/
    └── deviceDetection.ts     # Cihaz algılama utility
```

## Özellikler

### 1. Otomatik Yönlendirme
- Mobil cihazdan giriş yapıldığında otomatik olarak `/[username]/mobile` sayfasına yönlendirilir
- User agent kontrolü ile çalışır
- Cookie ile "force desktop" modu desteklenir

### 2. Mobil Tasarım Özellikleri
- **Minimal & Modern**: Gereksiz detaylar kaldırıldı
- **Touch-optimized**: 44px minimum dokunma alanları
- **Bottom Navigation**: Kolay erişim için alt navigasyon
- **Sticky Header**: Scroll sırasında header sabit kalır
- **Smooth Animations**: Native-like animasyonlar
- **Safe Area Support**: iPhone notch desteği

### 3. Ana Ekran (Overview)
- **Total Wealth**: Büyük, okunabilir şekilde gösterilir
- **Returns**: Bugün ve toplam getiri
- **Allocation Toggle**: Type/Sector arasında geçiş
- **Progress Bars**: Görsel allocation gösterimi
- **Collapsible**: Daha fazla alan için kapatılabilir

### 4. Pozisyonlar
- **Compact View**: Ana ekranda ilk 5 pozisyon
- **Full View**: Tüm pozisyonlar sayfası
- **Quick Edit**: Pozisyona tıklayarak düzenleme
- **Swipe Actions**: İleride swipe ile silme eklenebilir

### 5. Asset Modal
- **Bottom Sheet**: Alt taraftan açılan modern modal
- **Large Inputs**: Mobilde kolay kullanım
- **Touch-friendly Buttons**: Büyük butonlar
- **Smooth Animations**: Native-like geçişler

## Nasıl Değiştirilir?

### Renk Değişiklikleri
CSS değişkenleri `globals.css` dosyasında tanımlı. Mobil için özel değişken eklemek istersen:

```css
/* mobile.css içinde */
:root {
  --mobile-accent: #6366F1;
  --mobile-card-bg: #15151A;
}
```

### Component Değişiklikleri
Her mobil component `src/components/mobile/` klasöründe. Örnek:

```tsx
// MobilePortfolioSummary.tsx içinde değişiklik yap
// WEB versiyonunu ETKİLEMEZ!
```

### Yeni Özellik Eklemek

1. **Yeni View Eklemek**:
```tsx
// MobileDashboard.tsx içinde
type View = 'overview' | 'positions' | 'add' | 'YENİ_VIEW';

// MobileBottomNav.tsx içinde yeni buton ekle
const navItems = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'positions', label: 'Positions', icon: '💼' },
  { id: 'YENİ_VIEW', label: 'Yeni', icon: '🎯' },
];
```

2. **Yeni Modal Eklemek**:
```tsx
// Yeni file: MobileYeniModal.tsx
// MobileAssetModal.tsx'i kopyala ve düzenle
```

3. **API Entegrasyonu**:
```tsx
// MobileAssetModal.tsx içinde
const handleSubmit = async () => {
  // API çağrısı yap
  await fetch('/api/portfolio/assets', {
    method: 'POST',
    body: JSON.stringify(formData)
  });
};
```

## Stil Rehberi

### Typography
- **Heading 1**: 2.25rem, 900 weight (Total Wealth)
- **Heading 2**: 1.5rem, 800 weight (Section başlıkları)
- **Body**: 0.9rem, 700-800 weight
- **Caption**: 0.7rem, 600-700 weight

### Spacing
- **Card padding**: 1.5rem
- **List item padding**: 1rem 1.25rem
- **Button padding**: 1rem
- **Gap between sections**: 1rem

### Border Radius
- **Cards**: 1.25rem (20px)
- **Inputs/Buttons**: 12px
- **Small elements**: 8px

### Colors
Tüm renkler CSS değişkenlerinden gelir:
- `var(--bg-main)`: Ana arkaplan
- `var(--bg-primary)`: Card arkaplan
- `var(--bg-secondary)`: İkinci seviye
- `var(--text-primary)`: Ana text
- `var(--text-muted)`: İkincil text
- `var(--accent)`: Vurgu rengi (indigo)
- `var(--success)`: Yeşil (pozitif)
- `var(--danger)`: Kırmızı (negatif)

## Performance Tips

1. **Lazy Loading**: Büyük listeler için virtualization ekle
2. **Image Optimization**: Asset logo'ları optimize et
3. **Bundle Size**: Sadece gerekli componentleri import et
4. **Animations**: 60fps için transform ve opacity kullan

## Gelecek İyileştirmeler

- [ ] Swipe to delete asset
- [ ] Pull to refresh
- [ ] Offline support
- [ ] PWA manifest
- [ ] Push notifications
- [ ] Haptic feedback
- [ ] Dark mode variants
- [ ] Language support
- [ ] Charts/graphs için mobile-optimized versiyonlar
- [ ] Fingerprint/Face ID authentication

## Test Etme

### Tarayıcıda Test
1. Chrome DevTools aç (F12)
2. Device toolbar'ı aç (Ctrl+Shift+M)
3. iPhone/Android cihaz seç
4. User agent'ı mobil olarak ayarla
5. Refresh yap

### Gerçek Cihazda Test
1. Local network'te IP adresini al
2. `http://YOUR_IP:3000` adresine git
3. Mobil cihazdan eriş

## Sorun Giderme

### Mobil versiyona yönlendirilmiyor
- User agent kontrolünü kontrol et
- `forceDesktop` cookie'sini temizle
- Browser cache'i temizle

### Stil bozuk görünüyor
- `mobile.css` import edildiğinden emin ol
- CSS değişkenleri tanımlı mı kontrol et
- Dark/Light mode geçişini test et

### Component render olmuyor
- Client/Server component ayrımını kontrol et
- "use client" directive'i eklenmiş mi?
- Import path'leri doğru mu?

## Önemli Notlar

⚠️ **WEB VERSİYONU İLE KARIŞMA!**
- Mobil componentler tamamen ayrı klasörde
- Web componentlerini değiştirmek mobili etkilemez
- Ortak kodlar `src/lib/` içinde

⚠️ **RESPONSIVE DEĞİL, AYRI BİR VERSİYON**
- Bu responsive design değil
- Tamamen ayrı bir mobil deneyim
- Tablet'ler için ayrı bir versiyon düşünülebilir

⚠️ **STATE YÖNETİMİ**
- Her component kendi state'ini yönetir
- Global state gerekirse Context API kullan
- Server State için React Query düşün

## Katkıda Bulunma

Mobil versiyonu geliştirirken:
1. `src/components/mobile/` içinde çalış
2. Web versiyonunu etkileme
3. TypeScript type safety'i koru
4. Accessibility'i unutma (aria labels, etc.)
5. Performance'ı düşünme (lazy load, memoize)

---

**Son Güncelleme**: 2026-01-10
**Versiyon**: 1.0.0
**Geliştirici**: Claude Code + Sen
