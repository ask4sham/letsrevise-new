// src/types/index.ts

// Component Props Types
export interface ProtectedRouteProps {
  children: React.ReactNode; 
  requireTeacher?: boolean;
  requireStudent?: boolean;
  requireAdmin?: boolean;
}

// Common Types
export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  userType: 'student' | 'teacher' | 'admin';
  verificationStatus: string;
  shamCoins: number;
  subscription?: {
    plan: string;
    endDate: string;
  };
  entitlements?: {
    hasActiveSub: boolean;
    isTrial: boolean;
    expiresAt: string | null;
  };
  createdAt: string;
  lastActive: string;
  stats?: any;
}

export interface Lesson {
  _id: string;
  title: string;
  description: string;
  content: string;
  subject: string;
  level: string;
  topic: string;
  teacherName: string;
  teacherId: string;
  estimatedDuration: number;
  shamCoinPrice: number;
  isPublished: boolean;
  views: number;
  averageRating: number;
  totalRatings: number;
  createdAt: string;
}

export interface Review {
  _id: string;
  studentName: string;
  rating: number;
  review: string;
  helpfulCount: number;
  createdAt: string;
}

export interface Transaction {
  _id: string;
  userId: string;
  userEmail: string;
  userName: string;
  userType: string;
  type: string;
  amount: number;
  date: string;
  description: string;
  reference?: string;
  lessonId?: string;
}

// Component Props Types
export interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  padding?: 'sm' | 'md' | 'lg';
}

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  text?: string;
}

export interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  color?: string;
}

export interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  onClose?: () => void;
}

export interface SEOProps {
  title: string;
  description: string;
  keywords: string;
  image?: string;
  url?: string;
  type?: string;
}

export interface RatingDisplayProps {
  rating: number;
  totalRatings?: number;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
}

export interface ReviewFormProps {
  lessonId: string;
  onReviewSubmitted?: () => void;
}

export interface ReviewListProps {
  lessonId: string;
}

export interface EarningsChartProps {
  monthlyEarnings: Array<{month: string, earnings: number}>;
}