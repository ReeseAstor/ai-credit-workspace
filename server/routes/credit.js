const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const CreditApplication = require('../models/CreditApplication');
const { creditLogger } = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');
const { protect, checkPermission, authorize } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../../uploads', req.user._id.toString());
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || 
    ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'];
  
  const fileExtension = path.extname(file.originalname).toLowerCase().substring(1);
  
  if (allowedTypes.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error(`File type '${fileExtension}' is not allowed. Allowed types: ${allowedTypes.join(', ')}`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
    files: 10 // Maximum 10 files per upload
  }
});

// @desc    Create new credit application
// @route   POST /api/credit/applications
// @access  Private - requires 'applications' create permission
router.post('/applications',
  protect,
  checkPermission('applications', 'create'),
  asyncHandler(async (req, res) => {
    const applicationData = req.body;

    // Validate required fields
    const requiredFields = [
      'applicant.firstName',
      'applicant.lastName',
      'applicant.dateOfBirth',
      'applicant.ssn',
      'applicant.email',
      'applicant.employment.annualIncome',
      'loan.amount',
      'loan.purpose',
      'loan.term'
    ];

    const missingFields = [];
    requiredFields.forEach(field => {
      const fieldValue = field.split('.').reduce((obj, key) => obj && obj[key], applicationData);
      if (!fieldValue) {
        missingFields.push(field);
      }
    });

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        missingFields
      });
    }

    // Create application
    const application = new CreditApplication(applicationData);
    
    // Add audit trail entry
    application.addAuditEntry('application_created', req.user, {
      loanAmount: application.loan.amount,
      loanPurpose: application.loan.purpose
    }, req);

    await application.save();

    creditLogger.info('New credit application created', {
      applicationId: application.applicationId,
      applicantName: application.applicantFullName,
      loanAmount: application.loan.amount,
      createdBy: req.user._id,
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'Credit application created successfully',
      data: {
        application: {
          id: application._id,
          applicationId: application.applicationId,
          applicantName: application.applicantFullName,
          loanAmount: application.loan.amount,
          loanPurpose: application.loan.purpose,
          status: application.status,
          createdAt: application.createdAt
        }
      }
    });
  })
);

// @desc    Get all credit applications
// @route   GET /api/credit/applications
// @access  Private - requires 'applications' read permission
router.get('/applications',
  protect,
  checkPermission('applications', 'read'),
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build filter query
    const filter = {};
    
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    if (req.query.riskLevel) {
      filter['aiAssessment.riskLevel'] = req.query.riskLevel;
    }
    
    if (req.query.assignedTo) {
      filter['manualReview.assignedTo'] = req.query.assignedTo;
    }
    
    if (req.query.dateFrom || req.query.dateTo) {
      filter.createdAt = {};
      if (req.query.dateFrom) filter.createdAt.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo) filter.createdAt.$lte = new Date(req.query.dateTo);
    }

    if (req.query.search) {
      filter.$or = [
        { applicationId: { $regex: req.query.search, $options: 'i' } },
        { 'applicant.firstName': { $regex: req.query.search, $options: 'i' } },
        { 'applicant.lastName': { $regex: req.query.search, $options: 'i' } },
        { 'applicant.email': { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Sort options
    const sortOptions = {};
    if (req.query.sortBy) {
      const sortField = req.query.sortBy;
      const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
      sortOptions[sortField] = sortOrder;
    } else {
      sortOptions.createdAt = -1; // Default sort by newest first
    }

    const applications = await CreditApplication.find(filter)
      .select('applicationId applicant.firstName applicant.lastName applicant.email loan.amount loan.purpose status aiAssessment.riskLevel aiAssessment.creditScore manualReview.assignedTo createdAt submittedAt')
      .populate('manualReview.assignedTo', 'firstName lastName username')
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    const totalApplications = await CreditApplication.countDocuments(filter);
    const totalPages = Math.ceil(totalApplications / limit);

    res.status(200).json({
      success: true,
      data: {
        applications: applications.map(app => ({
          id: app._id,
          applicationId: app.applicationId,
          applicantName: app.applicantFullName,
          applicantEmail: app.applicant.email,
          loanAmount: app.loan.amount,
          loanPurpose: app.loan.purpose,
          status: app.status,
          riskLevel: app.aiAssessment?.riskLevel,
          creditScore: app.aiAssessment?.creditScore,
          assignedTo: app.manualReview?.assignedTo,
          createdAt: app.createdAt,
          submittedAt: app.submittedAt
        })),
        pagination: {
          currentPage: page,
          totalPages,
          totalApplications,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  })
);

// @desc    Get single credit application
// @route   GET /api/credit/applications/:id
// @access  Private - requires 'applications' read permission
router.get('/applications/:id',
  protect,
  checkPermission('applications', 'read'),
  asyncHandler(async (req, res) => {
    const application = await CreditApplication.findOne({
      $or: [
        { _id: req.params.id },
        { applicationId: req.params.id }
      ]
    })
    .populate('manualReview.assignedTo', 'firstName lastName username email')
    .populate('manualReview.reviewNotes.createdBy', 'firstName lastName username')
    .populate('auditTrail.performedBy', 'firstName lastName username');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    creditLogger.info('Application viewed', {
      applicationId: application.applicationId,
      viewedBy: req.user._id,
      ip: req.ip
    });

    res.status(200).json({
      success: true,
      data: { application }
    });
  })
);

// @desc    Update credit application
// @route   PUT /api/credit/applications/:id
// @access  Private - requires 'applications' update permission
router.put('/applications/:id',
  protect,
  checkPermission('applications', 'update'),
  asyncHandler(async (req, res) => {
    const application = await CreditApplication.findOne({
      $or: [
        { _id: req.params.id },
        { applicationId: req.params.id }
      ]
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Check if application can be updated
    if (['approved', 'denied'].includes(application.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update application that has been finalized'
      });
    }

    // Track what fields are being updated
    const updatedFields = Object.keys(req.body);
    
    // Update application
    Object.assign(application, req.body);
    
    // Add audit trail entry
    application.addAuditEntry('application_updated', req.user, {
      updatedFields,
      newStatus: application.status
    }, req);

    await application.save();

    creditLogger.info('Application updated', {
      applicationId: application.applicationId,
      updatedBy: req.user._id,
      updatedFields,
      ip: req.ip
    });

    res.status(200).json({
      success: true,
      message: 'Application updated successfully',
      data: { application }
    });
  })
);

// @desc    Submit application for review
// @route   POST /api/credit/applications/:id/submit
// @access  Private - requires 'applications' update permission
router.post('/applications/:id/submit',
  protect,
  checkPermission('applications', 'update'),
  asyncHandler(async (req, res) => {
    const application = await CreditApplication.findOne({
      $or: [
        { _id: req.params.id },
        { applicationId: req.params.id }
      ]
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    if (application.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft applications can be submitted'
      });
    }

    // Update status and submission date
    application.status = 'submitted';
    application.submittedAt = new Date();
    
    // Add audit trail entry
    application.addAuditEntry('application_submitted', req.user, {
      submittedAt: application.submittedAt
    }, req);

    await application.save();

    creditLogger.info('Application submitted for review', {
      applicationId: application.applicationId,
      submittedBy: req.user._id,
      loanAmount: application.loan.amount,
      ip: req.ip
    });

    res.status(200).json({
      success: true,
      message: 'Application submitted successfully',
      data: {
        application: {
          id: application._id,
          applicationId: application.applicationId,
          status: application.status,
          submittedAt: application.submittedAt
        }
      }
    });
  })
);

// @desc    Upload documents for application
// @route   POST /api/credit/applications/:id/documents
// @access  Private - requires 'applications' update permission
router.post('/applications/:id/documents',
  protect,
  checkPermission('applications', 'update'),
  upload.array('documents', 10),
  asyncHandler(async (req, res) => {
    const application = await CreditApplication.findOne({
      $or: [
        { _id: req.params.id },
        { applicationId: req.params.id }
      ]
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const uploadedDocuments = req.files.map((file, index) => ({
      type: req.body.documentTypes ? req.body.documentTypes.split(',')[index] : 'other',
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      uploadDate: new Date()
    }));

    // Add documents to application
    application.documents.push(...uploadedDocuments);
    
    // Add audit trail entry
    application.addAuditEntry('documents_uploaded', req.user, {
      documentCount: uploadedDocuments.length,
      documentTypes: uploadedDocuments.map(doc => doc.type)
    }, req);

    await application.save();

    creditLogger.info('Documents uploaded', {
      applicationId: application.applicationId,
      documentCount: uploadedDocuments.length,
      uploadedBy: req.user._id,
      ip: req.ip
    });

    res.status(200).json({
      success: true,
      message: `${uploadedDocuments.length} document(s) uploaded successfully`,
      data: {
        documents: uploadedDocuments.map(doc => ({
          type: doc.type,
          originalName: doc.originalName,
          size: doc.size,
          uploadDate: doc.uploadDate
        }))
      }
    });
  })
);

// @desc    Assign application for manual review
// @route   POST /api/credit/applications/:id/assign
// @access  Private - requires admin or underwriter role
router.post('/applications/:id/assign',
  protect,
  authorize('admin', 'underwriter'),
  asyncHandler(async (req, res) => {
    const { assigneeId } = req.body;

    const application = await CreditApplication.findOne({
      $or: [
        { _id: req.params.id },
        { applicationId: req.params.id }
      ]
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Update assignment
    application.manualReview.assignedTo = assigneeId;
    application.manualReview.assignedAt = new Date();
    application.status = 'under_review';
    
    // Add audit trail entry
    application.addAuditEntry('application_assigned', req.user, {
      assignedTo: assigneeId,
      assignedAt: application.manualReview.assignedAt
    }, req);

    await application.save();

    creditLogger.info('Application assigned for review', {
      applicationId: application.applicationId,
      assignedTo: assigneeId,
      assignedBy: req.user._id,
      ip: req.ip
    });

    res.status(200).json({
      success: true,
      message: 'Application assigned successfully',
      data: {
        applicationId: application.applicationId,
        assignedTo: assigneeId,
        assignedAt: application.manualReview.assignedAt,
        status: application.status
      }
    });
  })
);

// @desc    Add review note to application
// @route   POST /api/credit/applications/:id/notes
// @access  Private - requires 'applications' update permission
router.post('/applications/:id/notes',
  protect,
  checkPermission('applications', 'update'),
  asyncHandler(async (req, res) => {
    const { note, category } = req.body;

    if (!note) {
      return res.status(400).json({
        success: false,
        message: 'Note content is required'
      });
    }

    const application = await CreditApplication.findOne({
      $or: [
        { _id: req.params.id },
        { applicationId: req.params.id }
      ]
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Add review note
    const reviewNote = {
      note,
      category: category || 'general',
      createdBy: req.user._id,
      createdAt: new Date()
    };

    application.manualReview.reviewNotes.push(reviewNote);
    
    // Add audit trail entry
    application.addAuditEntry('review_note_added', req.user, {
      noteCategory: category,
      noteLength: note.length
    }, req);

    await application.save();

    creditLogger.info('Review note added', {
      applicationId: application.applicationId,
      noteCategory: category,
      addedBy: req.user._id,
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'Review note added successfully',
      data: { reviewNote }
    });
  })
);

// @desc    Get application statistics
// @route   GET /api/credit/applications/stats
// @access  Private - requires 'applications' read permission
router.get('/stats',
  protect,
  checkPermission('applications', 'read'),
  asyncHandler(async (req, res) => {
    const stats = await CreditApplication.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgLoanAmount: { $avg: '$loan.amount' },
          totalLoanAmount: { $sum: '$loan.amount' }
        }
      }
    ]);

    const riskStats = await CreditApplication.aggregate([
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

    const purposeStats = await CreditApplication.aggregate([
      {
        $group: {
          _id: '$loan.purpose',
          count: { $sum: 1 },
          avgAmount: { $avg: '$loan.amount' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        statusStats: stats,
        riskStats,
        purposeStats,
        summary: {
          totalApplications: stats.reduce((sum, stat) => sum + stat.count, 0),
          totalLoanValue: stats.reduce((sum, stat) => sum + stat.totalLoanAmount, 0)
        }
      }
    });
  })
);

module.exports = router;