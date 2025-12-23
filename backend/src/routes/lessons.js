const express = require('express');
const router = express.Router();
const { getLessons } = require('../controllers/lessonController');

router.get('/', getLessons);

module.exports = router;
