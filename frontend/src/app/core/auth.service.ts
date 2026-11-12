import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, firstValueFrom, tap } from 'rxjs';
import { api } from './format';
import { Role, Session, User } from './models';

const TOKEN_KEY = 'dinarius.token';

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly token = signal<string | null>(readToken());
  readonly user = signal<User | null>(null);
  readonly isLoggedIn = computed(() => this.user() !== null);
  readonly role = computed<Role | null>(() => this.user()?.role ?? null);

  /** Restores the session at startup from the stored token. */
  async restore(): Promise<void> {
    if (!this.token()) return;
    try {
      const { user } = await firstValueFrom(this.http.get<{ user: User }>(api('/auth/me')));
      this.user.set(user);
    } catch {
      this.clear();
    }
  }

  login(email: string, password: string): Observable<Session> {
    return this.http.post<Session>(api('/auth/login'), { email, password }).pipe(tap((s) => this.setSession(s)));
  }

  register(body: { firstName: string; lastName: string; email: string; password: string; role: Role }) {
    return this.http.post<Session>(api('/auth/register'), body).pipe(tap((s) => this.setSession(s)));
  }

  forgotPassword(email: string) {
    return this.http.post<{ message: string }>(api('/auth/forgot-password'), { email });
  }

  resetPassword(token: string, password: string) {
    return this.http
      .post<Session>(api('/auth/reset-password'), { token, password })
      .pipe(tap((s) => this.setSession(s)));
  }

  providers() {
    return this.http.get<{ google: boolean }>(api('/auth/providers'));
  }

  googleUrl(role: Role = 'investor') {
    return `${api('/auth/google')}?role=${role}`;
  }

  /** Used after the Google redirect, which only hands us a token. */
  async acceptToken(token: string): Promise<boolean> {
    this.storeToken(token);
    await this.restore();
    return this.isLoggedIn();
  }

  setSession({ token, user }: Session) {
    this.storeToken(token);
    this.user.set(user);
  }

  updateUser(user: User) {
    this.user.set(user);
  }

  logout() {
    this.clear();
    this.router.navigate(['/login']);
  }

  /** Called by the interceptor when the API rejects the token. */
  handleExpiredSession() {
    const wasInDashboard = this.router.url.startsWith('/dashboard');
    this.clear();
    if (wasInDashboard) this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
  }

  private storeToken(token: string) {
    this.token.set(token);
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable (private mode): keep the session in memory */
    }
  }

  private clear() {
    this.token.set(null);
    this.user.set(null);
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  }
}
