import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/guards';
import { DashboardLayoutComponent } from './layout/dashboard-layout.component';
import { PublicLayoutComponent } from './layout/public-layout.component';

export const routes: Routes = [
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      { path: '', title: 'Dinarius · Crowdfunding for Tunisian startups', loadComponent: () => import('./pages/home.component').then((m) => m.HomeComponent) },
      { path: 'campaigns', title: 'Explore campaigns · Dinarius', loadComponent: () => import('./pages/explore.component').then((m) => m.ExploreComponent) },
      { path: 'campaigns/:id', title: 'Campaign · Dinarius', loadComponent: () => import('./pages/campaign-detail.component').then((m) => m.CampaignDetailComponent) },
      { path: 'login', title: 'Log in · Dinarius', canActivate: [guestGuard], loadComponent: () => import('./pages/auth/login.component').then((m) => m.LoginComponent) },
      { path: 'register', title: 'Create an account · Dinarius', canActivate: [guestGuard], loadComponent: () => import('./pages/auth/register.component').then((m) => m.RegisterComponent) },
      { path: 'forgot-password', title: 'Forgot password · Dinarius', loadComponent: () => import('./pages/auth/password.component').then((m) => m.ForgotPasswordComponent) },
      { path: 'reset-password', title: 'Reset password · Dinarius', loadComponent: () => import('./pages/auth/password.component').then((m) => m.ResetPasswordComponent) },
      { path: 'auth/callback', loadComponent: () => import('./pages/auth/oauth-callback.component').then((m) => m.OAuthCallbackComponent) },
      { path: 'payment/success', title: 'Thank you · Dinarius', canActivate: [authGuard], loadComponent: () => import('./pages/payment-success.component').then((m) => m.PaymentSuccessComponent) },
    ],
  },
  {
    path: 'dashboard',
    component: DashboardLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', title: 'Dashboard · Dinarius', loadComponent: () => import('./pages/dashboard/overview.component').then((m) => m.OverviewComponent) },
      { path: 'profile', title: 'My profile · Dinarius', loadComponent: () => import('./pages/dashboard/profile.component').then((m) => m.ProfileComponent) },
      {
        path: '',
        canActivate: [roleGuard('entrepreneur')],
        children: [
          { path: 'campaigns', title: 'My campaigns · Dinarius', loadComponent: () => import('./pages/dashboard/entrepreneur/my-campaigns.component').then((m) => m.MyCampaignsComponent) },
          { path: 'campaigns/new', title: 'New campaign · Dinarius', loadComponent: () => import('./pages/dashboard/entrepreneur/campaign-form.component').then((m) => m.CampaignFormComponent) },
          { path: 'campaigns/:id/edit', title: 'Edit campaign · Dinarius', loadComponent: () => import('./pages/dashboard/entrepreneur/campaign-form.component').then((m) => m.CampaignFormComponent) },
          { path: 'requests', title: 'Funding requests · Dinarius', loadComponent: () => import('./pages/dashboard/entrepreneur/requests.component').then((m) => m.RequestsComponent) },
        ],
      },
      {
        path: '',
        canActivate: [roleGuard('investor')],
        children: [
          { path: 'investments', title: 'My investments · Dinarius', loadComponent: () => import('./pages/dashboard/investor/my-investments.component').then((m) => m.MyInvestmentsComponent) },
        ],
      },
      {
        path: '',
        canActivate: [roleGuard('admin')],
        children: [
          { path: 'review', title: 'Campaign review · Dinarius', loadComponent: () => import('./pages/dashboard/admin/review.component').then((m) => m.ReviewComponent) },
          { path: 'users', title: 'Users · Dinarius', loadComponent: () => import('./pages/dashboard/admin/users.component').then((m) => m.UsersComponent) },
          { path: 'transactions', title: 'Transactions · Dinarius', loadComponent: () => import('./pages/dashboard/admin/transactions.component').then((m) => m.TransactionsComponent) },
        ],
      },
    ],
  },
  { path: '**', title: 'Page not found · Dinarius', loadComponent: () => import('./pages/not-found.component').then((m) => m.NotFoundComponent) },
];
