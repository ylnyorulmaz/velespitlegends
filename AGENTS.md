# AGENTS.md — Velespit Legends

**Cursor Cloud Agents**, Codex ve diğer otonom kod agent'ları için bu repoda çalışma talimatları.

---

## Proje özeti

**Velespit Legends** tek repoda full-stack bisiklet yönetimi simülasyonu:

| Katman | Konum | Not |
|--------|-------|-----|
| Backend | `backend/` | Express + Mongoose; `index.js` API + statik `frontend/dist` |
| Frontend | `frontend/src/` | Vue 2 SPA, history mode router |
| Veritabanı | MongoDB | Mongoose ilk yazımda koleksiyon oluşturur |

**Test suite yok.** Değişiklikleri `npm run build --prefix frontend` ve manuel/API smoke test ile doğrulayın.

---

## Kritik dosya haritası

```
backend/index.js                 # Tüm REST route'ları — API değişikliğinde başla
backend/services/raceEngine.js   # Simülasyon çekirdeği (~760 satır)
backend/services/seasonService.js
backend/services/injuryService.js
backend/services/stageRaceService.js
backend/services/transferService.js
backend/models/*.js              # Mongoose şemaları
frontend/src/components/*.vue    # Her dosya ≈ bir sayfa
frontend/src/router/index.js
frontend/src/utils/ui.js         # $ui formatlama yardımcıları
frontend/src/assets/styles.css   # Tasarım sistemi (CSS variables)
frontend/webpack.config.js       # Dev proxy: /api → localhost:3000
Dockerfile                       # Multi-stage frontend build
pandastack.json                  # Deploy config
```

---

## Git, branch ve PR kuralları

| Kural | Değer |
|-------|-------|
| Base branch | `main` |
| Feature branch | `cursor/<descriptive-name>-fd4c` (küçük harf, `-fd4c` suffix) |
| Push | `git push -u origin cursor/<branch>-fd4c` |
| PR oluşturma | **ManagePullRequest** tool (mümkünse `gh pr create` kullanma) |
| Commit zamanı | Test öncesi commit; PR öncesi push |

### Commit mesajı örneği

```
Add weekly salary deduction on season advance

- Deduct roster salaries in seasonService.advanceSeasonWeek
- Show budget warning on Teams page when low
```

---

## Ortam değişkenleri

| Değişken | Amaç |
|----------|------|
| `MONGODB_URI` | MongoDB bağlantı dizesi (cloud/production'da zorunlu) |
| `PORT` | HTTP port (varsayılan `3000`; Docker `9999`) |

- Yerel env: `backend/.env` (gitignore'da)
- **Asla** credential commit etme

---

## Sık kullanılan komutlar

```bash
# Production tarzı çalıştırma (repo root)
npm ci --prefix backend
npm ci --prefix frontend && npm run build --prefix frontend
npm start

# Sadece backend
cd backend && npm start

# Frontend dev (HMR)
cd frontend && npm run serve   # :8080, /api proxy

# Race engine smoke (DB gerekmez)
node -e "const r=require('./backend/services/raceEngine'); console.log(Object.keys(r));"

# Frontend build doğrulama
npm run build --prefix frontend
```

---

## Mimari kurallar

### Yarış simülasyonu (`raceEngine.js`)

1. **Determinizm:** Seed formülünü bilinçli değiştirmeden bozmayın.
   - Seed: `` `${race._id}-${teamId}-${race.date}-${tactic}-${roleKey}` ``
   - `index.js` satır ~338; injury seed: `` `${seed}-injuries` ``
2. Segment mantığı: `buildSegments`, `resolveSegment`, `rollRandomEvents`
3. Roller: `normalizeRoles`, `roleSegmentBonus` — takımda max **1 leader**
4. Sakatlık: `index.js` → `extractInjuriesFromSegmentLog` → `applyInjuries`
5. Rakipler prosedürel (`RIVAL_NAMES`); DB takımları simülasyona katılmaz

### API kalıpları

- Yarış girişi: `POST /api/races/:id/enter`
  - Doğrular: roster, season week, stage unlock, injury, 3–8 rider, tek tamamlama
  - Simüle eder → form/fatigue kaydeder → GC günceller → `RaceResult` döner
- Route'larda iş mantığı tekrarlamayın; mevcut service'leri kullanın:
  - `seasonService`, `transferService`, `stageRaceService`, `injuryService`
- Frontend nested data gösteriyorsa `.populate()` kullanın

### Frontend kalıpları

- **Vue 2 Options API** (Composition API yok)
- Bootstrap **4** (5 değil)
- Global CSS token'ları: `frontend/src/assets/styles.css`
- Paylaşılan bileşenler: `PageHeader`, `EmptyState`, `LoadingState`
- Formatlama: `this.$ui.*` (`frontend/src/utils/ui.js`)
- Router **history mode** — sunucu `index.html` fallback gerekir (`backend/index.js` satır 527+)

---

## Özellik → dosya eşlemesi

| Özellik | Backend | Frontend |
|---------|---------|----------|
| Segment simülasyonu | `raceEngine.js` | `Results.vue` timeline |
| Taktikler | `GET /api/tactics` | `Calendar.vue` |
| Bisikletçi rolleri | `GET /api/roles` | `Calendar.vue` |
| Sezon haftaları | `Season` model | `Calendar.vue` advance |
| Sıralama | `GET /api/standings` | `Standings.vue` |
| Özel segmentler | `Race.segments[]` | `RaceManagement.vue` |
| Etap yarışları | `StageRace` model | `StageRaceManagement.vue` |
| Transferler | `transferService.js` | `TransferMarket.vue` |
| Sakatlıklar | `injuryService.js` | Calendar/Results badge |
| Personel bonusu | `staffTacticBonus()` | `TeamManagement.vue` |
| Dashboard | `GET /api/dashboard` | `HomeManagement.vue` |

---

## YAPMA listesi

- Pinia, Vue 3 migration ekleme (açıkça istenmedikçe)
- `node_modules`, `.env`, secret commit etme
- `/health` endpoint'ini kaldırma (deploy platformları buna bağlı)
- `frontend/dist` gitignore etme (PandaStack 512MB tier prebuilt dist kullanır)
- 5–20 satırlık fix yerine büyük refactor
- Kullanıcı istemedikçe markdown dosyası ekleme (README/AGENTS/CLAUDE hariç)
- Race engine seed'ini rastgele değiştirme

---

## Deploy notları

| Konu | Detay |
|------|-------|
| Root `build` | Sadece backend deps; frontend ayrı build |
| Docker | Multi-stage: frontend build → `dist` backend imajına kopyalanır |
| PandaStack | `pandastack.json`, `/health`, env dashboard'dan |
| Prebuilt dist | Ücretsiz tier'da webpack build atlanır; dist commit gerekli |
| MongoDB Atlas | Network Access deploy IP'sine izin vermeli |

---

## Yarış giriş akışı (agent debug için)

```
POST /api/races/:id/enter
  ├─ Race, Team, Season yükle
  ├─ completedEntries kontrol
  ├─ seasonWeek <= currentWeek
  ├─ isStageUnlockedForTeam (etap yarışı)
  ├─ injured rider kontrol
  ├─ roster kontrol
  ├─ simulateRace(seed, tactic, roles, staffBonus)
  ├─ extractInjuriesFromSegmentLog + applyInjuries
  ├─ Cyclist form/fatigue kaydet
  ├─ Team seasonPoints, wins güncelle
  ├─ RaceResult.create
  ├─ race.completedEntries.push
  └─ updateStageRaceGc (varsa)
```

---

## Önerilen genişletme noktaları (Faz 6+)

| Fikir | Dokunulacak dosyalar |
|-------|---------------------|
| Haftalık maaş | `Team.budget`, `seasonService.advanceSeasonWeek` |
| Bisikletçi gelişimi | `Cyclist.potential`, `age`, post-race tick |
| Çok takımlı yarış | `simulateRace` → DB'den rakip takımlar |
| Zaman bazlı GC | `StageRace` schema + engine time gaps |
| Testler | `backend/services/raceEngine.test.js` (deterministik seed) |

---

## Debug checklist

1. **502 / proxy error** — `npm start` çalışıyor mu? `MONGODB_URI` set mi?
2. **Boş UI** — `frontend/dist` var mı? Frontend rebuild.
3. **Yarışa giremiyor** — Sezon haftası, etap sırası, sakatlık, daha önce tamamlanmış.
4. **CORS (dev)** — Webpack dev server proxy kullan; dosyayı doğrudan açma.
5. **API 500** — MongoDB bağlantısı; `index.js` console.error.
6. **Build fail** — Node 20+; `npm ci` temiz kurulum dene.

---

## PR açıklama şablonu

```markdown
## Summary
- Ne değişti ve neden (1–3 cümle)

## Test plan
- [ ] `npm run build --prefix frontend`
- [ ] Manuel: Calendar → enter race → Results timeline
- [ ] Deploy: `/health` 200
```

---

## Export edilen raceEngine API'si

Agent'ların import edebileceği ana export'lar:

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

## İletişim / sahiplik

GitHub: `ylnyorulmaz/velespitlegends`

Mevcut kod stiline uy; faz bazlı commit mesajları tercih edilir. İnsan okuyabilir genel bakış için **README.md**, Claude Code için **CLAUDE.md**.
