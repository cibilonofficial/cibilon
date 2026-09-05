import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ToastProvider } from '@/components/ui/Toast';
import { AuthProvider } from '@/store/AuthContext';
import { DataProvider } from '@/store/DataContext';

import { ForgotPassword } from '@/pages/auth/ForgotPassword';
import { Login } from '@/pages/auth/Login';
import { NotFound } from '@/pages/NotFound';

import { AddLead } from '@/pages/advisor/AddLead';
import { Applications } from '@/pages/advisor/Applications';
import { AdvisorDashboard } from '@/pages/advisor/Dashboard';
import { Documents } from '@/pages/advisor/Documents';
import { Leads } from '@/pages/advisor/Leads';
import { Payouts } from '@/pages/advisor/Payouts';
import { Profile } from '@/pages/advisor/Profile';
import { Support } from '@/pages/advisor/Support';

import { AdminAdvisorDetails } from '@/pages/admin/AdminAdvisorDetails';
import { AdminAdvisors } from '@/pages/admin/AdminAdvisors';
import { AdminApplications } from '@/pages/admin/AdminApplications';
import { AdminAudit } from '@/pages/admin/AdminAudit';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { AdminDocuments } from '@/pages/admin/AdminDocuments';
import { AdminLeads } from '@/pages/admin/AdminLeads';
import { AdminLenders } from '@/pages/admin/AdminLenders';
import { AdminPayouts } from '@/pages/admin/AdminPayouts';
import { AdminProducts } from '@/pages/admin/AdminProducts';
import { AdminProfile } from '@/pages/admin/AdminProfile';
import { AdminReports } from '@/pages/admin/AdminReports';
import { AdminTeam } from '@/pages/admin/AdminTeam';

import { ApplicationDetails } from '@/pages/shared/ApplicationDetails';
import { LeadDetails } from '@/pages/shared/LeadDetails';
import { Notifications } from '@/pages/shared/Notifications';
import { StaffApplications } from '@/pages/staff/StaffApplications';

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />

              {/* Advisor workspace */}
              <Route path="/app" element={<AppLayout role="advisor" />}>
                <Route index element={<Navigate to="/app/dashboard" replace />} />
                <Route path="dashboard" element={<AdvisorDashboard />} />
                <Route path="leads" element={<Leads />} />
                <Route path="leads/new" element={<AddLead />} />
                <Route path="leads/:id" element={<LeadDetails />} />
                <Route path="applications" element={<Applications />} />
                <Route path="applications/:id" element={<ApplicationDetails />} />
                <Route path="documents" element={<Documents />} />
                <Route path="payouts" element={<Payouts />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="profile" element={<Profile />} />
                <Route path="support" element={<Support />} />
              </Route>

              {/* Staff workspace — assigned applications only */}
              <Route path="/staff" element={<AppLayout role="staff" />}>
                <Route index element={<Navigate to="/staff/applications" replace />} />
                <Route path="applications" element={<StaffApplications />} />
                <Route path="applications/:id" element={<ApplicationDetails />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="*" element={<Navigate to="/staff/applications" replace />} />
              </Route>

              {/* Super Admin console */}
              <Route path="/admin" element={<AppLayout role="admin" />}>
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="leads" element={<AdminLeads />} />
                <Route path="leads/:id" element={<LeadDetails />} />
                <Route path="applications" element={<AdminApplications />} />
                <Route path="applications/:id" element={<ApplicationDetails />} />
                <Route path="documents" element={<AdminDocuments />} />
                <Route path="advisors" element={<AdminAdvisors />} />
                <Route path="advisors/:id" element={<AdminAdvisorDetails />} />
                <Route path="team" element={<AdminTeam />} />
                <Route path="lenders" element={<AdminLenders />} />
                <Route path="products" element={<AdminProducts />} />
                <Route path="payouts" element={<AdminPayouts />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="profile" element={<AdminProfile />} />
                <Route path="audit" element={<AdminAudit />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </DataProvider>
    </AuthProvider>
  );
}
