# CLAUDE.md — Velespit Legends

**Claude Code** ve Claude tabanlı asistanlar için proje bağlam dosyası.

İnsan odaklı genel bakış: **README.md**  
Otonom agent git/PR kuralları: **AGENTS.md**

---

## Bu proje nedir?

Velespit Legends, **tarayıcı tabanlı bisiklet takım yöneticisi** simülasyonudur:

- Bisikletçi ve takım oluşturursunuz
- Taktik ve roller seçersiniz
- Yarışlar segment segment simüle edilir (gerçek zamanlı değil)
- Sezon, sıralama, etap yarışları, transferler ve sakatlıklar ilerler

Ana döngü: Calendar → `POST /api/races/:id/enter` → `raceEngine.simulateRace()` → sakatlık/GC → Results.

---

## Stack

```
Vue 2 + Vue Router + Axios + Bootstrap 4   →  frontend/
Express 4 + Mongoose 8                     →  backend/
MongoDB                                    →  veri
Node 20+                                   →  runtime
```

Tek deploy birimi: Express `/api/*` ve (varsa) `frontend/dist` sunar.

---

## İlk komutlar

```bash
git clone https://github.com/ylnyorulmaz/velespitlegends.git
cd velespitlegends

npm ci --prefix backend
npm ci --prefix frontend && npm run build --prefix frontend

# backend/.env:
# MONGODB_URI=mongodb+srv://.../cycling_management?retryWrites=true&w=majority
# PORT=3000

npm start
# → http://localhost:3000
```

Frontend HMR:

```bash
cd backend && npm start          # :3000
cd frontend && npm run serve     # :8080, /api → :3000
```

---

## Zihinsel model

```
Kullanıcı (Calendar.vue)
    → POST /api/races/:id/enter { teamId, cyclistIds, tactic, roles }
        → season / stage / injury / roster doğrulamaları
        → boş name onarımı (legacy docs)
        → raceEngine.simulateRace(seed, tactic, roles, staffBonus)
        → injuryService (crash/illness → kalıcı sakatlık)
        → form/fatigue updateOne
        → RaceResult.create (segmentLog + randomEvents)
        → stageRaceService GC (varsa)
    → /results/:id
```

### Kilitlemeler

| Kural | Detay |
|-------|--------|
| Sezon | `race.seasonWeek <= season.currentWeek` |
| Tek tamamlama | `race.completedEntries` — takım başına bir kez |
| Etap sırası | Etap N, aynı takım için N−1 bitmeden açılmaz |
| Kadro | Roster doluysa tüm seçilenler kadroda olmalı; 3–8 rider |
| Sakatlık | `injury.type !== 'none'` ve `weeksRemaining > 0` → start yok |

---

## Önce okunacak dosyalar

| Dosya | Neden |
|-------|-------|
| `backend/services/raceEngine.js` | Segment, taktik, rol, olay, puanlama |
| `backend/index.js` | Tüm API + enter orchestration |
| `backend/models/RaceResult.js` | `randomEvents` şema tuzağı notu |
| `backend/services/injuryService.js` | Kalıcı sakatlık |
| `backend/services/seasonService.js` | Hafta ilerletme |
| `backend/services/stageRaceService.js` | Etap + GC |
| `backend/services/transferService.js` | İmzala/bırak |
| `frontend/src/components/Calendar.vue` | Ana oyun UI |
| `frontend/src/components/Results.vue` | Segment timeline |
| `frontend/src/assets/styles.css` | Tasarım sistemi |

---

## Kritik gotcha: Mongoose `type`

Alt dokümanda alan adı `type` ise:

```js
// YANLIŞ — dizi [String] olur
randomEvents: [{ type: String, message: String }]

// DOĞRU
randomEvents: [{ type: { type: String }, message: { type: String } }]
```

Aksi halde enter sırasında:  
`RaceResult validation failed: ... Cast to [string] failed ... randomEvents.0`

`injuriesApplied[].type` ve `Cyclist.injury.type` aynı kurala uyar (`injury.type` zaten `{ type: String }` ile yazılmış).

---

## Veri modelleri (özet)

### Cyclist

```javascript
{
  name: String,           // required — boşsa API "Rider <id>" yazar
  sprint, climb, timeTrial, endurance, teamwork: Number (1-100),
  form: Number (default 70),
  fatigue: Number (default 20),
  specialty: 'none' | 'cobbles' | 'breakaway' | 'leadout',
  age, potential, salary: Number,
  team: ObjectId | null,
  injury: { type: 'none'|'crash'|'illness', weeksRemaining, description }
}
```

### Team

`name`, `nationality`, `budget`, `wins`, `ranking`, `seasonPoints`, `roster[]`, `staff[]`

### Race

`profile`: flat|hilly|mountain|classic|tt  
`segments[]` opsiyonel; `seasonWeek`; `stageRace`/`stageNumber`; `completedEntries[]`

### RaceResult

`standings`, `segmentLog` (events + **randomEvents** objects), `narrative`, `tactic`, `riderRoles`, `injuriesApplied`, `formChanges`, `teamPointsEarned`

### Season / StageRace / Staff

Season: `year`, `currentWeek`, `totalWeeks` (30), `status`  
StageRace: `gcStandings[]`  
Staff: skill alanları → `staffTacticBonus()`

---

## Yarış motoru cheat sheet

### Taktikler

| ID | Etki |
|----|------|
| `balanced` | Nötr |
| `control` | Tırmanış düşme direnci |
| `attack` | Hilly/mountain/classic bonus |
| `defend` | Düşük düşme riski |
| `sprint_train` | Son düz segment bonus |
| `climb_pace` | Tırmanış bonus |

### Roller

| ID | Etki |
|----|------|
| `leader` | Final segment; max 1/takım |
| `sprinter` | Düz finish |
| `climber` | Tırmanış |
| `domestique` | Lider desteği + ekstra yorgunluk |
| `protected` | Tırmanış düşme direnci |

### Rastgele olaylar

`flat_tire`, `mechanical`, `crash`, `illness`, `tailwind`, `perfect_pacing`, `second_wind`, `lucky_break`  
(crash/illness → `injuryService`)

### Puanlar

`[25, 20, 16, 14, 12, 10, 8, 6, 4, 2]` → `team.seasonPoints`

### Seed

```javascript
const roleKey = Object.values(roles).sort().join('-');
const seed = `${race._id}-${teamId}-${race.date || ''}-${tactic}-${roleKey}`;
// injuries: `${seed}-injuries`
```

---

## Form / fatigue

| Olay | Etki |
|------|------|
| Yarış bitişi | Pozisyona göre form ± ; mesafe bazlı fatigue ↑ |
| Rest day `POST /api/cyclists/rest` | fatigue −15, form +2 |
| Week advance | fatigue −5, form +1 + **payroll** + **development** + injury tick |
| Injury apply | form −8 (crash) / −4 (illness) |
| Payroll | season salary / `totalWeeks` bütçeden; yetmezse roster form −2 |
| Development | genç+potential → skill↑; 33+ → skill↓ (`developmentService.js`) |

Enter sonrası form/fatigue **`Cyclist.updateOne`** ile yazılır. Test: `npm test --prefix backend`.

---

## Frontend kuralları

- Vue **2** Options API
- Bootstrap **4** class isimleri
- `$ui` helpers: `formatDate`, `isInjured`, `profileBadgeClass`, `formatMoney`, …
- Ortak: `PageHeader`, `LoadingState`, `EmptyState`
- History mode router — hash'e geçme
- Dev: webpack `:8080`, proxy `/api` → `:3000`
- Prod: Express SPA fallback `frontend/dist/index.html`

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

1. Minimal diff; drive-by refactor yok.
2. Oyun mantığı backend'de kalsın.
3. Seed/scoring değişirse nedeni belgele.
4. Yeni nested şemada alan adı `type` ise `{ type: String }` kullan.
5. Vue değişince `npm run build --prefix frontend`.
6. Secret / `.env` commit etme.
7. `/health` kaldırma.

---

## Testler

```bash
npm test --prefix backend              # unit + feature (59+)
npm run test:unit --prefix backend     # DB yok
npm run test:feature --prefix backend  # mongodb-memory-server
npm run test:smoke --prefix backend    # legacy quick smoke

curl -s http://localhost:3000/health
npm run build --prefix frontend
```

Layout: `backend/test/unit/*.test.js`, `backend/test/feature/*.test.js` (Node `node:test`).  
`index.js` exports `{ app, connectDb }` for HTTP tests; listen only when `require.main === module`.

---

## Deploy

| Yöntem | Not |
|--------|-----|
| `npm start` | `MONGODB_URI` + built `frontend/dist` |
| Docker | Multi-stage; port `9999`; HEALTHCHECK `/health` |
| PandaStack | `pandastack.json`; root `build` sadece backend deps |

Root `.gitignore` `dist/` içerir — ücretsiz tier prebuilt dist isterse deploy notuna bakın.

---

## Faz geçmişi

Faz 1–5 `main`'de: core engine → segmentler → taktik/olay → sezon/roller → etap/transfer/sakatlık.  
UI polish (tasarım sistemi, navbar) PR geçmişine bakın.

Kapsam dışı (istenmedikçe): Vue 3, multiplayer, auth, native mobil, büyük test suite.

---

## Takılınca

1. `backend/index.js` — route handler
2. `backend/services/*.js` — iş mantığı
3. `RaceResult` / `Cyclist` şema alan adları (özellikle `type`)
4. Frontend `/api/` grep
5. Log: `Connected to MongoDB`
