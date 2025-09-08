export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: 'admin' | 'underwriter' | 'analyst' | 'viewer';
  department: 'credit' | 'risk' | 'compliance' | 'operations';
  permissions: Permission[];
  lastLogin?: Date;
  isActive: boolean;
}

export interface Permission {
  resource: string;
  actions: string[];
}

export interface CreditApplication {
  id: string;
  applicationId: string;
  applicant: {
    firstName: string;
    lastName: string;
    middleName?: string;
    dateOfBirth: Date;
    ssn: string;
    email: string;
    phone: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
      timeAtAddress: number;
    };
    employment: {
      status: 'employed' | 'self-employed' | 'unemployed' | 'retired' | 'student';
      employer?: string;
      jobTitle?: string;
      industry?: string;
      employmentLength?: number;
      annualIncome: number;
      monthlyIncome: number;
      otherIncome: number;
    };
  };
  loan: {
    amount: number;
    purpose: 'home_purchase' | 'home_improvement' | 'debt_consolidation' | 'auto_loan' | 'business' | 'education' | 'medical' | 'vacation' | 'other';
    term: number;
    requestedRate?: number;
    downPayment: number;
    collateral: {
      type: 'real_estate' | 'vehicle' | 'investment' | 'none';
      value: number;
      description?: string;
    };
  };
  financial: {
    creditScore?: number;
    bankAccount: {
      checking: number;
      savings: number;
      investment: number;
    };
    monthlyExpenses: {
      housing: number;
      utilities: number;
      transportation: number;
      insurance: number;
      food: number;
      other: number;
    };
    existingDebts: {
      type: 'credit_card' | 'mortgage' | 'auto_loan' | 'student_loan' | 'personal_loan' | 'other';
      balance: number;
      monthlyPayment: number;
      creditor: string;
    }[];
    debtToIncomeRatio?: number;
    creditUtilization?: number;
    paymentHistoryScore?: number;
    numberOfAccounts: number;
    recentInquiries: number;
  };
  status: 'draft' | 'submitted' | 'under_review' | 'pending_documents' | 'approved' | 'denied' | 'withdrawn';
  aiAssessment?: {
    creditScore: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
    probability: number;
    factors: {
      factor: string;
      impact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
      description: string;
    }[];
    recommendations: {
      type: 'APPROVAL' | 'IMPROVEMENT' | 'RISK_MITIGATION';
      priority: 'LOW' | 'MEDIUM' | 'HIGH';
      description: string;
      action: string;
    }[];
    fraudAssessment: {
      fraudScore: number;
      riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
      riskFactors: string[];
      recommendation: 'AUTOMATED_PROCESSING' | 'MANUAL_REVIEW';
    };
    processedAt: Date;
    modelVersion: string;
  };
  manualReview?: {
    assignedTo?: User;
    assignedAt?: Date;
    reviewNotes: {
      note: string;
      createdBy: User;
      createdAt: Date;
      category: 'general' | 'income' | 'credit' | 'collateral' | 'risk';
    }[];
    decision?: {
      outcome: 'approved' | 'denied' | 'conditional';
      reason?: string;
      conditions: string[];
      decidedBy: User;
      decidedAt: Date;
    };
  };
  documents: {
    type: 'pay_stub' | 'tax_return' | 'bank_statement' | 'employment_verification' | 'id_copy' | 'utility_bill' | 'other';
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    uploadDate: Date;
    verified: boolean;
    verifiedBy?: User;
    verifiedAt?: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
  submittedAt?: Date;
  completedAt?: Date;
}

export interface DashboardStats {
  summary: {
    totalApplications: number;
    pendingApplications: number;
    todaysApplications: number;
    approvalRate: number;
    avgProcessingDays: number;
  };
  statusBreakdown: {
    _id: string;
    count: number;
    totalValue: number;
  }[];
  riskDistribution: {
    _id: string;
    count: number;
    avgCreditScore: number;
  }[];
  recentApplications: {
    id: string;
    applicationId: string;
    applicantName: string;
    loanAmount: number;
    status: string;
    riskLevel?: string;
    createdAt: Date;
  }[];
  monthlyTrends: {
    _id: {
      year: number;
      month: number;
    };
    applications: number;
    totalValue: number;
    approved: number;
    denied: number;
  }[];
  purposeDistribution: {
    _id: string;
    count: number;
    avgAmount: number;
    totalAmount: number;
  }[];
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    message: string;
    stack?: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T> {
  data: {
    applications?: T[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalApplications: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  token: string | null;
}

export interface NotificationContextType {
  showNotification: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  hideNotification: () => void;
}

export interface AIModelStatus {
  modelLoaded: boolean;
  version: string;
  features: string[];
  lastUpdated: string;
  performance: {
    averageProcessingTime: string;
    accuracy: string;
    throughput: string;
  };
  health: 'healthy' | 'degraded' | 'down';
}

export interface AIMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  auc: number;
  processedApplications: number;
  averageProcessingTime: number;
  lastTrainingDate: string;
  modelDrift: {
    detected: boolean;
    score: number;
    threshold: number;
  };
  featureImportance: {
    feature: string;
    importance: number;
  }[];
}

export interface TeamPerformance {
  user: {
    id: string;
    name: string;
    username: string;
    role: string;
  };
  metrics: {
    assigned: number;
    completed: number;
    pending: number;
    completionRate: string;
    avgProcessingDays: string;
  };
}

export interface Alert {
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  timestamp: Date;
}