/**
 * Block 28 Phase 2 — strict read-only Mongo facade (allowlist only).
 * Does not expose raw db, collection, or client handles.
 */

const BLOCKED_COLLECTION_OPERATIONS = [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "findOneAndDelete",
  "replaceOne",
  "insertOne",
  "insertMany",
  "bulkWrite",
  "deleteOne",
  "deleteMany",
  "drop",
  "createIndex",
  "dropIndex",
  "rename",
  "aggregate",
  "save",
  "findOneAndReplace",
  "findOneAndRemove",
  "remove",
  "initializeOrderedBulkOp",
  "initializeUnorderedBulkOp",
];

const BLOCKED_DB_OPERATIONS = [
  "admin",
  "aggregate",
  "collection",
  "createCollection",
  "dropDatabase",
  "command",
  "client",
  "stats",
  "renameCollection",
  "watch",
];

function facadeError(message) {
  return new Error(`Block28 Phase2 read-only facade: ${message}`);
}

function denyUnknown(targetLabel, prop) {
  throw facadeError(`${targetLabel}.${String(prop)} forbidden`);
}

function wrapFindCursor(rawCursor) {
  const facade = {
    toArray: () => rawCursor.toArray(),
    limit: (n) => wrapFindCursor(rawCursor.limit(n)),
    sort: (spec) => wrapFindCursor(rawCursor.sort(spec)),
    project: (spec) => wrapFindCursor(rawCursor.project(spec)),
  };

  return new Proxy(facade, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === "then" || prop === "catch" || prop === "finally") return undefined;
      denyUnknown("cursor", prop);
    },
    set() {
      throw facadeError("cursor is read-only");
    },
  });
}

function wrapCollection(rawCollection, collectionName) {
  const facade = {
    find(filter, options) {
      return wrapFindCursor(rawCollection.find(filter, options));
    },
    findOne(filter, options) {
      return rawCollection.findOne(filter, options);
    },
  };

  return new Proxy(facade, {
    get(target, prop) {
      if (prop in target) return target[prop];
      denyUnknown(`collection(${collectionName})`, prop);
    },
    set() {
      throw facadeError(`collection(${collectionName}) is read-only`);
    },
  });
}

/**
 * @param {import("mongodb").Db} rawDb
 * @returns {{ databaseName: string, collection: (name: string) => object }}
 */
function createReadOnlyDbFacade(rawDb) {
  const collectionCache = new Map();

  const facade = {
    get databaseName() {
      return rawDb.databaseName;
    },
    collection(name) {
      const key = String(name);
      if (!collectionCache.has(key)) {
        collectionCache.set(key, wrapCollection(rawDb.collection(key), key));
      }
      return collectionCache.get(key);
    },
  };

  return new Proxy(facade, {
    get(target, prop) {
      if (prop in target) return target[prop];
      denyUnknown("db", prop);
    },
    set() {
      throw facadeError("db is read-only");
    },
  });
}

/**
 * @param {{ databaseName: string, collection: Function }} dbFacade
 */
function createReadOnlyAdapters(dbFacade) {
  async function fetchLessons() {
    return dbFacade
      .collection("lessons")
      .find({ examQuestions: { $exists: true, $ne: [] } })
      .project({
        examQuestions: 1,
        status: 1,
        title: 1,
        canonicalTopicKey: 1,
        topicKey: 1,
      })
      .toArray();
  }

  const masterCache = new Map();

  async function fetchMastersByIds(ids) {
    const unique = [...new Set(ids.map(String).filter(Boolean))];
    const missing = unique.filter((id) => !masterCache.has(id));
    if (missing.length > 0) {
      const { ObjectId } = require("mongoose").Types;
      const objectIds = missing.map((id) => {
        try {
          return new ObjectId(id);
        } catch {
          return id;
        }
      });
      const docs = await dbFacade
        .collection("examquestions")
        .find({ _id: { $in: objectIds } })
        .toArray();
      for (const doc of docs) {
        masterCache.set(String(doc._id), doc);
      }
    }
    const result = new Map();
    for (const id of unique) {
      if (masterCache.has(id)) result.set(id, masterCache.get(id));
    }
    return result;
  }

  async function fetchLessonById(lessonId) {
    const { ObjectId } = require("mongoose").Types;
    return dbFacade.collection("lessons").findOne({ _id: new ObjectId(lessonId) });
  }

  return {
    fetchLessons,
    fetchMastersByIds,
    fetchLessonById,
    dbName: dbFacade.databaseName,
  };
}

/**
 * Connect via mongoose internally; expose only read adapters + disconnect.
 * Raw db/collection/client are never returned.
 */
async function connectReadOnlyMongo(uri, options = {}) {
  const mongoose = require("mongoose");
  const { dbName, serverSelectionTimeoutMS = 30000 } = options;
  await mongoose.connect(uri, { serverSelectionTimeoutMS, dbName });
  const facade = createReadOnlyDbFacade(mongoose.connection.db);
  const adapters = createReadOnlyAdapters(facade);
  return {
    adapters,
    disconnect: async () => {
      await mongoose.disconnect();
    },
  };
}

module.exports = {
  BLOCKED_COLLECTION_OPERATIONS,
  BLOCKED_DB_OPERATIONS,
  createReadOnlyDbFacade,
  createReadOnlyAdapters,
  connectReadOnlyMongo,
};
