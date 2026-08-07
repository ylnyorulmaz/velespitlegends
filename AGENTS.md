# AGENTS.md — Velespit Legends

**Cursor Cloud Agents**, Codex ve diğer otonom kod agent'ları için bu repoda çalışma talimatları.

İnsan / ürün özeti: **README.md**  
Claude Code bağlamı: **CLAUDE.md**

---

## Proje özeti

**Velespit Legends** tek repoda full-stack bisiklet yönetimi simülasyonu:

| Katman | Konum | Not |
|--------|-------|-----|
| Backend | `backend/` | Express + Mongoose; `index.js` = API + (varsa) `frontend/dist` |
| Frontend | `frontend/src/` | Vue 2 SPA, history mode |
| Veritabanı | MongoDB | Atlas veya local; `backend/.env` → `MONGODB_URI` |

**Testler:** `npm test --prefix backend` (Node `node:test`; unit DB-free, feature = mongodb-memory-server). Ayrıca `test:unit` / `test:feature` / `test:smoke`. Frontend: `npm run build --prefix frontend`.

---

## Kritik dosya haritası

```
backend/index.js                 # Tüm REST route'ları — API değişikliğinde başla
backend/services/raceEngine.js   # Simülasyon çekirdeği
backend/services/seasonService.js
backend/services/injuryService.js
backend/services/stageRaceService.js
backend/services/transferService.js
backend/models/RaceResult.js     # randomEvents şema — type tuzağına dikkat
backend/models/*.js
backend/test/unit|feature/       # node:test suite
frontend/src/components/*.vue    # Her dosya ≈ bir sayfa
frontend/src/router/index.js
frontend/src/utils/ui.js         # $ui helpers
frontend/src/assets/styles.css
frontend/webpack.config.js       # Dev :8080, /api → :3000
Dockerfile
pandastack.json
```

---

## Git, branch ve PR

| Kural | Değer |
|-------|-------|
| Base | `main` |
| Feature branch | `cursor/<descriptive-name>-fd4c` |
| Push | `git push -u origin HEAD` (kullanıcı isterse) |
| Commit | Kullanıcı açıkça istemeden commit/push yok |

### Commit mesajı örneği

```
Fix RaceResult randomEvents CastError

- Nest mongoose type fields as { type: String }
- Persist form/fatigue with updateOne
```

---

## Ortam değişkenleri

| Değişken | Amaç |
|----------|------|
| `MONGODB_URI` | Mongo bağlantısı (production zorunlu) |
| `PORT` | HTTP port (`3000` local; Docker `9999`) |

- Yerel: `backend/.env` (gitignore'da; elle parse, dotenv paketi yok)
- **Asla** credential commit etme (`atlas-credentials.env` da ignore)

---

## Sık komutlar

```bash
npm ci --prefix backend
npm ci --prefix frontend && npm run build --prefix frontend
npm start                              # :3000 API + SPA (dist varsa)

cd backend && npm start                # sadece API
cd frontend && npm run serve           # :8080 HMR

# Tests
npm test --prefix backend              # unit + feature
npm run test:unit --prefix backend     # no DB

curl -s http://localhost:3000/health
```

---

## Mimari kurallar

### Yarış simülasyonu

1. **Determinizm** — Seed'i bilinçsiz bozma:
   - `` `${race._id}-${teamId}-${race.date}-${tactic}-${roleKey}` ``
   - Injury RNG: `` `${seed}-injuries` ``
2. Segment: `buildSegments` → `resolveSegment` → `rollRandomEvents`
3. Roller: max **1 leader** (`normalizeRoles`)
4. Rakipler prosedürel (`RIVAL_NAMES`); diğer DB takımları yarışmaz

### Enter pipeline (`POST /api/races/:id/enter`)

```
Race/Team/Season yükle
  → completedEntries / seasonWeek / stage unlock / injured / roster (3–8)
  → boş name onar ("Rider <id>")
  → simulateRace
  → extractInjuriesFromSegmentLog + applyInjuries
  → Cyclist.updateOne form/fatigue
  → Team seasonPoints/wins
  → RaceResult.create (segmentLog.randomEvents = objects)
  → completedEntries + updateStageRaceGc
```

### Mongoose `type` tuzağı (sık kırılır)

```js
// YANLIŞ → Cast to [string] failed on randomEvents
{ type: String, kind: String, message: String }

// DOĞRU
{ type: { type: String }, kind: { type: String }, message: { type: String } }
```

`RaceResult.randomEvents`, `injuriesApplied.type` için zorunlu. Belirti: enter 500 + Proxy object cast hatası.

### Cyclist name

- `name` required
- Legacy boş isimler: `GET /api/cyclists` ve enter path `Rider <id>` yazar
- Form/fatigue için `save()` yerine `updateOne` tercih (validation kaçınır)

### Frontend

- Vue 2 Options API, Bootstrap 4
- `$ui.*`, `PageHeader` / `EmptyState` / `LoadingState`
- History mode — Express `GET *` → `index.html` (dist varsa)
- Dev proxy `/api` → `localhost:3000`

---

## Özellik → dosya

| Özellik | Backend | Frontend |
|---------|---------|----------|
| Segment sim | `raceEngine.js` | `Results.vue` |
| Taktik / rol | `GET /api/tactics\|roles` | `Calendar.vue` |
| Sezon | `seasonService.js` | Calendar advance |
| Sıralama | `GET /api/standings` | `Standings.vue` |
| Segment editör | `Race.segments` | `RaceManagement.vue` |
| Etap | `stageRaceService.js` | `StageRaceManagement.vue` |
| Transfer | `transferService.js` | `TransferMarket.vue` |
| Sakatlık | `injuryService.js` | Calendar / Results |
| Dashboard | `GET /api/dashboard` | `HomeManagement.vue` |

---

## YAPMA

- Vue 3 / Pinia / TS migration (istenmedikçe)
- Secret / `.env` commit
- `/health` kaldırma
- Seed'i rastgele değiştirme
- 5 satırlık fix yerine büyük refactor
- Kullanıcı istemeden yeni markdown (README / AGENTS / CLAUDE güncellemesi OK)

---

## Deploy

| Konu | Detay |
|------|-------|
| Root `npm run build` | Sadece backend production deps |
| Frontend | Ayrı: `npm run build --prefix frontend` |
| Docker | Multi-stage; port 9999 |
| PandaStack | `pandastack.json`, `/health` |
| `dist/` | Root `.gitignore` `dist/` içerir; ücretsiz tier prebuilt isterse ignore/deploy stratejisini bilinçli yönet |

---

## Debug checklist

1. **502** — backend ayakta mı? `MONGODB_URI`?
2. **Boş UI** — `frontend/dist` + rebuild
3. **Enter 500 Cast string** — `RaceResult` `type: { type: String }`
4. **Enter name required** — boş cyclist name; liste yenile / onarım path
5. **Enter 400** — hafta, etap, sakatlık, kadro, tekrar giriş
6. **CORS** — `:8080` webpack; `file://` açma
7. **Node** — `>=20`

---

## PR şablonu

```markdown
## Summary
- Ne değişti ve neden

## Test plan
- [ ] `npm run build --prefix frontend`
- [ ] Calendar → enter race → Results timeline
- [ ] `/health` 200
```

---

## raceEngine exports

```javascript
const {
  simulateRace,
  staffTacticBonus,
  TACTICS,
  RIDER_ROLES,
  normalizeTactic,
  normalizeRoles,
  validateRaceSegments,
  createRng,
} = require('./backend/services/raceEngine');
```

---

## Faz 6–7 notları

- Haftalık maaş + gelişim: `seasonService` / `developmentService.js`
- Çok takımlı yarış: `pelotonService.buildRivalSquads` + `simulateRace({ rivalSquads })`
- Tests: `npm test --prefix backend` (unit + feature)
- Zaman bazlı etap GC + sezon özeti: `stageRaceService` / `Season.summary`

GitHub: `ylnyorulmaz/velespitlegends`
