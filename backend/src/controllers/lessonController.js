const { fetchLessons } = require('../services/lessonService');

exports.getLessons = async (req, res) => {
  try {
    const lessons = await fetchLessons();
    res.json({
      message: 'Lessons retrieved successfully',
      data: lessons,
    });
  } catch (error) {
    console.error('Error fetching lessons:', error);
    res.status(500).json({ error: 'Failed to load lessons' });
  }
};
