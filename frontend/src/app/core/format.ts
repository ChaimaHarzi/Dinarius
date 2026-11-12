import { HttpErrorResponse, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { CampaignStatus, Category, FundingType, InvestmentStatus } from './models';

export const api = (path: string) => `${environment.apiUrl}/api${path}`;

/** Builds query params, skipping empty values. */
export function toParams(query: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
  }
  return params;
}

/** Uploaded files are stored by the API; external URLs are used as is. */
export function mediaUrl(path?: string | null): string {
  if (!path) return '';
  return path.startsWith('/uploads/') ? `${environment.apiUrl}${path}` : path;
}

export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return 'Cannot reach the server. Is the API running?';
    return error.error?.message ?? 'Something went wrong';
  }
  return 'Something went wrong';
}

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'technology', label: 'Technology' },
  { value: 'business', label: 'Business' },
  { value: 'environmental', label: 'Environment' },
  { value: 'educational', label: 'Education' },
  { value: 'medical', label: 'Health' },
  { value: 'social', label: 'Social' },
  { value: 'artistic', label: 'Arts & crafts' },
  { value: 'other', label: 'Other' },
];

export const FUNDING_TYPES: { value: FundingType; label: string; hint: string }[] = [
  { value: 'donation', label: 'Donation', hint: 'Support the project, nothing in return.' },
  { value: 'reward', label: 'Reward', hint: 'Back the project and receive a product or perk.' },
  { value: 'equity', label: 'Equity', hint: 'Become a shareholder. Needs the founder’s approval.' },
  { value: 'loan', label: 'Loan', hint: 'Lend money and get repaid with interest. Needs approval.' },
];

export const categoryLabel = (value: string) => CATEGORIES.find((c) => c.value === value)?.label ?? value;
export const fundingLabel = (value: string) => FUNDING_TYPES.find((f) => f.value === value)?.label ?? value;

export const CAMPAIGN_STATUS: Record<CampaignStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Pending review', tone: 'amber' },
  active: { label: 'Live', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'red' },
  completed: { label: 'Completed', tone: 'blue' },
  cancelled: { label: 'Cancelled', tone: 'gray' },
};

export const INVESTMENT_STATUS: Record<InvestmentStatus, { label: string; tone: Tone }> = {
  requested: { label: 'Awaiting answer', tone: 'amber' },
  accepted: { label: 'Accepted · to pay', tone: 'blue' },
  declined: { label: 'Declined', tone: 'red' },
  pending: { label: 'Payment pending', tone: 'amber' },
  paid: { label: 'Paid', tone: 'green' },
  failed: { label: 'Failed', tone: 'red' },
  cancelled: { label: 'Cancelled', tone: 'gray' },
};

export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'gray';

export const CHART_COLORS = ['#039855', '#f59e0b', '#0ea5e9', '#8b5cf6', '#ef4444', '#14b8a6', '#ec4899', '#64748b'];

export const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  entrepreneur: 'Entrepreneur',
  investor: 'Investor',
};
