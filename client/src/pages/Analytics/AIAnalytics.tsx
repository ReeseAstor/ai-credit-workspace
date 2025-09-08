import React from 'react';
import { Box, Typography, Card, CardContent, Chip, LinearProgress } from '@mui/material';
import { TrendingUp, Speed, CheckCircle, Memory } from '@mui/icons-material';

const AIAnalytics: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        AI Analytics & Performance
      </Typography>
      <Typography variant="subtitle1" color="textSecondary" mb={4}>
        Monitor AI model performance and insights
      </Typography>

      <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }} gap={3} mb={4}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <CheckCircle color="primary" />
              <Typography variant="h6">Model Accuracy</Typography>
            </Box>
            <Typography variant="h4" fontWeight="bold" color="primary">
              94.2%
            </Typography>
            <LinearProgress variant="determinate" value={94.2} color="primary" sx={{ mt: 1 }} />
          </CardContent>
        </Card>
        
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <Speed color="success" />
              <Typography variant="h6">Processing Speed</Typography>
            </Box>
            <Typography variant="h4" fontWeight="bold" color="success.main">
              245ms
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Average processing time
            </Typography>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <TrendingUp color="info" />
              <Typography variant="h6">Throughput</Typography>
            </Box>
            <Typography variant="h4" fontWeight="bold" color="info.main">
              500
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Applications/hour
            </Typography>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <Memory color="warning" />
              <Typography variant="h6">Model Version</Typography>
            </Box>
            <Typography variant="h4" fontWeight="bold" color="warning.main">
              v1.0.0
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Latest stable
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            AI Model Features
          </Typography>
          <Typography variant="body1" paragraph>
            Our advanced AI credit scoring model leverages multiple data points to provide accurate risk assessments:
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Chip label="Credit Score Analysis" color="primary" sx={{ mr: 1, mb: 1 }} />
            <Chip label="Income Verification" color="secondary" sx={{ mr: 1, mb: 1 }} />
            <Chip label="Debt-to-Income Ratio" color="success" sx={{ mr: 1, mb: 1 }} />
            <Chip label="Employment History" color="warning" sx={{ mr: 1, mb: 1 }} />
            <Chip label="Payment History" color="info" sx={{ mr: 1, mb: 1 }} />
            <Chip label="Credit Utilization" color="error" sx={{ mr: 1, mb: 1 }} />
            <Chip label="Fraud Detection" variant="outlined" sx={{ mr: 1, mb: 1 }} />
            <Chip label="Risk Scoring" variant="outlined" sx={{ mr: 1, mb: 1 }} />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AIAnalytics;