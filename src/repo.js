'use strict';

/*
  Zentrale Datenschicht. Server und Skripte greifen nur hierüber auf Daten zu.
  - Ohne MONGODB_URI: SQLite-Datei in data/ (lokal)
  - Mit MONGODB_URI:  MongoDB Atlas (Render)
  Vor der ersten Nutzung einmal await repo.init() aufrufen.
*/
module.exports = process.env.MONGODB_URI ? require('./store/mongo') : require('./store/sqlite');
