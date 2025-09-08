const tf = require('@tensorflow/tfjs-node');
const { Matrix } = require('ml-matrix');
const { aiLogger } = require('../utils/logger');

class AICreditscoringEngine {
  constructor() {
    this.model = null;
    this.scaler = null;
    this.isModelLoaded = false;
    this.featureNames = [
      'credit_score',
      'annual_income',
      'debt_to_income_ratio',
      'employment_length',
      'loan_amount',
      'loan_term',
      'payment_history_score',
      'credit_utilization',
      'number_of_accounts',
      'recent_inquiries',
      'collateral_value',
      'loan_purpose_score'
    ];
  }

  async initializeModel() {
    try {
      // In a real implementation, you would load a pre-trained model
      // For demo purposes, we'll create a simple neural network
      this.model = tf.sequential({
        layers: [
          tf.layers.dense({ 
            inputShape: [this.featureNames.length], 
            units: 64, 
            activation: 'relu',
            kernelInitializer: 'glorotUniform'
          }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: 32, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.1 }),
          tf.layers.dense({ units: 16, activation: 'relu' }),
          tf.layers.dense({ units: 1, activation: 'sigmoid' })
        ]
      });

      this.model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
      });

      // Initialize with synthetic weights for demo
      await this.trainInitialModel();
      
      this.isModelLoaded = true;
      aiLogger.info('AI Credit Scoring Model initialized successfully');
      
    } catch (error) {
      aiLogger.error('Failed to initialize AI model:', error);
      throw error;
    }
  }

  async trainInitialModel() {
    // Generate synthetic training data for demo purposes
    const numSamples = 1000;
    const features = [];
    const labels = [];

    for (let i = 0; i < numSamples; i++) {
      const creditScore = Math.random() * 400 + 400; // 400-800
      const income = Math.random() * 150000 + 25000; // 25k-175k
      const debtToIncome = Math.random() * 0.5; // 0-50%
      const employmentLength = Math.random() * 20; // 0-20 years
      const loanAmount = Math.random() * 500000 + 5000; // 5k-505k
      const loanTerm = Math.random() * 30 + 1; // 1-30 years
      const paymentHistory = Math.random() * 100; // 0-100
      const creditUtilization = Math.random() * 0.9; // 0-90%
      const numberOfAccounts = Math.random() * 20 + 1; // 1-20
      const recentInquiries = Math.random() * 10; // 0-10
      const collateralValue = Math.random() * 1000000; // 0-1M
      const loanPurpose = Math.random() * 10; // 0-10

      features.push([
        creditScore / 800, // Normalize
        income / 200000,
        debtToIncome,
        employmentLength / 20,
        loanAmount / 500000,
        loanTerm / 30,
        paymentHistory / 100,
        creditUtilization,
        numberOfAccounts / 20,
        recentInquiries / 10,
        collateralValue / 1000000,
        loanPurpose / 10
      ]);

      // Simple scoring logic for synthetic data
      const score = (creditScore / 800) * 0.3 + 
                   (income / 200000) * 0.2 + 
                   (1 - debtToIncome) * 0.2 + 
                   (paymentHistory / 100) * 0.15 + 
                   (1 - creditUtilization) * 0.15;
      
      labels.push([score > 0.6 ? 1 : 0]);
    }

    const xs = tf.tensor2d(features);
    const ys = tf.tensor2d(labels);

    await this.model.fit(xs, ys, {
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2,
      verbose: 0
    });

    xs.dispose();
    ys.dispose();
  }

  preprocessFeatures(applicantData) {
    const features = [];
    
    // Map applicant data to feature vector
    features.push((applicantData.creditScore || 600) / 800);
    features.push((applicantData.annualIncome || 50000) / 200000);
    features.push((applicantData.debtToIncomeRatio || 0.3));
    features.push((applicantData.employmentLength || 2) / 20);
    features.push((applicantData.loanAmount || 50000) / 500000);
    features.push((applicantData.loanTerm || 15) / 30);
    features.push((applicantData.paymentHistoryScore || 80) / 100);
    features.push((applicantData.creditUtilization || 0.3));
    features.push((applicantData.numberOfAccounts || 5) / 20);
    features.push((applicantData.recentInquiries || 2) / 10);
    features.push((applicantData.collateralValue || 0) / 1000000);
    features.push(this.getLoanPurposeScore(applicantData.loanPurpose) / 10);

    return features;
  }

  getLoanPurposeScore(purpose) {
    const purposeScores = {
      'home_purchase': 9,
      'home_improvement': 8,
      'debt_consolidation': 6,
      'auto_loan': 7,
      'business': 5,
      'education': 8,
      'medical': 7,
      'vacation': 3,
      'other': 5
    };
    return purposeScores[purpose] || 5;
  }

  async predictCreditScore(applicantData) {
    if (!this.isModelLoaded) {
      throw new Error('AI model not loaded. Please initialize first.');
    }

    try {
      const features = this.preprocessFeatures(applicantData);
      const prediction = tf.tidy(() => {
        const inputTensor = tf.tensor2d([features]);
        return this.model.predict(inputTensor);
      });

      const score = await prediction.data();
      prediction.dispose();

      const creditScore = Math.round(score[0] * 850 + 300); // Scale to 300-850
      const riskLevel = this.calculateRiskLevel(creditScore);
      const recommendations = this.generateRecommendations(applicantData, creditScore);

      const result = {
        creditScore,
        riskLevel,
        probability: score[0],
        recommendations,
        factors: this.analyzeFactors(applicantData, features),
        timestamp: new Date().toISOString(),
        modelVersion: '1.0.0'
      };

      aiLogger.info('Credit score prediction generated', {
        applicantId: applicantData.id,
        creditScore,
        riskLevel
      });

      return result;

    } catch (error) {
      aiLogger.error('Credit score prediction failed:', error);
      throw error;
    }
  }

  calculateRiskLevel(creditScore) {
    if (creditScore >= 750) return 'LOW';
    if (creditScore >= 650) return 'MEDIUM';
    if (creditScore >= 550) return 'HIGH';
    return 'VERY_HIGH';
  }

  analyzeFactors(applicantData, features) {
    const factors = [];
    
    if (features[0] < 0.6) factors.push({ factor: 'Credit Score', impact: 'NEGATIVE', description: 'Credit score below optimal range' });
    if (features[1] > 0.8) factors.push({ factor: 'Income', impact: 'POSITIVE', description: 'High annual income' });
    if (features[2] > 0.4) factors.push({ factor: 'Debt-to-Income', impact: 'NEGATIVE', description: 'High debt-to-income ratio' });
    if (features[6] > 0.9) factors.push({ factor: 'Payment History', impact: 'POSITIVE', description: 'Excellent payment history' });
    if (features[7] > 0.7) factors.push({ factor: 'Credit Utilization', impact: 'NEGATIVE', description: 'High credit utilization' });

    return factors;
  }

  generateRecommendations(applicantData, creditScore) {
    const recommendations = [];

    if (creditScore < 650) {
      recommendations.push({
        type: 'IMPROVEMENT',
        priority: 'HIGH',
        description: 'Consider requiring a co-signer or additional collateral',
        action: 'REQUEST_COSIGNER'
      });
    }

    if (applicantData.debtToIncomeRatio > 0.4) {
      recommendations.push({
        type: 'RISK_MITIGATION',
        priority: 'MEDIUM',
        description: 'High debt-to-income ratio - consider smaller loan amount',
        action: 'REDUCE_LOAN_AMOUNT'
      });
    }

    if (creditScore >= 750) {
      recommendations.push({
        type: 'APPROVAL',
        priority: 'LOW',
        description: 'Excellent credit profile - approve with standard terms',
        action: 'APPROVE_STANDARD'
      });
    }

    return recommendations;
  }

  async evaluateFraudRisk(applicantData) {
    const riskFactors = [];
    let fraudScore = 0;

    // Income verification red flags
    if (applicantData.annualIncome > 200000 && applicantData.employmentLength < 1) {
      riskFactors.push('High income with short employment history');
      fraudScore += 30;
    }

    // Address verification
    if (applicantData.timeAtAddress < 6) {
      riskFactors.push('Recently moved to current address');
      fraudScore += 10;
    }

    // Identity verification
    if (applicantData.age < 21 && applicantData.creditScore > 750) {
      riskFactors.push('High credit score at young age');
      fraudScore += 20;
    }

    // Velocity checks
    if (applicantData.recentInquiries > 5) {
      riskFactors.push('Multiple recent credit inquiries');
      fraudScore += 15;
    }

    return {
      fraudScore,
      riskLevel: fraudScore > 50 ? 'HIGH' : fraudScore > 25 ? 'MEDIUM' : 'LOW',
      riskFactors,
      recommendation: fraudScore > 50 ? 'MANUAL_REVIEW' : 'AUTOMATED_PROCESSING'
    };
  }

  async dispose() {
    if (this.model) {
      this.model.dispose();
      this.isModelLoaded = false;
      aiLogger.info('AI model disposed');
    }
  }
}

module.exports = AICreditscoringEngine;