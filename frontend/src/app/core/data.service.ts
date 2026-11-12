import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { api, toParams } from './format';
import {
  AdminStats,
  Campaign,
  CampaignInput,
  CampaignStatus,
  CheckoutResult,
  EntrepreneurStats,
  FundingType,
  Investment,
  InvestmentStatus,
  InvestorStats,
  Page,
  Role,
  User,
} from './models';

export interface CampaignQuery {
  page?: number;
  limit?: number;
  q?: string;
  category?: string;
  fundingType?: string;
  status?: CampaignStatus | '';
  sort?: 'newest' | 'endingSoon' | 'mostFunded' | 'goal';
}

export interface InvestmentQuery {
  page?: number;
  limit?: number;
  status?: InvestmentStatus | '';
  type?: FundingType | '';
}

@Injectable({ providedIn: 'root' })
export class CampaignService {
  private readonly http = inject(HttpClient);

  list(query: CampaignQuery = {}) {
    return this.http.get<Page<Campaign>>(api('/campaigns'), { params: toParams(query) });
  }

  mine(query: CampaignQuery = {}) {
    return this.http.get<Page<Campaign>>(api('/campaigns/mine'), { params: toParams(query) });
  }

  adminList(query: CampaignQuery = {}) {
    return this.http.get<Page<Campaign>>(api('/campaigns/admin'), { params: toParams(query) });
  }

  get(id: string) {
    return this.http.get<{ campaign: Campaign }>(api(`/campaigns/${id}`)).pipe(map((r) => r.campaign));
  }

  create(body: Partial<CampaignInput>) {
    return this.http.post<{ campaign: Campaign }>(api('/campaigns'), body).pipe(map((r) => r.campaign));
  }

  update(id: string, body: Partial<CampaignInput>) {
    return this.http.patch<{ campaign: Campaign }>(api(`/campaigns/${id}`), body).pipe(map((r) => r.campaign));
  }

  remove(id: string) {
    return this.http.delete<{ archived?: boolean } | null>(api(`/campaigns/${id}`));
  }

  review(id: string, decision: 'approve' | 'reject', reason?: string) {
    return this.http
      .patch<{ campaign: Campaign }>(api(`/campaigns/${id}/review`), { decision, ...(reason && { reason }) })
      .pipe(map((r) => r.campaign));
  }
}

@Injectable({ providedIn: 'root' })
export class InvestmentService {
  private readonly http = inject(HttpClient);

  paymentMode() {
    return this.http.get<{ mode: 'stripe' | 'demo' }>(api('/payments/config')).pipe(map((r) => r.mode));
  }

  checkout(campaignId: string, amount: number, type: 'donation' | 'reward') {
    return this.http.post<CheckoutResult>(api('/investments/checkout'), { campaignId, amount, type });
  }

  engage(campaignId: string, amount: number, type: 'equity' | 'loan', message?: string) {
    return this.http
      .post<{ investment: Investment }>(api('/investments/engage'), { campaignId, amount, type, ...(message && { message }) })
      .pipe(map((r) => r.investment));
  }

  pay(id: string) {
    return this.http.post<CheckoutResult>(api(`/investments/${id}/pay`), {});
  }

  cancel(id: string) {
    return this.http.patch<{ investment: Investment }>(api(`/investments/${id}/cancel`), {}).pipe(map((r) => r.investment));
  }

  respond(id: string, decision: 'accept' | 'decline', note?: string) {
    return this.http
      .patch<{ investment: Investment }>(api(`/investments/${id}/respond`), { decision, ...(note && { note }) })
      .pipe(map((r) => r.investment));
  }

  confirm(sessionId: string) {
    return this.http.post<{ investment: Investment }>(api('/investments/confirm'), { sessionId }).pipe(map((r) => r.investment));
  }

  get(id: string) {
    return this.http.get<{ investment: Investment }>(api(`/investments/${id}`)).pipe(map((r) => r.investment));
  }

  mine(query: InvestmentQuery = {}) {
    return this.http.get<Page<Investment>>(api('/investments/mine'), { params: toParams(query) });
  }

  received(query: InvestmentQuery = {}) {
    return this.http.get<Page<Investment>>(api('/investments/received'), { params: toParams(query) });
  }

  all(query: InvestmentQuery = {}) {
    return this.http.get<Page<Investment>>(api('/investments'), { params: toParams(query) });
  }
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);

  updateMe(body: Partial<User>) {
    return this.http.patch<{ user: User }>(api('/users/me'), body).pipe(map((r) => r.user));
  }

  changePassword(newPassword: string, currentPassword?: string) {
    return this.http.patch<{ token: string; user: User }>(api('/users/me/password'), {
      newPassword,
      ...(currentPassword && { currentPassword }),
    });
  }

  deleteMe() {
    return this.http.delete<void>(api('/users/me'));
  }

  list(query: { page?: number; limit?: number; q?: string; role?: Role | '' } = {}) {
    return this.http.get<Page<User>>(api('/users'), { params: toParams(query) });
  }

  create(body: { firstName: string; lastName: string; email: string; password: string; role: Role }) {
    return this.http.post<{ user: User }>(api('/users'), body).pipe(map((r) => r.user));
  }

  update(id: string, body: { role?: Role; isActive?: boolean }) {
    return this.http.patch<{ user: User }>(api(`/users/${id}`), body).pipe(map((r) => r.user));
  }

  remove(id: string) {
    return this.http.delete<void>(api(`/users/${id}`));
  }
}

@Injectable({ providedIn: 'root' })
export class StatsService {
  private readonly http = inject(HttpClient);
  admin = () => this.http.get<AdminStats>(api('/stats/admin'));
  entrepreneur = () => this.http.get<EntrepreneurStats>(api('/stats/entrepreneur'));
  investor = () => this.http.get<InvestorStats>(api('/stats/investor'));
}

@Injectable({ providedIn: 'root' })
export class UploadService {
  private readonly http = inject(HttpClient);

  image(file: File) {
    const body = new FormData();
    body.append('image', file);
    return this.http.post<{ url: string }>(api('/uploads'), body).pipe(map((r) => r.url));
  }
}
