const express = require('express');
const CreditApplication = require('../models/CreditApplication');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorHandler');
const { protect, checkPermission } = require('../middleware/auth');

const router = express.Router();

// @desc    Get dashboard overview
// @route   GET /api/dashboard/overview
// @access  Private
router.get('/overview', protect, asyncHandler(async (req, res) => {
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // Get basic counts
  const totalApplications = await CreditApplication.countDocuments();
  const pendingApplications = await CreditApplication.countDocuments({ 
    status: { $in: ['submitted', 'under_review', 'pending_documents'] } 
  });
  const todaysApplications = await CreditApplication.countDocuments({
    createdAt: { $gte: startOfDay }
  });

  // Get applications by status
  const statusBreakdown = await CreditApplication.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalValue: { $sum: '$loan.amount' }
      }
    }
  ]);

  // Get risk level distribution
  const riskDistribution = await CreditApplication.aggregate([
    {
      $match: { 'aiAssessment.riskLevel': { $exists: true } }
    },
    {
      $group: {
        _id: '$aiAssessment.riskLevel',
        count: { $sum: 1 },
        avgCreditScore: { $avg: '$aiAssessment.creditScore' }
      }
    }
  ]);

  // Get recent activity
  const recentApplications = await CreditApplication.find()
    .select('applicationId applicant.firstName applicant.lastName loan.amount status aiAssessment.riskLevel createdAt')
    .sort({ createdAt: -1 })
    .limit(10);

  // Get performance metrics
  const weeklyApplications = await CreditApplication.aggregate([
    {
      $match: { createdAt: { $gte: startOfWeek } }
    },
    {
      $group: {
        _id: { $dayOfWeek: '$createdAt' },
        count: { $sum: 1 },
        avgLoanAmount: { $avg: '$loan.amount' }
      }
    },
    {
      $sort: { '_id': 1 }
    }
  ]);

  // Get monthly trends
  const monthlyTrends = await CreditApplication.aggregate([
    {
      $match: { 
        createdAt: { 
          $gte: new Date(today.getFullYear(), today.getMonth() - 11, 1) 
        } 
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        applications: { $sum: 1 },
        totalValue: { $sum: '$loan.amount' },
        approved: {
          $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
        },
        denied: {
          $sum: { $cond: [{ $eq: ['$status', 'denied'] }, 1, 0] }
        }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 }
    }
  ]);

  // Get loan purpose distribution
  const purposeDistribution = await CreditApplication.aggregate([
    {
      $group: {
        _id: '$loan.purpose',
        count: { $sum: 1 },
        avgAmount: { $avg: '$loan.amount' },
        totalAmount: { $sum: '$loan.amount' }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);

  // Calculate approval rate
  const approvalStats = await CreditApplication.aggregate([
    {
      $match: { status: { $in: ['approved', 'denied'] } }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        approved: {
          $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
        }
      }
    }
  ]);

  const approvalRate = approvalStats.length > 0 ? 
    (approvalStats[0].approved / approvalStats[0].total * 100).toFixed(1) : 0;

  // Get average processing time
  const avgProcessingTime = await CreditApplication.aggregate([
    {
      $match: { 
        submittedAt: { $exists: true },
        completedAt: { $exists: true }
      }
    },
    {
      $project: {
        processingTime: {
          $divide: [
            { $subtract: ['$completedAt', '$submittedAt'] },
            1000 * 60 * 60 * 24 // Convert to days
          ]
        }
      }
    },
    {
      $group: {
        _id: null,
        avgDays: { $avg: '$processingTime' }
      }
    }
  ]);

  const avgProcessingDays = avgProcessingTime.length > 0 ? 
    avgProcessingTime[0].avgDays.toFixed(1) : 0;

  res.status(200).json({
    success: true,
    data: {
      summary: {
        totalApplications,
        pendingApplications,
        todaysApplications,
        approvalRate: parseFloat(approvalRate),
        avgProcessingDays: parseFloat(avgProcessingDays)
      },
      statusBreakdown,
      riskDistribution,
      recentApplications: recentApplications.map(app => ({
        id: app._id,
        applicationId: app.applicationId,
        applicantName: `${app.applicant.firstName} ${app.applicant.lastName}`,
        loanAmount: app.loan.amount,
        status: app.status,
        riskLevel: app.aiAssessment?.riskLevel,
        createdAt: app.createdAt
      })),
      weeklyApplications,
      monthlyTrends,
      purposeDistribution
    }
  });
}));

// @desc    Get user-specific dashboard
// @route   GET /api/dashboard/my-work
// @access  Private
router.get('/my-work', protect, asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Get applications assigned to current user
  const myApplications = await CreditApplication.find({
    'manualReview.assignedTo': userId
  })
  .select('applicationId applicant.firstName applicant.lastName loan.amount status aiAssessment.riskLevel manualReview.assignedAt')
  .sort({ 'manualReview.assignedAt': -1 })
  .limit(20);

  // Get my recent activity
  const myRecentActivity = await CreditApplication.find({
    'auditTrail.performedBy': userId
  })
  .select('applicationId auditTrail')
  .sort({ 'auditTrail.timestamp': -1 })
  .limit(10);

  // Get my performance stats
  const myStats = await CreditApplication.aggregate([
    {
      $match: { 'manualReview.assignedTo': userId }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  // Get pending reviews count
  const pendingReviews = await CreditApplication.countDocuments({
    'manualReview.assignedTo': userId,
    status: 'under_review'
  });

  // Get overdue applications (assigned more than 3 days ago)
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const overdueApplications = await CreditApplication.countDocuments({
    'manualReview.assignedTo': userId,
    'manualReview.assignedAt': { $lt: threeDaysAgo },
    status: 'under_review'
  });

  res.status(200).json({
    success: true,
    data: {
      summary: {
        assignedApplications: myApplications.length,
        pendingReviews,
        overdueApplications
      },
      myApplications: myApplications.map(app => ({
        id: app._id,
        applicationId: app.applicationId,
        applicantName: `${app.applicant.firstName} ${app.applicant.lastName}`,
        loanAmount: app.loan.amount,
        status: app.status,
        riskLevel: app.aiAssessment?.riskLevel,
        assignedAt: app.manualReview.assignedAt,
        daysAssigned: Math.floor((Date.now() - app.manualReview.assignedAt) / (24 * 60 * 60 * 1000))
      })),
      recentActivity: myRecentActivity.map(app => {
        const latestAction = app.auditTrail
          .filter(entry => entry.performedBy.toString() === userId.toString())
          .sort((a, b) => b.timestamp - a.timestamp)[0];
        
        return {
          applicationId: app.applicationId,
          action: latestAction.action,
          timestamp: latestAction.timestamp
        };
      }),
      performanceStats: myStats
    }
  });
}));

// @desc    Get analytics data
// @route   GET /api/dashboard/analytics
// @access  Private - requires admin or analyst role
router.get('/analytics',
  protect,
  checkPermission('reports', 'read'),
  asyncHandler(async (req, res) => {
    const { timeframe = '30d', metric = 'volume' } = req.query;
    
    // Calculate date range
    const endDate = new Date();
    let startDate;
    
    switch (timeframe) {
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    // Application volume over time
    const volumeData = await CreditApplication.aggregate([
      {
        $match: { 
          createdAt: { $gte: startDate, $lte: endDate } 
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 },
          totalValue: { $sum: '$loan.amount' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    // Risk distribution trends
    const riskTrends = await CreditApplication.aggregate([
      {
        $match: { 
          createdAt: { $gte: startDate, $lte: endDate },
          'aiAssessment.riskLevel': { $exists: true }
        }
      },
      {
        $group: {
          _id: {
            date: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            riskLevel: '$aiAssessment.riskLevel'
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.date.year': 1, '_id.date.month': 1, '_id.date.day': 1 }
      }
    ]);

    // Credit score distribution
    const creditScoreDistribution = await CreditApplication.aggregate([
      {
        $match: { 
          'aiAssessment.creditScore': { $exists: true, $ne: null }
        }
      },
      {
        $bucket: {
          groupBy: '$aiAssessment.creditScore',
          boundaries: [300, 400, 500, 600, 650, 700, 750, 800, 850],
          default: 'other',
          output: {
            count: { $sum: 1 },
            avgLoanAmount: { $avg: '$loan.amount' }
          }
        }
      }
    ]);

    // Loan amount distribution
    const loanAmountDistribution = await CreditApplication.aggregate([
      {
        $bucket: {
          groupBy: '$loan.amount',
          boundaries: [0, 10000, 25000, 50000, 100000, 250000, 500000, 1000000],
          default: 'other',
          output: {
            count: { $sum: 1 },
            avgCreditScore: { $avg: '$aiAssessment.creditScore' }
          }
        }
      }
    ]);

    // Processing efficiency metrics
    const efficiencyMetrics = await CreditApplication.aggregate([
      {
        $match: {
          submittedAt: { $exists: true },
          completedAt: { $exists: true }
        }
      },
      {
        $project: {
          processingTime: {
            $divide: [
              { $subtract: ['$completedAt', '$submittedAt'] },
              1000 * 60 * 60 // Convert to hours
            ]
          },
          autoProcessed: { $ne: ['$manualReview.assignedTo', null] }
        }
      },
      {
        $group: {
          _id: '$autoProcessed',
          avgProcessingTime: { $avg: '$processingTime' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Fraud detection effectiveness
    const fraudStats = await CreditApplication.aggregate([
      {
        $match: { 
          'aiAssessment.fraudAssessment': { $exists: true }
        }
      },
      {
        $group: {
          _id: '$aiAssessment.fraudAssessment.riskLevel',
          count: { $sum: 1 },
          avgCreditScore: { $avg: '$aiAssessment.creditScore' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        timeframe,
        dateRange: { startDate, endDate },
        volumeData,
        riskTrends,
        creditScoreDistribution,
        loanAmountDistribution,
        efficiencyMetrics,
        fraudStats
      }
    });
  })
);

// @desc    Get team performance metrics
// @route   GET /api/dashboard/team-performance
// @access  Private - requires admin role
router.get('/team-performance',
  protect,
  checkPermission('reports', 'read'),
  asyncHandler(async (req, res) => {
    // Get all underwriters and analysts
    const teamMembers = await User.find({
      role: { $in: ['underwriter', 'analyst'] },
      isActive: true
    }).select('firstName lastName username role');

    // Get performance metrics for each team member
    const teamPerformance = await Promise.all(
      teamMembers.map(async (member) => {
        const assigned = await CreditApplication.countDocuments({
          'manualReview.assignedTo': member._id
        });

        const completed = await CreditApplication.countDocuments({
          'manualReview.assignedTo': member._id,
          status: { $in: ['approved', 'denied'] }
        });

        const pending = await CreditApplication.countDocuments({
          'manualReview.assignedTo': member._id,
          status: 'under_review'
        });

        // Calculate average processing time
        const avgProcessingTime = await CreditApplication.aggregate([
          {
            $match: {
              'manualReview.assignedTo': member._id,
              'manualReview.assignedAt': { $exists: true },
              'manualReview.decision.decidedAt': { $exists: true }
            }
          },
          {
            $project: {
              processingTime: {
                $divide: [
                  { $subtract: ['$manualReview.decision.decidedAt', '$manualReview.assignedAt'] },
                  1000 * 60 * 60 * 24 // Convert to days
                ]
              }
            }
          },
          {
            $group: {
              _id: null,
              avgDays: { $avg: '$processingTime' }
            }
          }
        ]);

        return {
          user: {
            id: member._id,
            name: `${member.firstName} ${member.lastName}`,
            username: member.username,
            role: member.role
          },
          metrics: {
            assigned,
            completed,
            pending,
            completionRate: assigned > 0 ? ((completed / assigned) * 100).toFixed(1) : 0,
            avgProcessingDays: avgProcessingTime.length > 0 ? 
              avgProcessingTime[0].avgDays.toFixed(1) : 0
          }
        };
      })
    );

    // Get overall team metrics
    const teamSummary = {
      totalMembers: teamMembers.length,
      totalAssigned: teamPerformance.reduce((sum, member) => sum + member.metrics.assigned, 0),
      totalCompleted: teamPerformance.reduce((sum, member) => sum + member.metrics.completed, 0),
      totalPending: teamPerformance.reduce((sum, member) => sum + member.metrics.pending, 0)
    };

    teamSummary.avgCompletionRate = teamSummary.totalAssigned > 0 ? 
      ((teamSummary.totalCompleted / teamSummary.totalAssigned) * 100).toFixed(1) : 0;

    res.status(200).json({
      success: true,
      data: {
        teamSummary,
        teamPerformance: teamPerformance.sort((a, b) => b.metrics.completed - a.metrics.completed)
      }
    });
  })
);

// @desc    Get alerts and notifications
// @route   GET /api/dashboard/alerts
// @access  Private
router.get('/alerts', protect, asyncHandler(async (req, res) => {
  const alerts = [];

  // Check for overdue applications
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const overdueCount = await CreditApplication.countDocuments({
    status: 'under_review',
    'manualReview.assignedAt': { $lt: threeDaysAgo }
  });

  if (overdueCount > 0) {
    alerts.push({
      type: 'warning',
      title: 'Overdue Applications',
      message: `${overdueCount} application(s) have been under review for more than 3 days`,
      priority: 'high',
      timestamp: new Date()
    });
  }

  // Check for high-risk applications
  const highRiskCount = await CreditApplication.countDocuments({
    status: 'submitted',
    'aiAssessment.riskLevel': 'VERY_HIGH'
  });

  if (highRiskCount > 0) {
    alerts.push({
      type: 'error',
      title: 'High Risk Applications',
      message: `${highRiskCount} very high-risk application(s) require immediate attention`,
      priority: 'urgent',
      timestamp: new Date()
    });
  }

  // Check for potential fraud
  const fraudCount = await CreditApplication.countDocuments({
    status: { $in: ['submitted', 'under_review'] },
    'aiAssessment.fraudAssessment.riskLevel': 'HIGH'
  });

  if (fraudCount > 0) {
    alerts.push({
      type: 'error',
      title: 'Potential Fraud Detected',
      message: `${fraudCount} application(s) flagged for potential fraud`,
      priority: 'urgent',
      timestamp: new Date()
    });
  }

  // Check for unassigned applications
  const unassignedCount = await CreditApplication.countDocuments({
    status: 'submitted',
    'manualReview.assignedTo': { $exists: false }
  });

  if (unassignedCount > 5) {
    alerts.push({
      type: 'info',
      title: 'Unassigned Applications',
      message: `${unassignedCount} applications waiting for assignment`,
      priority: 'medium',
      timestamp: new Date()
    });
  }

  res.status(200).json({
    success: true,
    data: {
      alerts,
      totalAlerts: alerts.length,
      hasUrgent: alerts.some(alert => alert.priority === 'urgent')
    }
  });
}));

module.exports = router;