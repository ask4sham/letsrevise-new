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
    enum: ['teacher', 'student', 'admin']
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
      ref: 'Lesson',
      required: true
    },
    purchasedAt: {
      type: Date,
      default: Date.now
    },
    price: {
      type: Number,
      required: true
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
      type: Number,
      required: true
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
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

userSchema.index({ referralCode: 1 }, {
  unique: true,
  sparse: true,
  name: 'referralCode_sparse'
});

userSchema.index({ 'purchasedLessons.lessonId': 1 });
userSchema.index({ 'transactions.date': -1 });
userSchema.index({ 'transactions.type': 1 });
userSchema.index({ subscription: 1, subscriptionEndDate: 1 });

// FIXED: Proper async middleware
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// ADDED: Auto-update student stats when purchasedLessons changes
userSchema.pre('save', function(next) {
  if (this.isModified('purchasedLessons') && this.userType === 'student') {
    const purchasedLessons = this.purchasedLessons || [];
    this.studentStats.totalLessonsPurchased = purchasedLessons.length;
    this.studentStats.totalLessonsCompleted = purchasedLessons.filter(lesson => lesson.completed).length;
    this.studentStats.totalShamCoinsSpent = purchasedLessons.reduce((sum, lesson) => sum + lesson.price, 0);
    this.studentStats.totalLearningTimeMinutes = purchasedLessons.reduce((sum, lesson) => sum + (lesson.timeSpentMinutes || 0), 0);

    if (purchasedLessons.length > 0) {
      const totalProgress = purchasedLessons.reduce((sum, lesson) => sum + (lesson.progress || 0), 0);
      this.studentStats.averageProgress = totalProgress / purchasedLessons.length;
    }
  }

  if (this.isModified('earnings') && this.userType === 'teacher') {
    this.teacherStats.totalEarningsShamCoins = this.earnings || 0;
  }
  
  next();
});

userSchema.virtual('totalFunds').get(function() {
  return (this.shamCoins || 0) + (this.earnings || 0) + (this.balance || 0);
});

userSchema.virtual('nextPaymentDate').get(function() {
  if (this.subscriptionEndDate) {
    return new Date(this.subscriptionEndDate);
  }
  return null;
});

userSchema.virtual('daysUntilExpiry').get(function() {
  if (this.subscriptionEndDate) {
    const today = new Date();
    const expiryDate = new Date(this.subscriptionEndDate);
    const diffTime = expiryDate - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  return null;
});

module.exports = mongoose.model('User', userSchema);
