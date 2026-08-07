import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';

import MainLayout from '../layout/MainLayout';
import ProtectedRoute from '../hocs/ProtectedRoute';
import LoadingSpinner from '../components/LoadingSpinner';

// Mỗi trang là một chunk riêng. Bản đồ, biểu đồ và dashboard không còn làm
// nặng lần tải đầu của trang chủ.
const HomePage = lazy(() => import('../pages/Home'));
const MapPage = lazy(() => import('../pages/Map'));
const IssuesPage = lazy(() => import('../pages/Issues'));
const IssueDetailPage = lazy(() => import('../pages/IssueDetail'));
const ReportIssuePage = lazy(() => import('../pages/ReportIssue'));
const MyIssuesPage = lazy(() => import('../pages/MyIssues'));
const ProfilePage = lazy(() => import('../pages/Profile'));
const LoginPage = lazy(() => import('../pages/Login'));
const RegisterPage = lazy(() => import('../pages/Register'));
const VerifyEmailPage = lazy(() => import('../pages/VerifyEmail'));
const AdminDashboard = lazy(() => import('../pages/AdminDashboard'));
const StaffDashboard = lazy(() => import('../pages/StaffDashboard'));
const AuthCallbackPage = lazy(() => import('../pages/AuthCallback'));
const StatisticsPage = lazy(() => import('../pages/Statistics'));
const CamerasPage = lazy(() => import('../pages/Cameras'));
const NotFoundPage = lazy(() => import('../pages/NotFound'));

const page = (element: React.ReactNode) => (
  <Suspense fallback={<LoadingSpinner text="Đang mở trang..." />}>
    {element}
  </Suspense>
);

const AppRouter: React.FC = () => {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={page(<HomePage />)} />
        <Route path="/map" element={page(<MapPage />)} />
        <Route path="/issues" element={page(<IssuesPage />)} />
        <Route path="/issues/:id" element={page(<IssueDetailPage />)} />
        <Route path="/login" element={page(<LoginPage />)} />
        <Route path="/register" element={page(<RegisterPage />)} />
        <Route path="/verify-email" element={page(<VerifyEmailPage />)} />
        <Route path="/auth/callback" element={page(<AuthCallbackPage />)} />
        <Route path="/statistics" element={page(<StatisticsPage />)} />
        <Route path="/cameras" element={page(<CamerasPage />)} />

        {/* Protected routes */}
        <Route path="/report" element={page(<ProtectedRoute><ReportIssuePage /></ProtectedRoute>)} />
        <Route path="/my-issues" element={page(<ProtectedRoute><MyIssuesPage /></ProtectedRoute>)} />
        <Route path="/profile" element={page(<ProtectedRoute><ProfilePage /></ProtectedRoute>)} />
        <Route path="/staff" element={page(<ProtectedRoute roles={['staff', 'admin']}><StaffDashboard /></ProtectedRoute>)} />
        <Route path="/admin" element={page(<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>)} />

        {/* 404 */}
        <Route path="*" element={page(<NotFoundPage />)} />
      </Route>
    </Routes>
  );
};

export default AppRouter;
