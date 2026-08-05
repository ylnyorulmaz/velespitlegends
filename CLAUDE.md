# CLAUDE.md — Velespit Legends

**Claude Code** ve Claude tabanlı asistanlar için proje bağlam dosyası.

---

## Bu proje nedir?

Velespit Legends, **tarayıcı tabanlı bisiklet takım yöneticisi** simülasyonudur:

- Bisikletçi ve takım oluşturursunuz
- Taktik ve roller seçersiniz
- Yarışlar segment segment simüle edilir
- Sezon, sıralama, etap yarışları, transferler ve sakatlıklar ilerler

**Gerçek zamanlı değil** — her yarış `POST /api/races/:id/enter` ile anında simüle edilir.

---

## Stack

```
Vue 2 + Vue Router + Axios + Bootstrap 4   →  frontend/
Express 4 + Mongoose 8                     →  backend/
MongoDB                                    →  veri
Node 20+                                   →  runtime
```

Tek deploy birimi: Express `/api/*` ve `frontend/dist` statik dosyalarını sunar.

---

## İlk komutlar

```bash
git clone https://github.com/ylnyorulmaz/velespitlegends.git
cd velespitlegends

npm ci --prefix backend
npm ci --prefix frontend && npm run build --prefix frontend

# backend/.env oluştur:
# MONGODB_URI=mongodb+srv://...
# PORT=3000

npm start
# → http://localhost:3000
```

Frontend geliştirme (HMR):

```bash
# Terminal 1
cd backend && npm start          # :3000

# Terminal 2
cd frontend && npm run serve     # :8080, /api proxy
```

---

## Zihinsel model

```
Kullanıcı (Calendar.vue)
    → POST /api/races/:id/enter { teamId, cyclistIds, tactic, roles }
        → raceEngine.simulateRace()
        → injuryService (kalıcı sakatlık)
        → stageRaceService (GC güncelleme)
        → RaceResult kaydet
    → /results/:id yönlendirme
```

### Sezon kilidi

Yarışların `seasonWeek` alanı vardır. Sadece `seasonWeek <= season.currentWeek` olan yarışlara girilebilir. Hafta ilerletme: `POST /api/season/advance`.

### Etap yarışları

Yarışlar `race.stageRace` + `race.stageNumber` ile tura bağlanır. Etap N, aynı takım için etap N−1 tamamlanmadan açılmaz (`isStageUnlockedForTeam`).

### Tek tamamlama

Her takım her yarışı bir kez tamamlayabilir (`race.completedEntries`).

---

## Önce okunacak dosyalar

| Dosya | Neden |
|-------|-------|
| `backend/services/raceEngine.js` | Segment, taktik, rol, olay, puanlama |
| `backend/index.js` | Tüm API route'ları; yarış giriş orchestration |
| `backend/services/injuryService.js` | Kaza/hastalık → kalıcı sakatlık |
| `backend/services/seasonService.js` | Sezon + hafta ilerletme |
| `backend/services/stageRaceService.js` | Etap yarışı + GC |
| `backend/services/transferService.js` | İmzala/bırak + piyasa değeri |
| `frontend/src/components/Calendar.vue` | Ana oyun UI |
| `frontend/src/components/Results.vue` | Segment timeline |
| `frontend/src/assets/styles.css` | Tasarım sistemi |

---

## Veri modelleri

### Cyclist

```javascript
{
  name: String,           // required
  sprint, climb, timeTrial, endurance, teamwork: Number (1-100),
  form: Number (default 70),
  fatigue: Number (default 20),
  specialty: 'none' | 'cobbles' | 'breakaway' | 'leadout',
  age, potential, salary: Number,  // Faz 6+ için hazır
  team: ObjectId | null,
  injury: { type: 'none'|'crash'|'illness', weeksRemaining, description }
}
```

### Team

```javascript
{
  name: String,
  nationality: String,
  budget, wins, ranking, seasonPoints: Number,
  roster: [ObjectId → Cyclist],
  staff: [ObjectId → Staff]
}
```

### Race

```javascript
{
  name: String,
  date: Date,
  distance, prestige: Number,
  profile: 'flat'|'hilly'|'mountain'|'classic'|'tt',
  seasonWeek: Number,
  segments: [{ km, profile, label }],  // opsiyonel özel
  stageRace: ObjectId | null,
  stageNumber: Number | null,
  completedEntries: [{ team, result, completedAt }]
}
```

### RaceResult

Simülasyon çıktısı: `standings`, `segmentLog`, `narrative`, `tactic`, `riderRoles`, `injuriesApplied`, `formChanges`, `teamPointsEarned`.

### Season

`year`, `currentWeek`, `totalWeeks`, `status` (`active` | `completed`).

### StageRace

`gcStandings[]` — takım bazlı kümülatif puan.

### Staff

`name`, `role`, `experience`, `skillLevel`, `specialization`, `salary`, `morale`, ilişki alanları. `staffTacticBonus()` simülasyonda kullanılır.

---

## Yarış motoru cheat sheet

### Taktikler (`GET /api/tactics`)

| ID | Kısa etki |
|----|-----------|
| `balanced` | Nötr |
| `control` | Tırmanış düşme direnci |
| `attack` | Hilly/mountain/classic bonus |
| `defend` | Düşük düşme riski |
| `sprint_train` | Son düz segment bonus |
| `climb_pace` | Tırmanış bonus |

### Roller (`GET /api/roles`)

| ID | Kısa etki |
|----|-----------|
| `leader` | Final segment; max 1/takım |
| `sprinter` | Düz finish |
| `climber` | Tırmanış |
| `domestique` | Lider desteği |
| `protected` | Tırmanış düşme direnci |

### Rastgele olaylar (segment başına)

`flat_tire`, `mechanical`, `crash`, `illness`, `tailwind`, `perfect_pacing`, `second_wind`, `lucky_break`

### Puan tablosu

UCI tarzı: `[25, 20, 16, 14, 12, 10, 8, 6, 4, 2]` → `team.seasonPoints`

### Seed (determinizm)

```javascript
const roleKey = Object.values(roles).sort().join('-');
const seed = `${race._id}-${teamId}-${race.date || ''}-${tactic}-${roleKey}`;
```

Aynı girdi → aynı simülasyon sonucu.

---

## API örnekleri

### Yarışa giriş

```json
POST /api/races/:id/enter
{
  "teamId": "664...",
  "cyclistIds": ["a", "b", "c"],
  "tactic": "attack",
  "roles": { "a": "leader", "b": "domestique", "c": "sprinter" }
}
```

Min 3, max 8 bisikletçi. Sakat bisikletçiler reddedilir.

### Transfer imzala

```json
POST /api/transfers/sign
{ "teamId": "664...", "cyclistId": "665..." }
```

Bütçe ve kadro limiti `transferService` içinde kontrol edilir.

### Dinlenme günü

```json
POST /api/cyclists/rest
{ "cyclistIds": ["a", "b"] }
```

Fatigue −15, form +2 (sakat değilse).

### Etap yarışı oluştur

```json
POST /api/stage-races
{
  "name": "Tour Demo",
  "stages": [
    { "name": "Stage 1", "distance": 180, "profile": "flat", "seasonWeek": 1 },
    { "name": "Stage 2", "distance": 150, "profile": "mountain", "seasonWeek": 2 }
  ]
}
```

---

## Frontend kuralları

- **Vue 2 Options API** — `data`, `computed`, `methods`, `created`/`mounted`
- Bileşenler: `PageHeader`, `LoadingState`, `EmptyState`
- `$ui` helpers (`main.js`'de prototype'a eklenir):

```javascript
this.$ui.formatDate(date)
this.$ui.isInjured(cyclist)
this.$ui.profileBadgeClass('mountain')
this.$ui.formatMoney(team.budget)
```

- Router history mode — hash mode'a geçme (sunucu config gerekir)
- Bootstrap 4 class isimleri (Bootstrap 5 farklı)

### Rota tablosu

| Path | Component |
|------|-----------|
| `/` | HomeManagement |
| `/calendar` | Calendar |
| `/results`, `/results/:id` | Results |
| `/standings` | Standings |
| `/transfers` | TransferMarket |
| `/stage-races` | StageRaceManagement |
| `/cyclists` | CyclistManagement |
| `/teams` | TeamManagement |
| `/races` | RaceManagement |
| `/staff` | StaffManagement |

---

## Kodlama yönergeleri

1. **Minimal diff** — Çevredeki stile uy; drive-by refactor yok.
2. **Oyun mantığı backend'de** — UI sadece API çıktısını gösterir.
3. **Determinizmi koru** — `simulateRace` seed/scoring değişirse nedeni belgele.
4. **Gereksiz dependency ekleme** — Stack bilinçli olarak küçük tutulmuş.
5. **Vue değişikliği sonrası** — `npm run build --prefix frontend`
6. **PandaStack 512MB** — `frontend/dist` prebuilt commit gerekebilir.

---

## Test (framework olmadan)

```bash
# Engine smoke test
node -e "
const { simulateRace, normalizeRoles } = require('./backend/services/raceEngine');
const race = { _id: 'r1', name: 'Test', distance: 180, profile: 'flat', prestige: 50 };
const riders = [
  { _id: 'a', name: 'A', sprint: 70, climb: 70, timeTrial: 70, endurance: 70, form: 80, fatigue: 10, teamwork: 60, specialty: 'none' },
  { _id: 'b', name: 'B', sprint: 65, climb: 65, timeTrial: 65, endurance: 65, form: 75, fatigue: 15, teamwork: 70, specialty: 'none' },
  { _id: 'c', name: 'C', sprint: 60, climb: 60, timeTrial: 60, endurance: 60, form: 72, fatigue: 12, teamwork: 65, specialty: 'none' },
];
const r = simulateRace(race, riders, 'Team', {
  teamId: 't1',
  tactic: 'balanced',
  roles: normalizeRoles(['a','b','c'], { a: 'leader' }),
});
console.log('winner:', r.standings[0].name, '| segments:', r.segmentLog.length);
"

# Health check (server çalışırken)
curl -s http://localhost:3000/health

# Frontend build
npm run build --prefix frontend
```

---

## Deploy

| Yöntem | Not |
|--------|-----|
| `npm start` | `MONGODB_URI` + built `frontend/dist` gerekir |
| Docker | `docker build -t vl .` — frontend imaj içinde build |
| PandaStack | `pandastack.json`, `/health`, env dashboard |

Docker: port `9999`, `HEALTHCHECK` `/health`.

---

## Faz geçmişi

`main` branch'te **Faz 1–5** tamamlandı:

1. Core engine + kadro kuralları
2. Segment simülasyonu
3. Taktikler + rastgele olaylar + segment editörü
4. Sezon + roller + sıralama
5. Etap yarışları + transferler + sakatlıklar

UI polish (`cursor/ui-ux-polish-fd4c`, PR #12) henüz `main`'e merge edilmemiş olabilir — tasarım sistemi ve navbar bu branch'te.

---

## Kapsam dışı (kullanıcı istemedikçe)

- Vue 3 / TypeScript migration
- Gerçek zamanlı multiplayer
- Mobil native uygulama
- Auth / ödeme sistemleri
- Kapsamlı unit test coverage

---

## Takılınca

1. `backend/index.js` — ilgili route handler'ı oku
2. `backend/services/*.js` — iş mantığına in
3. Mongoose model alan adlarını doğrula (frontend eşleşmeli)
4. Frontend'de `/api/` grep yap
5. Log'da `Connected to MongoDB` kontrol et

Genel bakış: **README.md**  
Otonom agent git/PR: **AGENTS.md**
