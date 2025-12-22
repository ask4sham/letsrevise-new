const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Lesson = require('../models/Lesson');
const auth = require('../middleware/auth');

// Middleware to check if user is admin
const checkAdmin = (req, res, next) => {
  if (req.user.userType !== 'admin') {
    return res.status(403).json({ msg: 'Admin access required' });
  }
  next();
};

// @route   GET api/admin/stats
// @desc    Get platform statistics
// @access  Private (Admin only)
router.get('/stats', auth, checkAdmin, async (req, res) => {
  try {
    // Get total counts
    const totalUsers = await User.countDocuments();
    const totalTeachers = await User.countDocuments({ userType: 'teacher' });
    const totalStudents = await User.countDocuments({ userType: 'student' });
    const totalLessons = await Lesson.countDocuments();
    const totalPurchases = await User.aggregate([
      { $unwind: '$purchasedLessons' },
      { $group: { _id: null, total: { $sum: 1 } } }
    ]);

    // Get revenue statistics
    const revenueStats = await User.aggregate([
      { $unwind: '$transactions' },
      { 
        $match: { 
          'transactions.type': { $in: ['purchase', 'subscription'] },
          'transactions.status': 'completed'
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$transactions.amount' },
          todayRevenue: {
            $sum: {
              $cond: [
                { 
                  $gte: [
                    '$transactions.date',
                    new Date(new Date().setHours(0, 0, 0, 0))
                  ]
                },
                '$transactions.amount',
                0
              ]
            }
          },
          monthlyRevenue: {
            $sum: {
              $cond: [
                { 
                  $gte: [
                    '$transactions.date',
                    new Date(new Date().setDate(new Date().getDate() - 30))
                  ]
                },
                '$transactions.amount',
                0
              ]
            }
          }
        }
      }
    ]);

    // Get lesson statistics
    const lessonStats = await Lesson.aggregate([
      {
        $group: {
          _id: null,
          totalViews: { $sum: '$views' },
          averageRating: { $avg: '$averageRating' },
          totalPurchases: { $sum: '$purchases' },
          totalEarnings: { $sum: { $multiply: ['$purchases', '$shamCoinPrice', 0.3] } } // Platform's 30% share
        }
      }
    ]);

    // Get user growth (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const userGrowth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    // Get subscription statistics
    const subscriptionStats = await User.aggregate([
      {
        $group: {
          _id: '$subscription',
          count: { $sum: 1 },
          totalShamCoins: { $sum: '$shamCoins' }
        }
      }
    ]);

    res.json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          teachers: totalTeachers,
          students: totalStudents,
          growth: userGrowth
        },
        lessons: {
          total: totalLessons,
          totalViews: lessonStats[0]?.totalViews || 0,
          averageRating: lessonStats[0]?.averageRating || 0,
          totalPurchases: totalPurchases[0]?.total || 0,
          platformEarnings: lessonStats[0]?.totalEarnings || 0
        },
        revenue: {
          total: revenueStats[0]?.totalRevenue || 0,
          today: revenueStats[0]?.todayRevenue || 0,
          monthly: revenueStats[0]?.monthlyRevenue || 0
        },
        subscriptions: subscriptionStats.reduce((acc, stat) => {
          acc[stat._id] = {
            count: stat.count,
            totalShamCoins: stat.totalShamCoins
          };
          return acc;
        }, {}),
        platform: {
          totalShamCoins: subscriptionStats.reduce((sum, stat) => sum + (stat.totalShamCoins || 0), 0),
          activeUsers: await User.countDocuments({
            $or: [
              { 'studentStats.lastActiveDate': { $gte: new Date(new Date().setDate(new Date().getDate() - 7)) } },
              { 'updatedAt': { $gte: new Date(new Date().setDate(new Date().getDate() - 7)) } }
            ]
          })
        }
      }
    });

  } catch (err) {
    console.error('Get admin stats error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// @route   GET api/admin/users
// @desc    Get all users with filters
// @access  Private (Admin only)
router.get('/users', auth, checkAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, userType, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    const query = {};
    
    // Filter by user type
    if (userType && ['teacher', 'student', 'admin'].includes(userType)) {
      query.userType = userType;
    }
    
    // Search by name or email
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // Get users with pagination
    const users = await User.find(query)
      .select('-password')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalUsers = await User.countDocuments(query);

    res.json({
      success: true,
      users: users.map(user => ({
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        verificationStatus: user.verificationStatus,
        shamCoins: user.shamCoins,
        subscription: user.subscription,
        createdAt: user.createdAt,
        lastActive: user.userType === 'student' ? user.studentStats?.lastActiveDate : user.updatedAt,
        stats: user.userType === 'teacher' ? user.teacherStats : user.studentStats
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalUsers,
        pages: Math.ceil(totalUsers / parseInt(limit))
      }
    });

  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// @route   GET api/admin/lessons
// @desc    Get all lessons with filters
// @access  Private (Admin only)
router.get('/lessons', auth, checkAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, subject, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    const query = {};
    
    // Filter by status
    if (status && ['draft', 'published', 'archived'].includes(status)) {
      query.status = status;
    }
    
    // Filter by subject
    if (subject) {
      query.subject = subject;
    }
    
    // Search by title or description
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // Get lessons with teacher information
    const lessons = await Lesson.find(query)
      .populate('teacherId', 'firstName lastName email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalLessons = await Lesson.countDocuments(query);

    res.json({
      success: true,
      lessons: lessons.map(lesson => ({
        id: lesson._id,
        title: lesson.title,
        subject: lesson.subject,
        level: lesson.level,
        status: lesson.status,
        shamCoinPrice: lesson.shamCoinPrice,
        views: lesson.views || 0,
        purchases: lesson.purchases || 0,
        averageRating: lesson.averageRating || 0,
        createdAt: lesson.createdAt,
        teacher: lesson.teacherId ? {
          id: lesson.teacherId._id,
          name: `${lesson.teacherId.firstName} ${lesson.teacherId.lastName}`,
          email: lesson.teacherId.email
        } : null,
        revenue: {
          total: lesson.purchases * lesson.shamCoinPrice,
          platform: lesson.purchases * lesson.shamCoinPrice * 0.3,
          teacher: lesson.purchases * lesson.shamCoinPrice * 0.7
        }
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalLessons,
        pages: Math.ceil(totalLessons / parseInt(limit))
      }
    });

  } catch (err) {
    console.error('Get lessons error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// @route   GET api/admin/transactions
// @desc    Get all transactions
// @access  Private (Admin only)
router.get('/transactions', auth, checkAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, type, status, dateFrom, dateTo, sortBy = 'date', sortOrder = 'desc' } = req.query;
    
    // Build aggregation pipeline
    const pipeline = [];
    
    // Unwind transactions array
    pipeline.push({ $unwind: '$transactions' });
    
    // Match stage for filters
    const matchStage = {};
    if (type) matchStage['transactions.type'] = type;
    if (status) matchStage['transactions.status'] = status;
    
    // Date range filter
    if (dateFrom || dateTo) {
      matchStage['transactions.date'] = {};
      if (dateFrom) matchStage['transactions.date'].$gte = new Date(dateFrom);
      if (dateTo) matchStage['transactions.date'].$lte = new Date(dateTo);
    }
    
    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }
    
    // Lookup user information
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'userInfo'
      }
    });
    
    pipeline.push({ $unwind: '$userInfo' });
    
    // Project fields
    pipeline.push({
      $project: {
        _id: '$transactions._id',
        userId: '$_id',
        userEmail: '$userInfo.email',
        userName: { 
          $concat: ['$userInfo.firstName', ' ', '$userInfo.lastName'] 
        },
        userType: '$userInfo.userType',
        type: '$transactions.type',
        amount: '$transactions.amount',
        date: '$transactions.date',
        description: '$transactions.description',
        status: '$transactions.status',
        reference: '$transactions.reference',
        lessonId: '$transactions.lessonId'
      }
    });
    
    // Sort
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    pipeline.push({ $sort: sort });
    
    // Facet for pagination and total count
    pipeline.push({
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [
          { $skip: (parseInt(page) - 1) * parseInt(limit) },
          { $limit: parseInt(limit) }
        ]
      }
    });

    const result = await User.aggregate(pipeline);
    
    const transactions = result[0]?.data || [];
    const total = result[0]?.metadata[0]?.total || 0;

    res.json({
      success: true,
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (err) {
    console.error('Get transactions error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// @route   PUT api/admin/users/:userId/verify
// @desc    Verify or reject a teacher
// @access  Private (Admin only)
router.put('/users/:userId/verify', auth, checkAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, reason } = req.body;
    
    if (!status || !['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ msg: 'Status must be "verified" or "rejected"' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    if (user.userType !== 'teacher') {
      return res.status(400).json({ msg: 'Only teachers can be verified' });
    }

    const oldStatus = user.verificationStatus;
    user.verificationStatus = status;
    
    if (status === 'rejected' && reason) {
      // Store rejection reason
      user.verificationNotes = reason;
    }

    await user.save();

    res.json({
      success: true,
      msg: `Teacher ${status === 'verified' ? 'verified' : 'rejected'} successfully`,
      user: {
        id: user._id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        verificationStatus: user.verificationStatus,
        verificationNotes: user.verificationNotes
      },
      changes: {
        from: oldStatus,
        to: status
      }
    });

  } catch (err) {
    console.error('Verify user error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// @route   PUT api/admin/users/:userId/role
// @desc    Update user role
// @access  Private (Admin only)
router.put('/users/:userId/role', auth, checkAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    
    if (!role || !['teacher', 'student', 'admin'].includes(role)) {
      return res.status(400).json({ msg: 'Valid role is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const oldRole = user.userType;
    user.userType = role;
    
    // If changing to admin, auto-verify
    if (role === 'admin') {
      user.verificationStatus = 'verified';
    }

    await user.save();

    res.json({
      success: true,
      msg: `User role updated from ${oldRole} to ${role}`,
      user: {
        id: user._id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        userType: user.userType,
        verificationStatus: user.verificationStatus
      }
    });

  } catch (err) {
    console.error('Update role error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// @route   PUT api/admin/lessons/:lessonId/status
// @desc    Update lesson status
// @access  Private (Admin only)
router.put('/lessons/:lessonId/status', auth, checkAdmin, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { status, reason } = req.body;
    
    if (!status || !['published', 'archived', 'flagged'].includes(status)) {
      return res.status(400).json({ msg: 'Valid status is required' });
    }

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ msg: 'Lesson not found' });
    }

    const oldStatus = lesson.status;
    lesson.status = status;
    
    if (status === 'flagged' && reason) {
      lesson.adminNotes = reason;
    }

    await lesson.save();

    res.json({
      success: true,
      msg: `Lesson status updated from ${oldStatus} to ${status}`,
      lesson: {
        id: lesson._id,
        title: lesson.title,
        status: lesson.status,
        adminNotes: lesson.adminNotes
      }
    });

  } catch (err) {
    console.error('Update lesson status error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// @route   POST api/admin/shamcoins
// @desc    Add or remove sham coins from user
// @access  Private (Admin only)
router.post('/shamcoins', auth, checkAdmin, async (req, res) => {
  try {
    const { userId, amount, reason } = req.body;
    
    if (!userId || !amount) {
      return res.status(400).json({ msg: 'User ID and amount are required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const oldBalance = user.shamCoins;
    user.shamCoins += amount;
    
    if (user.shamCoins < 0) {
      return res.status(400).json({ msg: 'Cannot set negative sham coins balance' });
    }

    // Add transaction record
    const transactionType = amount > 0 ? 'admin_deposit' : 'admin_withdrawal';
    user.transactions.push({
      type: transactionType,
      amount: amount,
      description: reason || `Admin adjustment: ${amount > 0 ? '+' : ''}${amount} ShamCoins`,
      status: 'completed',
      reference: `ADMIN-${Date.now()}`
    });

    await user.save();

    res.json({
      success: true,
      msg: `Sham coins ${amount > 0 ? 'added to' : 'removed from'} user account`,
      adjustment: {
        userId: user._id,
        userEmail: user.email,
        userName: `${user.firstName} ${user.lastName}`,
        amount: amount,
        oldBalance: oldBalance,
        newBalance: user.shamCoins,
        reason: reason,
        transactionId: user.transactions[user.transactions.length - 1]._id
      }
    });

  } catch (err) {
    console.error('Adjust sham coins error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

module.exports = router;