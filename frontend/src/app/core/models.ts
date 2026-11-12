export type Role = 'admin' | 'entrepreneur' | 'investor';
export type Category =
  | 'social'
  | 'business'
  | 'artistic'
  | 'technology'
  | 'medical'
  | 'educational'
  | 'environmental'
  | 'other';
export type FundingType = 'donation' | 'reward' | 'equity' | 'loan';
export type CampaignStatus = 'pending' | 'active' | 'rejected' | 'completed' | 'cancelled';
export type InvestmentStatus =
  | 'requested'
  | 'accepted'
  | 'declined'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'cancelled';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  role: Role;
  phone: string;
  birthDate?: string | null;
  location: string;
  bio: string;
  avatarUrl: string;
  isActive: boolean;
  createdAt: string;
}

export type UserRef = Pick<User, 'id' | 'firstName' | 'lastName'> & Partial<User>;

export interface Campaign {
  id: string;
  title: string;
  summary: string;
  description: string;
  category: Category;
  fundingTypes: FundingType[];
  goalAmount: number;
  raisedAmount: number;
  contributionsCount: number;
  currency: string;
  startDate: string;
  endDate: string;
  country: string;
  postalCode: string;
  coverImage: string;
  images: string[];
  equityPercentage?: number;
  loanInterestRate?: number;
  rewardDescription?: string;
  status: CampaignStatus;
  rejectionReason: string;
  progress: number;
  daysLeft: number;
  entrepreneur: UserRef | null;
  createdAt: string;
}

export type CampaignInput = Omit<
  Campaign,
  | 'id'
  | 'raisedAmount'
  | 'contributionsCount'
  | 'currency'
  | 'status'
  | 'rejectionReason'
  | 'progress'
  | 'daysLeft'
  | 'entrepreneur'
  | 'createdAt'
>;

export interface Investment {
  id: string;
  investor: UserRef | null;
  entrepreneur: UserRef | null;
  campaign: Pick<Campaign, 'id' | 'title'> & Partial<Campaign>;
  type: FundingType;
  amount: number;
  currency: string;
  status: InvestmentStatus;
  message: string;
  responseNote: string;
  paidAt?: string;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface CountRow {
  key: string;
  count: number;
}

export interface MonthRow {
  label: string;
  total: number;
  count: number;
}

export interface AdminStats {
  totals: { raised: number; contributions: number; users: number; campaigns: number; pendingCampaigns: number };
  usersByRole: CountRow[];
  campaignsByStatus: CountRow[];
  campaignsByCategory: CountRow[];
  monthly: MonthRow[];
  topInvestors: { investorId: string; name: string; avatarUrl?: string; total: number; projects: number; contributions: number }[];
}

export interface EntrepreneurStats {
  totals: { campaigns: number; active: number; raised: number; contributors: number; pendingOffers: number };
  monthly: MonthRow[];
  campaignsByStatus: CountRow[];
  campaignsByCategory: CountRow[];
  campaigns: { id: string; title: string; raised: number; goal: number; progress: number; status: CampaignStatus }[];
  recentContributions: Investment[];
}

export interface Advice {
  level: 'info' | 'warning' | 'tip';
  message: string;
  campaignId?: string;
}

export interface InvestorStats {
  totals: { invested: number; projects: number; contributions: number; averageTicket: number; openOffers: number };
  monthly: MonthRow[];
  byType: { key: FundingType; total: number }[];
  campaigns: { id: string; title: string; category: Category; status: CampaignStatus; progress: number; invested: number }[];
  advice: Advice[];
}

export interface Session {
  token: string;
  user: User;
}

export interface CheckoutResult {
  investmentId: string;
  url: string;
  mode: 'stripe' | 'demo';
}
