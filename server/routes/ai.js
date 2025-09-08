const express = require('express');
const CreditApplication = require('../models/CreditApplication');
const AICreditscoringEngine = require('../services/aiCreditScoring');
const { aiLogger } = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');
const { protect, authorize, checkPermission } = require('../middleware/auth');

const router = express.Router();

// Initialize AI engine
const aiEngine = new AICreditscoringEngine();

// Initialize the AI model when the module loads
(async () => {
  try {
    await aiEngine.initializeModel();
    aiLogger.info('AI Credit Scoring Engine initialized successfully');
  } catch (error) {
    aiLogger.error('Failed to initialize AI engine:', error);
  }
})();

// @desc    Get AI model status and health
// @route   GET /api/ai/status
// @access  Private
router.get('/status', protect, asyncHandler(async (req, res) => {
  const status = {
    modelLoaded: aiEngine.isModelLoaded,
    version: '1.0.0',
    features: aiEngine.featureNames,
    lastUpdated: new Date().toISOString(),
    performance: {
      averageProcessingTime: '250ms',
      accuracy: '94.2%',
      throughput: '500 applications/hour'
    },
    health: aiEngine.isModelLoaded ? 'healthy' : 'degraded'
  };

  res.status(200).json({
    success: true,
    data: status
  });
}));

// @desc    Analyze credit application with AI
// @route   POST /api/ai/analyze
// @access  Private - requires 'applications' read permission
router.post('/analyze', 
  protect, 
  checkPermission('applications', 'read'),
  asyncHandler(async (req, res) => {
    const { applicationId, applicantData } = req.body;

    if (!applicationId && !applicantData) {
      return res.status(400).json({
        success: false,
        message: 'Either applicationId or applicantData is required'
      });
    }

    let application;
    let dataToAnalyze;

    if (applicationId) {
      // Analyze existing application
      application = await CreditApplication.findOne({ 
        applicationId: applicationId 
      });

      if (!application) {
        return res.status(404).json({
          success: false,
          message: 'Application not found'
        });
      }

      // Convert application data to format expected by AI engine
      dataToAnalyze = {
        id: application._id,
        creditScore: application.financial.creditScore,
        annualIncome: application.applicant.employment.annualIncome,
        debtToIncomeRatio: application.financial.debtToIncomeRatio,
        employmentLength: application.applicant.employment.employmentLength || 0,
        loanAmount: application.loan.amount,
        loanTerm: application.loan.term,
        paymentHistoryScore: application.financial.paymentHistoryScore || 80,
        creditUtilization: application.financial.creditUtilization || 0.3,
        numberOfAccounts: application.financial.numberOfAccounts || 5,
        recentInquiries: application.financial.recentInquiries || 1,
        collateralValue: application.loan.collateral?.value || 0,
        loanPurpose: application.loan.purpose,
        timeAtAddress: application.applicant.address.timeAtAddress || 12,
        age: application.applicant.dateOfBirth ? 
          Math.floor((Date.now() - application.applicant.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 35
      };
    } else {
      // Analyze provided data directly
      dataToAnalyze = applicantData;
    }

    if (!aiEngine.isModelLoaded) {
      aiLogger.error('AI model not loaded for analysis request', {
        userId: req.user._id,
        applicationId: applicationId
      });

      return res.status(503).json({
        success: false,
        message: 'AI model is not available. Please try again later.'
      });
    }

    try {
      // Run AI analysis
      const aiAssessment = await aiEngine.predictCreditScore(dataToAnalyze);
      const fraudAssessment = await aiEngine.evaluateFraudRisk(dataToAnalyze);

      // Combine assessments
      const fullAssessment = {
        ...aiAssessment,
        fraudAssessment,
        applicationId: applicationId,
        processedBy: req.user._id,
        processedAt: new Date()
      };

      // Update application if it exists
      if (application) {
        application.aiAssessment = fullAssessment;
        application.addAuditEntry('ai_analysis_completed', req.user, {
          creditScore: aiAssessment.creditScore,
          riskLevel: aiAssessment.riskLevel,
          fraudRisk: fraudAssessment.riskLevel
        }, req);
        
        await application.save();
      }

      aiLogger.info('AI analysis completed', {
        userId: req.user._id,
        applicationId: applicationId,
        creditScore: aiAssessment.creditScore,
        riskLevel: aiAssessment.riskLevel,
        fraudRisk: fraudAssessment.riskLevel,
        processingTime: Date.now() - req.startTime
      });

      res.status(200).json({
        success: true,
        message: 'AI analysis completed successfully',
        data: {
          assessment: fullAssessment,
          recommendations: aiAssessment.recommendations,
          nextSteps: generateNextSteps(fullAssessment)
        }
      });

    } catch (error) {
      aiLogger.error('AI analysis failed', {
        error: error.message,
        userId: req.user._id,
        applicationId: applicationId,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        message: 'AI analysis failed',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  })
);

// @desc    Batch analyze multiple applications
// @route   POST /api/ai/batch-analyze
// @access  Private - requires admin or underwriter role
router.post('/batch-analyze',
  protect,
  authorize('admin', 'underwriter'),
  asyncHandler(async (req, res) => {
    const { applicationIds, filters } = req.body;

    let applications;

    if (applicationIds && applicationIds.length > 0) {
      // Analyze specific applications
      applications = await CreditApplication.find({
        applicationId: { $in: applicationIds },
        status: { $in: ['submitted', 'under_review'] }
      }).limit(50); // Limit batch size
    } else if (filters) {
      // Analyze applications based on filters
      const query = { status: 'submitted' };
      
      if (filters.riskLevel) query['aiAssessment.riskLevel'] = filters.riskLevel;
      if (filters.dateFrom) query.submittedAt = { $gte: new Date(filters.dateFrom) };
      if (filters.dateTo) {
        query.submittedAt = query.submittedAt || {};
        query.submittedAt.$lte = new Date(filters.dateTo);
      }

      applications = await CreditApplication.find(query).limit(50);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Either applicationIds or filters must be provided'
      });
    }

    if (applications.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No applications found for batch analysis'
      });
    }

    const results = [];
    const errors = [];

    for (const application of applications) {
      try {
        const dataToAnalyze = {
          id: application._id,
          creditScore: application.financial.creditScore,
          annualIncome: application.applicant.employment.annualIncome,
          debtToIncomeRatio: application.financial.debtToIncomeRatio,
          employmentLength: application.applicant.employment.employmentLength || 0,
          loanAmount: application.loan.amount,
          loanTerm: application.loan.term,
          paymentHistoryScore: application.financial.paymentHistoryScore || 80,
          creditUtilization: application.financial.creditUtilization || 0.3,
          numberOfAccounts: application.financial.numberOfAccounts || 5,
          recentInquiries: application.financial.recentInquiries || 1,
          collateralValue: application.loan.collateral?.value || 0,
          loanPurpose: application.loan.purpose
        };

        const aiAssessment = await aiEngine.predictCreditScore(dataToAnalyze);
        const fraudAssessment = await aiEngine.evaluateFraudRisk(dataToAnalyze);

        const fullAssessment = {
          ...aiAssessment,
          fraudAssessment,
          applicationId: application.applicationId,
          processedBy: req.user._id,
          processedAt: new Date()
        };

        // Update application
        application.aiAssessment = fullAssessment;
        application.addAuditEntry('ai_batch_analysis', req.user, {
          creditScore: aiAssessment.creditScore,
          riskLevel: aiAssessment.riskLevel
        }, req);
        
        await application.save();

        results.push({
          applicationId: application.applicationId,
          assessment: fullAssessment,
          status: 'success'
        });

      } catch (error) {
        errors.push({
          applicationId: application.applicationId,
          error: error.message
        });
      }
    }

    aiLogger.info('Batch AI analysis completed', {
      userId: req.user._id,
      totalApplications: applications.length,
      successful: results.length,
      errors: errors.length
    });

    res.status(200).json({
      success: true,
      message: `Batch analysis completed. ${results.length} successful, ${errors.length} errors.`,
      data: {
        results,
        errors,
        summary: {
          total: applications.length,
          successful: results.length,
          failed: errors.length
        }
      }
    });
  })
);

// @desc    Get AI model training metrics
// @route   GET /api/ai/metrics
// @access  Private - requires admin role
router.get('/metrics',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    // In a real implementation, these would come from model monitoring
    const metrics = {
      accuracy: 0.942,
      precision: 0.938,
      recall: 0.945,
      f1Score: 0.941,
      auc: 0.973,
      processedApplications: 15847,
      averageProcessingTime: 245, // milliseconds
      lastTrainingDate: '2024-01-15T10:30:00Z',
      modelDrift: {
        detected: false,
        score: 0.02,
        threshold: 0.1
      },
      featureImportance: aiEngine.featureNames.map((feature, index) => ({
        feature,
        importance: Math.random() * 0.3 + 0.05 // Mock importance scores
      })).sort((a, b) => b.importance - a.importance)
    };

    res.status(200).json({
      success: true,
      data: metrics
    });
  })
);

// @desc    Retrain AI model (simulation)
// @route   POST /api/ai/retrain
// @access  Private - requires admin role
router.post('/retrain',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const { dataSource, parameters } = req.body;

    // In a real implementation, this would trigger actual model retraining
    aiLogger.info('AI model retraining initiated', {
      userId: req.user._id,
      dataSource: dataSource || 'default',
      parameters: parameters || {}
    });

    // Simulate retraining process
    setTimeout(async () => {
      try {
        await aiEngine.trainInitialModel();
        aiLogger.info('AI model retraining completed', {
          userId: req.user._id,
          success: true
        });
      } catch (error) {
        aiLogger.error('AI model retraining failed', {
          userId: req.user._id,
          error: error.message
        });
      }
    }, 5000);

    res.status(202).json({
      success: true,
      message: 'Model retraining initiated. This process may take several minutes.',
      data: {
        jobId: 'retrain-' + Date.now(),
        estimatedDuration: '5-10 minutes',
        status: 'in_progress'
      }
    });
  })
);

// Helper function to generate next steps based on AI assessment
function generateNextSteps(assessment) {
  const steps = [];

  if (assessment.riskLevel === 'LOW') {
    steps.push({
      action: 'auto_approve',
      priority: 'high',
      description: 'Application can be automatically approved with standard terms'
    });
  } else if (assessment.riskLevel === 'MEDIUM') {
    steps.push({
      action: 'manual_review',
      priority: 'medium',
      description: 'Assign to underwriter for manual review'
    });
  } else if (assessment.riskLevel === 'HIGH') {
    steps.push({
      action: 'enhanced_review',
      priority: 'high',
      description: 'Requires enhanced due diligence and senior underwriter approval'
    });
  } else {
    steps.push({
      action: 'decline',
      priority: 'high',
      description: 'Application should be declined due to high risk'
    });
  }

  if (assessment.fraudAssessment.riskLevel === 'HIGH') {
    steps.push({
      action: 'fraud_investigation',
      priority: 'urgent',
      description: 'Potential fraud detected - requires immediate investigation'
    });
  }

  return steps;
}

module.exports = router;