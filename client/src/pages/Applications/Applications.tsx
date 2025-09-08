import React from 'react';
import { Box, Typography, Card, CardContent, Chip } from '@mui/material';
import { SmartToy, Timeline, Psychology } from '@mui/icons-material';

const Applications: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Credit Applications
      </Typography>
      <Typography variant="subtitle1" color="textSecondary" mb={4}>
        Manage and review credit applications with AI assistance
      </Typography>

      <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: 'repeat(3, 1fr)' }} gap={3}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2}>
              <SmartToy color="primary" />
              <Box>
                <Typography variant="h6">AI-Powered Review</Typography>
                <Typography variant="body2" color="textSecondary">
                  Automated risk assessment and scoring
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2}>
              <Timeline color="primary" />
              <Box>
                <Typography variant="h6">Workflow Management</Typography>
                <Typography variant="body2" color="textSecondary">
                  Streamlined approval processes
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2}>
              <Psychology color="primary" />
              <Box>
                <Typography variant="h6">Fraud Detection</Typography>
                <Typography variant="body2" color="textSecondary">
                  Advanced ML-based fraud prevention
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>

      <Card sx={{ mt: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Application Management System
          </Typography>
          <Typography variant="body1" paragraph>
            This comprehensive application management system provides:
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Chip label="Real-time AI Analysis" color="primary" sx={{ mr: 1, mb: 1 }} />
            <Chip label="Automated Risk Scoring" color="secondary" sx={{ mr: 1, mb: 1 }} />
            <Chip label="Document Processing" color="success" sx={{ mr: 1, mb: 1 }} />
            <Chip label="Fraud Detection" color="warning" sx={{ mr: 1, mb: 1 }} />
            <Chip label="Workflow Automation" color="info" sx={{ mr: 1, mb: 1 }} />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Applications;