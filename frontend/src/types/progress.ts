export interface LessonProgress {
  lessonId: string;
  title: string;
  subject: string;
  level: string;
  purchasedAt: string;
  completed: boolean;
  completedAt?: string;
  progress: number;
  lastAccessed?: string;
  timeSpentMinutes: number;
  rating?: number;
  review?: string;
  reviewedAt?: string;
}

export interface StudentStats {
  totalPurchased: number;
  totalCompleted: number;
  totalInProgress: number;
  totalNotStarted: number;
  completionRate: number;
  averageProgress: number;
  totalTimeSpentMinutes: number;
  totalShamCoinsSpent: number;
  streakDays: number;
  estimatedTotalDurationMinutes: number;
  timeCompletionRatio: number;
  subjectProgress: SubjectProgress[];
}

export interface SubjectProgress {
  subject: string;
  totalLessons: number;
  completedLessons: number;
  averageProgress: number;
}

export interface RecentActivity {
  lessonId: string;
  title: string;
  subject: string;
  lastAccessed: string;
  progress: number;
  completed: boolean;
}

export interface ProgressStatsResponse {
  success: boolean;
  stats: StudentStats;
  recentActivity: RecentActivity[];
}