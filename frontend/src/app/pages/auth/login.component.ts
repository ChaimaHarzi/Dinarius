import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/format';
import { AuthShellComponent, GoogleMarkComponent } from './auth-shell.component';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, AuthShellComponent, GoogleMarkComponent],
  template: `
    <app-auth-shell title="Welcome back" subtitle="Log in to follow your campaigns and investments.">
      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4" novalidate>
        @if (error()) {
          <p class="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{{ error() }}</p>
        }
        <label class="block">
          <span class="label">Email</span>
          <input class="input" type="email" formControlName="email" autocomplete="email" placeholder="you@example.com" />
          @if (form.controls.email.touched && form.controls.email.invalid) { <p class="field-error">Enter a valid email address.</p> }
        </label>
        <label class="block">
          <span class="label flex justify-between">Password
            <a routerLink="/forgot-password" class="font-medium text-brand-700 hover:underline">Forgot it?</a></span>
          <input class="input" type="password" formControlName="password" autocomplete="current-password" />
          @if (form.controls.password.touched && form.controls.password.invalid) { <p class="field-error">Enter your password.</p> }
        </label>
        <button class="btn btn-primary w-full py-3" [disabled]="loading()">{{ loading() ? 'Logging in…' : 'Log in' }}</button>
      </form>

      @if (providers()?.google) {
        <div class="my-6 flex items-center gap-3 text-xs text-stone-400"><span class="h-px flex-1 bg-stone-200"></span>or<span class="h-px flex-1 bg-stone-200"></span></div>
        <a [href]="auth.googleUrl()" class="btn btn-secondary w-full py-3"><app-google-mark /> Continue with Google</a>
      }

      <p footer class="mt-6 text-center text-sm text-stone-600">
        New to Dinarius? <a routerLink="/register" class="font-semibold text-brand-700 hover:underline">Create an account</a>
      </p>
    </app-auth-shell>
  `,
})
export class LoginComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly providers = toSignal(this.auth.providers().pipe(catchError(() => of({ google: false }))));

  ngOnInit() {
    if (this.route.snapshot.queryParamMap.get('error') === 'google') {
      this.error.set('Google sign-in failed. Please try again or use your password.');
    }
  }

  protected submit() {
    if (this.form.invalid) return this.form.markAllAsTouched();
    this.loading.set(true);
    this.error.set('');
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        this.router.navigateByUrl(returnUrl?.startsWith('/') ? returnUrl : '/dashboard');
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }
}
