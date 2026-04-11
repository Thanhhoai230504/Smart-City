import React from 'react';
import { Routes, Route } from 'react-router-dom';

import MainLayout from '../layout/MainLayout';
import ProtectedRoute from '../hocs/ProtectedRoute';

// Pages
import HomePage from '../pages/Home';
import MapPage from '../pages/Map';
import IssuesPage from '../pages/Issues';
import IssueDetailPage from '../pages/IssueDetail';
import ReportIssuePage from '../pages/ReportIssue';
import MyIssuesPage from '../pages/MyIssues';
import ProfilePage from '../pages/Profile';
import LoginPage from '../pages/Login';
import RegisterPage from '../pages/Register';
import AdminDashboard from '../pages/AdminDashboard';
import AuthCallbackPage from '../pages/AuthCallback';
import StatisticsPage from '../pages/Statistics';
import NotFoundPage from '../pages/NotFound';

const AppRouter: React.FC = () => {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/issues" element={<IssuesPage />} />
        <Route path="/issues/:id" element={<IssueDetailPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/statistics" element={<StatisticsPage />} />

        {/* Protected routes */}
        <Route path="/report" element={<ProtectedRoute><ReportIssuePage /></ProtectedRoute>} />
        <Route path="/my-issues" element={<ProtectedRoute><MyIssuesPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};

export default AppRouter;
