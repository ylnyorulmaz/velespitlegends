# Velespit Legends

Metin tabanlı bisiklet takım yönetimi simülasyonu. Kadro kurun, taktik ve bisikletçi rolleri atayın, sezon boyunca yarışın, puan tablosunda yükselin — segment segment simülasyon, rastgele olaylar, etap yarışları ve transfer pazarı ile.

**Repository:** [github.com/ylnyorulmaz/velespitlegends](https://github.com/ylnyorulmaz/velespitlegends)

---

## Özellikler

| Alan | Açıklama |
|------|----------|
| **Yarış motoru** | Seed'li RNG, profil bazlı puanlama, düşme mantığı, specialty bonusları |
| **Taktikler** | 6 takım taktiği (balanced, control, attack, defend, sprint train, climb pace) |
| **Bisikletçi rolleri** | Leader, sprinter, climber, domestique, protected — yarış başına atama |
| **Rastgele olaylar** | Patlak, mekanik arıza, kaza, hastalık, rüzgar, second wind vb. |
| **Sezon döngüsü** | Hafta bazlı takvim; hafta ilerletince iyileşme ve sakatlık iyileşmesi |
| **Etap yarışları** | Çok etaplı turlar, GC (genel klasman) |
| **Transferler** | Serbest oyuncu imzalama / bırakma (bütçe + piyasa değeri) |
| **Sakatlıklar** | Kaza/hastalık sonrası çok haftalık sakatlık — yarışa çıkamaz |
| **Yönetim** | Takım, bisikletçi, personel, özel segment editörü, kadro/personel ataması |
| **Race day (CM)** | Segment segment radyo anlatımı; yarış ortasında taktik değiştirme |

---

## Tech stack

| Katman | Teknoloji |
|--------|-----------|
| Frontend | Vue 2, Vue Router, Axios, Bootstrap 4, Webpack 5 |
| Backend | Node.js 20+, Express 4, Mongoose 8 |
| Veritabanı | MongoDB (Atlas veya yerel) |
| Deploy | Docker, PandaStack/Koyeb uyumlu (`/health`, prebuilt veya Docker frontend) |

---

## Proje yapısı

```
velespitlegends/
├── backend/
│   ├── index.js              # Express uygulaması + API + statik frontend
│   ├── models/               # Mongoose şemaları
│   │   ├── Cyclist.js
│   │   ├── Team.js
│   │   ├── Staff.js
│   │   ├── Race.js
│   │   ├── RaceResult.js
│   │   ├── Season.js
│   │   └── StageRace.js
│   └── services/
│       ├── raceEngine.js     # Simülasyon çekirdeği (segment, taktik, olay)
│       ├── seasonService.js
│       ├── injuryService.js
│       ├── stageRaceService.js
│       └── transferService.js
├── frontend/
│   ├── src/
│   │   ├── components/       # Vue sayfa bileşenleri
│   │   ├── router/
│   │   ├── utils/ui.js       # Ortak formatlama yardımcıları ($ui)
│   │   └── assets/styles.css # Tasarım sistemi (CSS değişkenleri)
│   ├── public/index.html
│   └── dist/                 # Production build (backend tarafından sunulur)
├── Dockerfile
├── pandastack.json
├── AGENTS.md                 # Cursor / otonom agent talimatları
├── CLAUDE.md                 # Claude Code bağlam dosyası
└── package.json              # Root: npm start → backend
```

---

## Hızlı başlangıç (yerel)

### Gereksinimler

- Node.js **20+**
- MongoDB (yerel veya [MongoDB Atlas](https://www.mongodb.com/atlas))

### 1. Klonla ve kur

```bash
git clone https://github.com/ylnyorulmaz/velespitlegends.git
cd velespitlegends

npm ci --prefix backend
npm ci --prefix frontend
npm run build --prefix frontend
```

### 2. Ortam değişkenleri

`backend/.env` oluşturun:

```env
MONGODB_URI=mongodb+srv://USER:PASS@cluster.mongodb.net/velespitlegends
PORT=3000
```

Atlas kullanıyorsanız **Network Access** ayarından IP'nize izin verin (geliştirme için `0.0.0.0/0`).

### 3. Çalıştır

```bash
npm start
```

Tarayıcı: **http://localhost:3000**

### Geliştirme modu (frontend hot reload)

Terminal 1 — API:

```bash
cd backend && npm start
```

Terminal 2 — Webpack dev server (`/api` → `:3000` proxy):

```bash
cd frontend && npm run serve
```

Tarayıcı: **http://localhost:8080**

---

## Docker

```bash
docker build -t velespitlegends .
docker run -p 9999:9999 \
  -e MONGODB_URI="mongodb+srv://..." \
  velespitlegends
```

Sağlık kontrolü: `GET /health` → `{ "status": "ok" }`

Docker imajı frontend'i multi-stage build ile derler; ayrıca `npm run build --prefix frontend` gerekmez.

---

## Deployment (PandaStack / benzeri)

Root `package.json`:

- `build` — backend production bağımlılıklarını kurar
- `start` — `node backend/index.js` çalıştırır

`pandastack.json` → `/health` health check.

**512MB ücretsiz tier** için repoda prebuilt `frontend/dist` commit'lenmiş olmalı (platform webpack build'i atlar).

| Değişken | Zorunlu | Varsayılan |
|----------|---------|------------|
| `MONGODB_URI` | Evet (production) | `mongodb://localhost/cycling_management` |
| `PORT` | Hayır | `3000` (Docker: `9999`) |

---

## Oyun akışı

1. **Kurulum** — Bisikletçi, takım, personel ve yarış (veya etap yarışı) oluşturun.
2. **Transfer** — Serbest oyuncuları imzalayın; Teams sayfasında kadro ve personel atayın.
3. **Takvim** — Takım, yarış, taktik, 3–8 bisikletçi + roller → **Enter race**.
4. **Sonuçlar** — Segment zaman çizelgesi, rastgele olaylar, sıralama, sakatlıklar, form değişimleri.
5. **Sezon** — Takvim'de **Advance week**; yarışlar `seasonWeek` ile açılır.
6. **Etap yarışları** — Etapları sırayla tamamlayın; GC otomatik güncellenir.

### İlk oyun önerisi

1. `/cyclists` — 5–8 bisikletçi oluşturun (sprint/climb/endurance dağılımı).
2. `/teams` — Takım oluşturup kadroya ekleyin.
3. `/staff` — 1–2 personel ekleyin, takıma atayın.
4. `/races` — Düz veya dağlık profilli bir yarış oluşturun (`seasonWeek: 1`).
5. `/calendar` — Yarışa girin, sonuçları `/results` üzerinden inceleyin.

---

## Veri modelleri

### Cyclist (bisikletçi)

| Alan | Tip | Açıklama |
|------|-----|----------|
| `name` | String | Zorunlu |
| `sprint`, `climb`, `timeTrial`, `endurance`, `teamwork` | Number 1–100 | Yetenekler |
| `form`, `fatigue` | Number | Form ve yorgunluk |
| `specialty` | enum | `none`, `cobbles`, `breakaway`, `leadout` |
| `age`, `potential`, `salary` | Number | Henüz tam kullanılmıyor (Faz 6+) |
| `team` | ObjectId | Takım referansı |
| `injury` | subdoc | `type`, `weeksRemaining`, `description` |

### Team

| Alan | Açıklama |
|------|----------|
| `name`, `nationality` | Takım kimliği |
| `budget` | Transfer bütçesi |
| `seasonPoints`, `wins`, `ranking` | Sezon istatistikleri |
| `roster[]` | Bisikletçi referansları |
| `staff[]` | Personel referansları |

### Race

| Alan | Açıklama |
|------|----------|
| `profile` | `flat`, `hilly`, `mountain`, `classic`, `tt` |
| `distance`, `prestige`, `seasonWeek` | Yarış parametreleri |
| `segments[]` | Opsiyonel özel segmentler (`km`, `profile`, `label`) |
| `stageRace`, `stageNumber` | Etap yarışı bağlantısı |
| `completedEntries[]` | Takım başına bir kez tamamlanır |

### RaceResult

Simülasyon çıktısı: `standings[]`, `segmentLog[]`, `narrative[]`, `tactic`, `riderRoles[]`, `injuriesApplied[]`, `formChanges[]`, `teamPointsEarned`.

### Season

`year`, `currentWeek`, `totalWeeks`, `status` (`active` | `completed`).

### StageRace

`gcStandings[]` — takım bazlı kümülatif etap puanları.

---

## API özeti

Base URL: `/api` (JSON)

### Oyun

| Method | Path | Açıklama |
|--------|------|----------|
| `POST` | `/races/:id/enter` | Yarış simülasyonu |
| `GET` | `/results`, `/results/:id` | Sonuç listesi / detay |
| `GET` | `/tactics`, `/roles` | Taktik ve rol metadata |
| `GET` | `/season` | Aktif sezon |
| `POST` | `/season/advance` | Hafta ilerlet (+ iyileşme) |
| `GET` | `/standings` | Takım ve bisikletçi sıralaması |
| `GET` | `/dashboard` | Ana sayfa özeti |

### Yönetim

| Method | Path | Açıklama |
|--------|------|----------|
| `GET/POST` | `/cyclists` | Listele / oluştur |
| `POST` | `/cyclists/rest` | Dinlenme günü: `{ cyclistIds[] }` |
| `GET/POST` | `/teams` | Listele / oluştur |
| `PUT` | `/teams/:id` | Kadro, personel, bütçe güncelle |
| `GET/POST` | `/staff` | Personel CRUD |
| `GET/POST` | `/races` | Yarış listele / oluştur |
| `PUT` | `/races/:id` | Yarış düzenle (segment dahil) |

### Faz 5

| Method | Path | Açıklama |
|--------|------|----------|
| `GET` | `/transfers/market` | Serbest oyuncular + piyasa değeri |
| `POST` | `/transfers/sign` | `{ teamId, cyclistId }` |
| `POST` | `/transfers/release` | `{ teamId, cyclistId }` |
| `GET/POST` | `/stage-races` | Etap yarışı listele / oluştur |
| `GET` | `/stage-races/:id` | Tur detayı + etaplar + GC |

### Yarışa giriş örneği

```http
POST /api/races/664a1b2c3d4e5f6789012345/enter
Content-Type: application/json

{
  "teamId": "664a1b2c3d4e5f6789012346",
  "cyclistIds": ["id1", "id2", "id3"],
  "tactic": "attack",
  "roles": {
    "id1": "leader",
    "id2": "domestique",
    "id3": "sprinter"
  }
}
```

**Doğrulamalar:** 3–8 bisikletçi; takımın kadrosu doluysa hepsi kadroda olmalı; sakat olmamalı; `seasonWeek <= currentWeek`; etap sırası açık; takım daha önce tamamlamamış olmalı.

**Yanıt:** `201` + populate edilmiş `RaceResult` (race, team, riders) — `segmentLog`, `narrative`, `formChanges`, `injuriesApplied` dahil.

**Not:** Enter sırasında boş `name`’li bisikletçiler `Rider <id>` ile onarılır; form/fatigue `updateOne` ile yazılır (tam doküman validasyonunu atlar).

---

## Yarış motoru (özet)

- **Segmentler:** `profile`'a göre otomatik veya `race.segments[]` ile özel.
- **RNG:** Seed = `raceId-teamId-date-tactic-roleHash` — aynı girdi → aynı sonuç.
- **Puanlama:** Segment skill + form − fatigue + taktik/rol bonusları + personel bonusu.
- **Düşme:** Hilly/mountain segmentlerde skor peloton ortalamasının altına düşerse.
- **Puanlar:** UCI tarzı `[25, 20, 16, 14, 12, 10, 8, 6, 4, 2]` → `team.seasonPoints`.
- **Yarış sonrası:** Form/fatigue güncellenir; kaza/hastalık → çok haftalık sakatlık.

Detaylı mantık: `backend/services/raceEngine.js`

### Taktikler

| ID | Etki |
|----|------|
| `balanced` | Nötr |
| `control` | Tırmanışlarda düşme direnci |
| `attack` | Hilly/mountain/classic bonus |
| `defend` | Düşük düşme riski, düzde hafif ceza |
| `sprint_train` | Son düz segmentte büyük bonus |
| `climb_pace` | Hilly/mountain bonus |

### Roller

| ID | Etki |
|----|------|
| `leader` | Final segment bonus; takımda max 1 |
| `sprinter` | Düz finish bonus |
| `climber` | Tırmanış bonus |
| `domestique` | Lideri destekler, ekstra yorgunluk |
| `protected` | Tırmanışlarda düşme direnci |

---

## Frontend rotaları

| Path | Sayfa | Bileşen |
|------|-------|---------|
| `/` | Dashboard | `HomeManagement.vue` |
| `/calendar` | Takvim / yarış girişi | `Calendar.vue` |
| `/results`, `/results/:id` | Sonuçlar | `Results.vue` |
| `/standings` | Puan durumu | `Standings.vue` |
| `/transfers` | Transfer pazarı | `TransferMarket.vue` |
| `/stage-races` | Etap yarışları | `StageRaceManagement.vue` |
| `/cyclists` | Bisikletçi yönetimi | `CyclistManagement.vue` |
| `/teams` | Takım + kadro | `TeamManagement.vue` |
| `/races` | Yarış + segment editörü | `RaceManagement.vue` |
| `/staff` | Personel | `StaffManagement.vue` |

### UI yardımcıları

`frontend/src/utils/ui.js` → Vue prototype'da `$ui`:

- `formatDate`, `formatDateTime`, `formatMoney`
- `isInjured`, `injuryLabel`
- `profileBadgeClass`, `profileLabel`, `statBarWidth`
- `formatDelta`, `deltaClass`

Ortak bileşenler: `PageHeader`, `EmptyState`, `LoadingState`.

Tasarım sistemi: `frontend/src/assets/styles.css` (CSS custom properties, DM Sans font).

---

## Geliştirme fazları (geçmiş)

| Faz | Odak |
|-----|------|
| Faz 1 | Seed RNG, personel bonusu, kadro kuralları |
| Faz 2 | Segment simülasyonu, sonuç timeline |
| Faz 3 | Takım taktikleri, rastgele olaylar, segment editörü |
| Faz 4 | Sezon haftaları, bisikletçi rolleri, sıralama, kadro UI |
| Faz 5 | Etap yarışları, transferler, kalıcı sakatlıklar |
| UI polish | Tasarım sistemi, navbar, paylaşılan bileşenler (PR #12) |

---

## Sezon ekonomisi ve gelişim (Faz 6)

Hafta ilerletince (`POST /api/season/advance` / Calendar → **Advance week**):

1. **İyileşme** — tüm bisikletçiler fatigue −5, form +1  
2. **Maaş** — kadro + personel season salary / `totalWeeks` kadar bütçeden düşülür; bütçe yetmezse form −2  
3. **Gelişim** — genç + yüksek potential → skill +1 şansı; 33+ → skill −1 şansı  
4. **Sakatlık tick** — mevcut recovery devam eder  

Testler (`npm test --prefix backend`):

| Komut | Ne |
|-------|-----|
| `npm test --prefix backend` | Unit + feature (Node `node:test`, in-memory Mongo) |
| `npm run test:unit --prefix backend` | DB yok — raceEngine, development, injury, GC formatters |
| `npm run test:feature --prefix backend` | Enter race, season, transfers, schema, rivals |
| `npm run test:smoke --prefix backend` | Eski hızlı smoke (DB yok) |

## Çok takımlı yarış

Yarışa girince kadrosu olan diğer takımlar otomatik pelotona katılır (`pelotonService` → en fazla 5 takım, takım başına ~6 rider). AI takımlar profile göre taktik/rol seçer, puan ve form alır, `completedEntries`'e yazılır. Calendar'da rival preview; Results'ta team classification.

`GET /api/races/:id/rivals?teamId=...`

## Zaman bazlı etap GC

Stage race GC **kümülatif süre** ile sıralanır (en düşük zaman kazanır). Her etapta takımın en iyi bisikletçisinin süresi GC'ye eklenir; stage points yedek kırılım. Results'ta Time/Gap; Stage Races sayfasında GC time + gap.

## Sezon sonu özeti

Son hafta ilerleyince (veya sezon `completed` olunca) `GET /api/season/summary`: şampiyon, bütçe lideri, en çok gelişen/düşen rider'lar, top scorer'lar. Calendar ve Home'da gösterilir.

## Bilinen sınırlamalar / gelecek iş

- Bireysel (sarı mayo) GC yok — GC takım bazlı
- Sezon reset / yeni sezon başlatma UI'sı yok
- Root `.gitignore` `dist/` içerir — PandaStack ücretsiz tier prebuilt `frontend/dist` istiyorsa deploy için dist'i ayrıca yönetin / ignore kuralını gözden geçirin
- `dotenv` paketi yok; `backend/index.js` `.env`'yi elle okur

---

## Sorun giderme

| Belirti | Olası neden | Çözüm |
|---------|-------------|-------|
| Boş sayfa | `frontend/dist` yok | `npm run build --prefix frontend` |
| MongoDB hatası | Yanlış URI / IP engeli | `.env` ve Atlas Network Access |
| Yarışa giremiyorum | Hafta / sakatlık / etap sırası / kadro | API hata mesajını okuyun |
| `Cast to [string] failed` on `randomEvents` | Mongoose `type` alanı tuzağı | `RaceResult` şemasında `type: { type: String }` kullanın (aşağıya bakın) |
| `Cyclist validation failed: name` | Eski/boş isimli kayıt | Liste/enter sırasında isim onarılır; kartlarda `Rider xxxx` görebilirsiniz |
| Bisikletçi kartında isim yok | DB'de boş `name` | Sayfayı yenileyin (`GET /api/cyclists` onarır) |
| 502 deploy | PORT / health | `GET /health`, env değişkenleri |
| CORS (dev) | Doğrudan dosya açma | Webpack dev server `:8080` kullanın |

### Mongoose `type` alanı tuzağı

Alt dokümanda alan adı `type` ise **asla** şunu yazmayın:

```js
randomEvents: [{ type: String, kind: String, message: String }]
```

Mongoose bunu “dizi elemanı String” sanır → `Cast to [string] failed` (Proxy/object). Doğrusu:

```js
randomEvents: [{
  type: { type: String },
  kind: { type: String },
  message: { type: String },
  // ...
}]
```

Aynı kural `injuriesApplied[].type` ve `Cyclist.injury.type` için de geçerli.

---

## Lisans

ISC (`backend/package.json`). Detaylar için repo sahibine bakın.

---

## Katkı

1. `main`'den branch: `cursor/<feature-name>-fd4c`
2. Backend/frontend değişikliklerini odaklı tutun
3. Deploy için frontend rebuild: `npm run build --prefix frontend`
4. `GET /health` → 200 dönmeye devam etmeli

AI destekli geliştirme için **AGENTS.md** (Cursor agent) ve **CLAUDE.md** (Claude Code) dosyalarına bakın.
