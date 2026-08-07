# Frontend — Velespit Legends

Vue 2 SPA. Tam kurulum, API ve oyun dokümantasyonu için repo kökündeki **[README.md](../README.md)** dosyasına bakın.

## Komutlar

```bash
npm install
npm run serve    # http://localhost:8080 — /api → backend :3000
npm run build    # dist/ → Express tarafından sunulur
```

Backend'in ayrıca çalışıyor olması gerekir (`cd ../backend && npm start`).

## Yapı

| Path | Açıklama |
|------|----------|
| `src/components/` | Sayfa bileşenleri (Calendar, Results, …) |
| `src/router/` | History mode rotalar |
| `src/utils/ui.js` | `$ui` helpers |
| `src/assets/styles.css` | Tasarım sistemi |
| `webpack.config.js` | Dev server + API proxy |

Agent talimatları: **[AGENTS.md](../AGENTS.md)** · Claude: **[CLAUDE.md](../CLAUDE.md)**
