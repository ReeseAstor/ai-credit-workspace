import React, { useEffect, useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Paper,
  Chip,
  LinearProgress,
  IconButton,
  Alert,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Assessment,
  Warning,
  CheckCircle,
  Schedule,
  SmartToy,
  Refresh,
  Assignment,
  Error,
  Info,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import apiService from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { DashboardStats, Alert as AlertType } from '../../types';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch dashboard data
  const { data: dashboardData, isLoading: dashboardLoading, error: dashboardError } = useQuery({
    queryKey: ['dashboard', 'overview', refreshKey],
    queryFn: async () => {
      const response = await apiService.getDashboardOverview();
      if (!response.success) throw new Error(response.error?.message || 'Failed to fetch dashboard data');
      return response.data as DashboardStats;
    },
  });

  // Fetch user's work
  const { data: myWorkData, isLoading: workLoading } = useQuery({
    queryKey: ['dashboard', 'my-work', refreshKey],
    queryFn: async () => {
      const response = await apiService.getMyWork();
      if (!response.success) throw new Error(response.error?.message || 'Failed to fetch work data');
      return response.data;
    },
  });

  // Fetch alerts
  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ['dashboard', 'alerts', refreshKey],
    queryFn: async () => {
      const response = await apiService.getAlerts();
      if (!response.success) throw new Error(response.error?.message || 'Failed to fetch alerts');
      return response.data;
    },
  });

  // Fetch AI status
  const { data: aiStatusData, isLoading: aiLoading } = useQuery({
    queryKey: ['ai', 'status', refreshKey],
    queryFn: async () => {
      const response = await apiService.getAIStatus();
      if (!response.success) throw new Error(response.error?.message || 'Failed to fetch AI status');
      return response.data;
    },
  });

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    showNotification('Dashboard refreshed', 'success');
  };

  if (dashboardLoading || workLoading || alertsLoading || aiLoading) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  if (dashboardError) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Failed to load dashboard data. Please try again.
      </Alert>
    );
  }

  const summary = dashboardData?.summary || {};
  const alerts = alertsData?.alerts || [];
  const myWork = myWorkData?.summary || {};
  const aiStatus = aiStatusData || {};

  // Chart colors
  const chartColors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];

  // Prepare risk distribution data for pie chart
  const riskData = dashboardData?.riskDistribution.map((item, index) => ({
    name: item._id,
    value: item.count,
    color: chartColors[index % chartColors.length],
  })) || [];

  // Prepare monthly trends data for line chart
  const monthlyData = dashboardData?.monthlyTrends.map(item => ({
    month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
    applications: item.applications,
    approved: item.approved,
    denied: item.denied,
  })) || [];

  // Status breakdown for bar chart
  const statusData = dashboardData?.statusBreakdown.map(item => ({
    status: item._id,
    count: item.count,
    value: item.totalValue,
  })) || [];

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error': return <Error color="error" />;
      case 'warning': return <Warning color="warning" />;
      case 'info': return <Info color="info" />;
      default: return <CheckCircle color="success" />;
    }
  };

  const getAlertColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      default: return 'default';
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Welcome back, {user?.firstName}!
          </Typography>
          <Typography variant="subtitle1" color="textSecondary">
            AI Credit Management Dashboard
          </Typography>
        </Box>
        <IconButton onClick={handleRefresh} color="primary">
          <Refresh />
        </IconButton>
      </Box>

      {/* Key Metrics Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Applications
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {summary.totalApplications?.toLocaleString() || 0}
                  </Typography>
                  <Typography variant="body2" color="success.main">
                    +{summary.todaysApplications || 0} today
                  </Typography>
                </Box>
                <Assignment color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Pending Review
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {summary.pendingApplications || 0}
                  </Typography>
                  <Typography variant="body2" color="warning.main">
                    Needs attention
                  </Typography>
                </Box>
                <Schedule color="warning" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Approval Rate
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {summary.approvalRate?.toFixed(1) || 0}%
                  </Typography>
                  <Box mt={1}>
                    <LinearProgress 
                      variant="determinate" 
                      value={summary.approvalRate || 0} 
                      color="success"
                    />
                  </Box>
                </Box>
                <TrendingUp color="success" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Avg Processing
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {summary.avgProcessingDays?.toFixed(1) || 0}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    days
                  </Typography>
                </Box>
                <Assessment color="info" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* AI Status & Alerts Row */}
      <Grid container spacing={3} mb={4}>
        {/* AI Status */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <SmartToy color="primary" />
                <Typography variant="h6" fontWeight="bold">
                  AI Engine Status
                </Typography>
                <Chip 
                  label={aiStatus.health || 'Unknown'} 
                  color={aiStatus.health === 'healthy' ? 'success' : 'warning'}
                  size="small"
                />
              </Box>
              <Box mb={2}>
                <Typography variant="body2" color="textSecondary">
                  Model Version: {aiStatus.version || 'N/A'}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Accuracy: {aiStatus.performance?.accuracy || 'N/A'}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Processing Time: {aiStatus.performance?.averageProcessingTime || 'N/A'}
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={aiStatus.modelLoaded ? 100 : 0} 
                color="primary"
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Alerts */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                System Alerts
                <Chip 
                  label={alerts.length} 
                  color={alertsData?.hasUrgent ? 'error' : 'default'}
                  size="small"
                  sx={{ ml: 1 }}
                />
              </Typography>
              {alerts.length === 0 ? (
                <Box display="flex" alignItems="center" gap={1} py={2}>
                  <CheckCircle color="success" />
                  <Typography color="success.main">All systems normal</Typography>
                </Box>
              ) : (
                <List dense>
                  {alerts.slice(0, 3).map((alert: AlertType, index: number) => (
                    <ListItem key={index} disablePadding>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        {getAlertIcon(alert.type)}
                      </ListItemIcon>
                      <ListItemText
                        primary={alert.title}
                        secondary={alert.message}
                        primaryTypographyProps={{ variant: 'body2' }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                      <Chip 
                        label={alert.priority} 
                        size="small" 
                        color={getAlertColor(alert.priority) as any}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts Row */}
      <Grid container spacing={3} mb={4}>
        {/* Risk Distribution */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Risk Level Distribution
              </Typography>
              <Box height={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={riskData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {riskData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Application Status */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Application Status
              </Typography>
              <Box height={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="status" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Monthly Trends */}
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            Monthly Application Trends
          </Typography>
          <Box height={400}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="applications" stroke="#8884d8" strokeWidth={2} />
                <Line type="monotone" dataKey="approved" stroke="#82ca9d" strokeWidth={2} />
                <Line type="monotone" dataKey="denied" stroke="#ff7c7c" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Dashboard;