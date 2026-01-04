const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  userType: {
    type: String,
    required: true,
    enum: ['teacher', 'student', 'parent', 'admin']
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },

  // NEW: explicit school name for both teachers & students
  schoolName: {
    type: String,
    trim: true,
    default: null
  },

  // Existing field – keep as-is in case other parts of the app use it
  institution: {
    type: String,
    trim: true
  },

  verificationStatus: {
    type: String,
    default: 'pending',
    enum: ['pending', 'verified', 'rejected']
  },
  shamCoins: {
    type: Number,
    default: 100
  },
  earnings: {
    type: Number,
    default: 0
  },
  balance: {
    type: Number,
    default: 0
  },
  totalWithdrawn: {
    type: Number,
    default: 0
  },
  subscription: {
    type: String,
    enum: ['free', 'basic', 'premium', 'enterprise'],
    default: 'free'
  },
  subscriptionEndDate: {
    type: Date
  },
  monthlyShamCoinAllowance: {
    type: Number,
    default: 0
  },
  shamCoinsEarnedThisMonth: {
    type: Number,
    default: 0
  },
  referralCode: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  referredBy: {
    type: String,
    trim: true
  },
  purchasedLessons: [{
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson'
    },
    purchasedAt: {
      type: Date,
      default: Date.now
    },
    price: {
      type: Number
    },
    completed: {
      type: Boolean,
      default: false
    },
    completedAt: Date,
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    lastAccessed: Date,
    timeSpentMinutes: {
      type: Number,
      default: 0
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    review: String,
    reviewedAt: Date
  }],
  studentStats: {
    totalLessonsPurchased: {
      type: Number,
      default: 0
    },
    totalLessonsCompleted: {
      type: Number,
      default: 0
    },
    totalShamCoinsSpent: {
      type: Number,
      default: 0
    },
    totalLearningTimeMinutes: {
      type: Number,
      default: 0
    },
    averageProgress: {
      type: Number,
      default: 0
    },
    streakDays: {
      type: Number,
      default: 0
    },
    lastActiveDate: Date
  },
  teacherStats: {
    totalLessonsCreated: {
      type: Number,
      default: 0
    },
    totalEarningsShamCoins: {
      type: Number,
      default: 0
    },
    totalStudents: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      default: 0
    },
    totalReviews: {
      type: Number,
      default: 0
    }
  },
  createdLessons: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson'
  }],
  transactions: [{
    type: {
      type: String,
      enum: ['purchase', 'sale', 'cashout', 'refund', 'deposit', 'withdrawal', 'transfer']
    },
    amount: {
      type: Number
    },
    date: {
      type: Date,
      default: Date.now
    },
    description: String,
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson'
    },
    status: {
      type: String,
      default: 'completed',
      enum: ['pending', 'completed', 'failed', 'cancelled']
    },
    reference: String
  }]
}, {
  timestamps: true
});

// Mongoose 9 compatible middleware - no next parameter for non-async
userSchema.pre('save', function() {
  this.updatedAt = Date.now();
  
  // Auto-update student stats
  if (this.isModified('purchasedLessons') && this.userType === 'student') {
    const purchasedLessons = this.purchasedLessons || [];
    this.studentStats.totalLessonsPurchased = purchasedLessons.length;
    this.studentStats.totalLessonsCompleted = purchasedLessons.filter(lesson => lesson.completed).length;
    this.studentStats.totalShamCoinsSpent = purchasedLessons.reduce((sum, lesson) => sum + (lesson.price || 0), 0);
    this.studentStats.totalLearningTimeMinutes = purchasedLessons.reduce((sum, lesson) => sum + (lesson.timeSpentMinutes || 0), 0);

    if (purchasedLessons.length > 0) {
      const totalProgress = purchasedLessons.reduce((sum, lesson) => sum + (lesson.progress || 0), 0);
      this.studentStats.averageProgress = totalProgress / purchasedLessons.length;
    }
  }

  // Auto-update teacher stats
  if (this.isModified('earnings') && this.userType === 'teacher') {
    this.teacherStats.totalEarningsShamCoins = this.earnings || 0;
  }
});

module.exports = mongoose.model('User', userSchema);
