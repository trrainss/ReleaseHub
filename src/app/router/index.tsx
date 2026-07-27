import { createBrowserRouter, Navigate } from 'react-router-dom';
import { SignInPage } from '@/pages/SignInPage';
import { SignUpPage } from '@/pages/SignUpPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { WorkspacesPage } from '@/pages/WorkspacesPage';
import { WorkspacePage } from '@/pages/WorkspacePage';
import { ReleasePage } from '@/pages/ReleasePage';
import { ReleaseNotesPage } from '@/pages/ReleaseNotesPage';
import { ProtectedRoute } from './ProtectedRoute';
import { AppLayout } from './AppLayout';
import { AcceptInvitePage } from '@/pages/AcceptInvitePage';
import { InvitesPage } from '@/pages/InvitesPage';

export const router = createBrowserRouter([
  {
    path: '/auth/signin',
    element: <SignInPage />,
  },
  {
      path: '/accept-invite',
      element: <AcceptInvitePage />,
  },
  {
    path: '/auth/signup',
    element: <SignUpPage />,
  },
  {
    path: '/auth/reset-password',
    element: <ResetPasswordPage />,
  },
  {
    path: '/invites',
    element: <InvitesPage />,
  },
  {
    path: '/',
    element: <ProtectedRoute><AppLayout /></ProtectedRoute>,
    children: [
      { index: true, element: <Navigate to="/workspaces" replace /> },
      { path: 'workspaces', element: <WorkspacesPage /> },
      { path: 'workspaces/:workspaceId/*', element: <WorkspacePage /> },
      { path: 'releases/:releaseId', element: <ReleasePage /> },
    ],
  },
  {
    path: '/release-notes/:productSlug',
    element: <ReleaseNotesPage />,
  },
  {
    path: '*',
    element: <Navigate to="/workspaces" replace />,
  },
]);
