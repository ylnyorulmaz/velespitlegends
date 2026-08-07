const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let memoryServer;

async function startMemoryMongo() {
  if (!memoryServer) {
    memoryServer = await MongoMemoryServer.create({
      instance: {
        launchTimeout: 60000,
      },
    });
  }
  const uri = memoryServer.getUri();
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(uri);
  return uri;
}

async function clearDb() {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((col) => col.deleteMany({})));
}

async function stopMemoryMongo() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

module.exports = {
  startMemoryMongo,
  clearDb,
  stopMemoryMongo,
};
