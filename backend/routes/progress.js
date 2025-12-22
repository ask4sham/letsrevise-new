const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Lesson = require('../models/Lesson');
const auth = require('../middleware/auth');

// Helper: ensure studentStats exists with safe defaults
function ensureStudentStats(user) {
  if (!user.studentStats) {
    user.studentStats = {
      averageProgress: 0,
      totalShamCoinsSpent: 0,
      streakDays: 0,
      lastActiveDate: null,
    };
  }
}

// @route   PUT api/progress/:lessonId
// @desc    Update lesson progress
// @access  Private (Students only)
router.put('/:lessonId', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'student') {
      return res
        .status(403)
        .json({ msg: 'Only students can update progress' });
    }

    const { progress, completed, timeSpentMinutes } = req.body;
    const lessonId = req.params.lessonId;

    // Validate progress
    if (progress !== undefined && (progress < 0 || progress > 100)) {
      return res
        .status(400)
        .json({ msg: 'Progress must be between 0 and 100' });
    }

    // Find the lesson
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ msg: 'Lesson not found' });
    }

    // Check if user has purchased this lesson
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    ensureStudentStats(user);

    const purchasedLessonIndex = user.purchasedLessons.findIndex(
      (pl) => pl.lessonId.toString() === lessonId
    );

    if (purchasedLessonIndex === -1) {
      return res
        .status(400)
        .json({ msg: 'You must purchase this lesson first' });
    }

    // Update progress
    const purchasedLesson = user.purchasedLessons[purchasedLessonIndex];

    if (progress !== undefined) {
      purchasedLesson.progress = progress;
      purchasedLesson.lastAccessed = new Date();

      // Auto-complete if progress is 100%
      if (progress === 100 && !purchasedLesson.completed) {
        purchasedLesson.completed = true;
        purchasedLesson.completedAt = new Date();

        // Award ShamCoins for completion (10% of lesson price)
        const completionReward = Math.floor(lesson.shamCoinPrice * 0.1);
        user.shamCoins += completionReward;

        // Add transaction record
        user.transactions.push({
          type: 'deposit',
          amount: completionReward,
          description: `Completion reward for "${lesson.title}"`,
          lessonId: lesson._id,
          status: 'completed',
        });
      }
    }

    if (completed !== undefined) {
      const wasCompleted = purchasedLesson.completed;
      purchasedLesson.completed = completed;
      if (completed) {
        purchasedLesson.completedAt = new Date();
        purchasedLesson.progress = 100;

        // Award ShamCoins for completion if not already awarded
        if (!wasCompleted) {
          const completionReward = Math.floor(lesson.shamCoinPrice * 0.1);
          user.shamCoins += completionReward;

          user.transactions.push({
            type: 'deposit',
            amount: completionReward,
            description: `Completion reward for "${lesson.title}"`,
            lessonId: lesson._id,
            status: 'completed',
          });
        }
      }
    }

    if (timeSpentMinutes !== undefined) {
      purchasedLesson.timeSpentMinutes =
        (purchasedLesson.timeSpentMinutes || 0) + timeSpentMinutes;
      purchasedLesson.lastAccessed = new Date();
    }

    // Update streak
    const todayStr = new Date().toDateString();
    const lastActiveStr = user.studentStats.lastActiveDate
      ? new Date(user.studentStats.lastActiveDate).toDateString()
      : null;

    if (lastActiveStr !== todayStr) {
      user.studentStats.lastActiveDate = new Date();
      user.studentStats.streakDays =
        (user.studentStats.streakDays || 0) + 1;
    }

    await user.save();

    res.json({
      success: true,
      msg: 'Progress updated successfully',
      progress: purchasedLesson.progress,
      completed: purchasedLesson.completed,
      timeSpentMinutes: purchasedLesson.timeSpentMinutes,
      updatedAt: purchasedLesson.lastAccessed,
      reward: purchasedLesson.completed
        ? Math.floor(lesson.shamCoinPrice * 0.1)
        : 0,
    });
  } catch (err) {
    console.error('Progress update error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// @route   PUT api/progress/:lessonId/review
// @desc    Add review/rating to completed lesson
// @access  Private (Students only)
router.put('/:lessonId/review', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'student') {
      return res
        .status(403)
        .json({ msg: 'Only students can review lessons' });
    }

    const { rating, review } = req.body;
    const lessonId = req.params.lessonId;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ msg: 'Rating must be between 1 and 5' });
    }

    // Find the lesson
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ msg: 'Lesson not found' });
    }

    // Check if user has purchased and completed this lesson
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const purchasedLessonIndex = user.purchasedLessons.findIndex(
      (pl) => pl.lessonId.toString() === lessonId && pl.completed
    );

    if (purchasedLessonIndex === -1) {
      return res.status(400).json({
        msg: 'You must complete this lesson before reviewing it',
      });
    }

    // Update review
    const purchasedLesson = user.purchasedLessons[purchasedLessonIndex];
    purchasedLesson.rating = rating;
    purchasedLesson.review = review;
    purchasedLesson.reviewedAt = new Date();

    // Update lesson's average rating
    const allUsers = await User.find({
      'purchasedLessons.lessonId': lessonId,
      'purchasedLessons.rating': { $exists: true },
    });

    let totalRating = 0;
    let ratingCount = 0;

    allUsers.forEach((u) => {
      u.purchasedLessons.forEach((pl) => {
        if (pl.lessonId.toString() === lessonId && pl.rating) {
          totalRating += pl.rating;
          ratingCount++;
        }
      });
    });

    if (ratingCount > 0) {
      lesson.averageRating = totalRating / ratingCount;
    }

    // Update teacher's average rating
    const teacher = await User.findById(lesson.teacherId);
    if (teacher && teacher.userType === 'teacher') {
      const teacherLessons = await Lesson.find({
        teacherId: lesson.teacherId,
      });
      let teacherTotalRating = 0;
      let teacherRatingCount = 0;

      teacherLessons.forEach((l) => {
        if (l.averageRating > 0) {
          teacherTotalRating += l.averageRating;
          teacherRatingCount++;
        }
      });

      if (teacherRatingCount > 0) {
        teacher.teacherStats.averageRating =
          teacherTotalRating / teacherRatingCount;
        teacher.teacherStats.totalReviews =
          (teacher.teacherStats.totalReviews || 0) + 1;
        await teacher.save();
      }
    }

    await lesson.save();
    await user.save();

    res.json({
      success: true,
      msg: 'Review submitted successfully',
      rating,
      review,
      lessonAverageRating: lesson.averageRating,
      reviewedAt: purchasedLesson.reviewedAt,
    });
  } catch (err) {
    console.error('Review submission error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Helper: default stats shape for safety
function getDefaultStatsResponse() {
  return {
    success: true,
    stats: {
      totalPurchased: 0,
      totalCompleted: 0,
      totalInProgress: 0,
      totalNotStarted: 0,
      completionRate: 0,
      averageProgress: 0,
      totalTimeSpentMinutes: 0,
      totalShamCoinsSpent: 0,
      streakDays: 0,
      estimatedTotalDurationMinutes: 0,
      timeCompletionRatio: 0,
      subjectProgress: [],
    },
    recentActivity: [],
  };
}

// @route   GET api/progress/stats
// @desc    Get student progress statistics
// @access  Private (Students only)
router.get('/stats', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'student') {
      return res
        .status(403)
        .json({ msg: 'Only students can view progress stats' });
    }

    const user = await User.findById(req.user._id).populate(
      'purchasedLessons.lessonId',
      'title subject level estimatedDuration'
    );

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    ensureStudentStats(user);

    // Wrap the heavy calculation in its own try so we can fall back cleanly
    try {
      const purchasedLessons = Array.isArray(user.purchasedLessons)
        ? user.purchasedLessons
        : [];

      const completedLessons = purchasedLessons.filter((pl) => pl.completed);
      const inProgressLessons = purchasedLessons.filter(
        (pl) => !pl.completed && (pl.progress || 0) > 0
      );
      const notStartedLessons = purchasedLessons.filter(
        (pl) => !pl.completed && (pl.progress || 0) === 0
      );

      const totalTimeSpent = purchasedLessons.reduce(
        (sum, pl) => sum + (pl.timeSpentMinutes || 0),
        0
      );

      const totalEstimatedDuration = purchasedLessons.reduce((sum, pl) => {
        const lesson = pl.lessonId;
        if (
          lesson &&
          lesson.estimatedDuration &&
          !Number.isNaN(lesson.estimatedDuration)
        ) {
          return sum + lesson.estimatedDuration;
        }
        return sum;
      }, 0);

      const progressBySubject = {};
      purchasedLessons.forEach((pl) => {
        const lesson = pl.lessonId;
        if (lesson && lesson.subject) {
          const subject = lesson.subject;
          if (!progressBySubject[subject]) {
            progressBySubject[subject] = {
              totalLessons: 0,
              completedLessons: 0,
              totalProgress: 0,
            };
          }
          progressBySubject[subject].totalLessons++;
          progressBySubject[subject].totalProgress += pl.progress || 0;
          if (pl.completed) {
            progressBySubject[subject].completedLessons++;
          }
        }
      });

      const subjectProgress = Object.entries(progressBySubject).map(
        ([subject, data]) => {
          const d = data;
          return {
            subject,
            totalLessons: d.totalLessons,
            completedLessons: d.completedLessons,
            averageProgress:
              d.totalLessons > 0
                ? Math.round(d.totalProgress / d.totalLessons)
                : 0,
          };
        }
      );

      const stats = {
        totalPurchased: purchasedLessons.length,
        totalCompleted: completedLessons.length,
        totalInProgress: inProgressLessons.length,
        totalNotStarted: notStartedLessons.length,
        completionRate:
          purchasedLessons.length > 0
            ? Math.round(
                (completedLessons.length / purchasedLessons.length) * 100
              )
            : 0,
        averageProgress: user.studentStats.averageProgress || 0,
        totalTimeSpentMinutes: totalTimeSpent,
        totalShamCoinsSpent: user.studentStats.totalShamCoinsSpent || 0,
        streakDays: user.studentStats.streakDays || 0,
        estimatedTotalDurationMinutes: totalEstimatedDuration,
        timeCompletionRatio:
          totalEstimatedDuration > 0
            ? Math.round((totalTimeSpent / totalEstimatedDuration) * 100)
            : 0,
        subjectProgress,
      };

      const recentActivity = purchasedLessons
        .filter((pl) => pl.lastAccessed && pl.lessonId)
        .sort(
          (a, b) =>
            new Date(b.lastAccessed).getTime() -
            new Date(a.lastAccessed).getTime()
        )
        .slice(0, 5)
        .map((pl) => ({
          lessonId: pl.lessonId?._id,
          title: pl.lessonId?.title || 'Unknown',
          subject: pl.lessonId?.subject || 'Unknown',
          lastAccessed: pl.lastAccessed,
          progress: pl.progress || 0,
          completed: !!pl.completed,
        }));

      return res.json({
        success: true,
        stats,
        recentActivity,
      });
    } catch (calcErr) {
      console.error('Progress stats calculation error:', calcErr);
      // Fall back to an empty but *successful* response
      return res.json(getDefaultStatsResponse());
    }
  } catch (err) {
    console.error('Progress stats error:', err);
    // Even on outer failure, return safe defaults so the page never 500s
    return res.json(getDefaultStatsResponse());
  }
});

// @route   GET api/progress/teacher/:teacherId
// @desc    Get teacher's student progress analytics
// @access  Private (Teachers only)
router.get('/teacher/:teacherId', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'teacher') {
      return res
        .status(403)
        .json({ msg: 'Only teachers can view student analytics' });
    }

    // Check if teacher is viewing their own analytics
    if (req.user._id.toString() !== req.params.teacherId) {
      return res
        .status(403)
        .json({ msg: 'You can only view your own analytics' });
    }

    // Get all lessons by this teacher
    const lessons = await Lesson.find({
      teacherId: req.params.teacherId,
    }).select('_id title subject level shamCoinPrice averageRating views');

    // Get all purchases for these lessons
    const users = await User.find({
      'purchasedLessons.lessonId': { $in: lessons.map((l) => l._id) },
    }).select('firstName lastName email purchasedLessons studentStats');

    // Calculate analytics
    const lessonAnalytics = lessons.map((lesson) => {
      const students = users.filter((user) =>
        user.purchasedLessons.some(
          (pl) => pl.lessonId.toString() === lesson._id.toString()
        )
      );

      const completedStudents = students.filter((student) =>
        student.purchasedLessons.some(
          (pl) =>
            pl.lessonId.toString() === lesson._id.toString() &&
            pl.completed
        )
      );

      const averageProgress =
        students.reduce((sum, student) => {
          const pl = student.purchasedLessons.find(
            (p) => p.lessonId.toString() === lesson._id.toString()
          );
          return sum + (pl?.progress || 0);
        }, 0) / (students.length || 1);

      return {
        lessonId: lesson._id,
        title: lesson.title,
        subject: lesson.subject,
        level: lesson.level,
        totalStudents: students.length,
        completedStudents: completedStudents.length,
        completionRate:
          students.length > 0
            ? Math.round(
                (completedStudents.length / students.length) * 100
              )
            : 0,
        averageProgress: Math.round(averageProgress),
        averageRating: lesson.averageRating || 0,
        views: lesson.views || 0,
        revenue: students.length * lesson.shamCoinPrice * 0.7,
      };
    });

    // Calculate overall stats
    const totalStudents = new Set();
    let totalRevenue = 0;
    let totalCompletions = 0;
    let totalPurchases = 0;

    users.forEach((user) => {
      user.purchasedLessons.forEach((pl) => {
        if (
          lessons.some(
            (l) => l._id.toString() === pl.lessonId.toString()
          )
        ) {
          totalStudents.add(user._id.toString());
          totalPurchases++;
          totalRevenue += pl.price * 0.7;

          if (pl.completed) {
            totalCompletions++;
          }
        }
      });
    });

    res.json({
      success: true,
      overallStats: {
        totalLessons: lessons.length,
        totalStudents: totalStudents.size,
        totalPurchases,
        totalCompletions,
        totalRevenue: Math.round(totalRevenue),
        overallCompletionRate:
          totalPurchases > 0
            ? Math.round(
                (totalCompletions / totalPurchases) * 100
              )
            : 0,
        averageLessonRating:
          lessons.length > 0
            ? lessons.reduce(
                (sum, l) => sum + (l.averageRating || 0),
                0
              ) / lessons.length
            : 0,
      },
      lessonAnalytics,
      recentStudents: users.slice(0, 10).map((user) => ({
        studentId: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        totalLessonsPurchased: user.purchasedLessons.filter((pl) =>
          lessons.some(
            (l) => l._id.toString() === pl.lessonId.toString()
          )
        ).length,
        averageProgress: user.studentStats?.averageProgress || 0,
        lastActive: user.studentStats?.lastActiveDate || null,
      })),
    });
  } catch (err) {
    console.error('Teacher analytics error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

module.exports = router;
