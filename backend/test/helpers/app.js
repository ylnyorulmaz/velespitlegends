const { startMemoryMongo } = require('./mongo');

let cachedApp;
let ready;

async function getTestApp() {
  if (cachedApp) return cachedApp;
  if (!ready) {
    ready = (async () => {
      const uri = await startMemoryMongo();
      process.env.MONGODB_URI = uri;
      ({ app: cachedApp } = require('../../index'));
      return cachedApp;
    })();
  }
  return ready;
}

module.exports = { getTestApp };
