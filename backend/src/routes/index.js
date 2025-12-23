const express = require('express');
const router = express.Router();

// TODO: attach real API routes later
router.get('/', (req, res) => {
  res.json({ message: 'API Root OK' });
});

module.exports = router;
const lessons = require('./lessons');
router.use('/lessons', lessons);
