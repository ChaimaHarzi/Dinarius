import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/format';
import { ToastService } from '../../core/toast.service';
import { AuthShellComponent, PASSWORD_PATTERN } from './auth-shell.component';

@Component({
  selector: 'app-forgot-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, AuthShellComponent],
  template: `
    <app-auth-shell title="Forgot your password?" subtitle="We will email you a link to choose a new one.">
      @if (sent()) {
        <p class="rounded-lg bg-brand-50 p-4 text-sm text-brand-800">{{ sent() }}</p>
        <a routerLink="/login" class="btn btn-secondary mt-6 w-full">Back to log in</a>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4" novalidate>
          @if (error()) { <p class="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{{ error() }}</p> }
          <label class="block">
            <span class="label">Email</span>
            <input class="input" type="email" formControlName="email" autocomplete="email" />
            @if (form.controls.email.touched && form.controls.email.invalid) { <p class="field-error">Enter a valid email address.</p> }
          </label>
          <button class="btn btn-primary w-full py-3" [disabled]="loading()">{{ loading() ? 'Sending…' : 'Send the reset link' }}</button>
        </form>
      }
      <p footer class="mt-6 text-center text-sm text-stone-600"><a routerLink="/login" class="font-semibold text-brand-700 hover:underline">Back to log in</a></p>
    </app-auth-shell>
  `,
})
export class ForgotPasswordComponent {
  private readonly auth = inject(AuthService);
  protected readonly form = inject(NonNullableFormBuilder).group({ email: ['', [Validators.required, Validators.email]] });
  protected readonly loading = signal(false);
  protected readonly sent = signal('');
  protected readonly error = signal('');

  protected submit() {
    if (this.form.invalid) return this.form.markAllAsTouched();
    this.loading.set(true);
    this.auth.forgotPassword(this.form.getRawValue().email).subscribe({
      next: ({ message }) => this.sent.set(message),
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }
}

@Component({
  selector: 'app-reset-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, AuthShellComponent],
  template: `
    <app-auth-shell title="Choose a new password">
      @if (!token) {
        <p class="rounded-lg bg-red-50 p-4 text-sm text-red-700">This link is incomplete. Request a new one.</p>
        <a routerLink="/forgot-password" class="btn btn-primary mt-6 w-full">Request a new link</a>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4" novalidate>
          @if (error()) { <p class="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{{ error() }}</p> }
          <label class="block">
            <span class="label">New password</span>
            <input class="input" type="password" formControlName="password" autocomplete="new-password" />
            <p class="mt-1 text-xs text-stone-500">At least 8 characters, with a letter and a number.</p>
          </label>
          <label class="block">
            <span class="label">Confirm the password</span>
            <input class="input" type="password" formControlName="confirm" autocomplete="new-password" />
            @if (form.controls.confirm.touched && mismatch()) { <p class="field-error">Passwords do not match.</p> }
          </label>
          <button class="btn btn-primary w-full py-3" [disabled]="loading()">{{ loading() ? 'Saving…' : 'Save and log in' }}</button>
        </form>
      }
    </app-auth-shell>
  `,
})
export class ResetPasswordComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token') ?? '';
  protected readonly form = inject(NonNullableFormBuilder).group({
    password: ['', [Validators.required, Validators.pattern(PASSWORD_PATTERN)]],
    confirm: ['', Validators.required],
  });
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  protected mismatch() {
    const { password, confirm } = this.form.getRawValue();
    return password !== confirm;
  }

  protected submit() {
    if (this.form.invalid || this.mismatch()) return this.form.markAllAsTouched();
    this.loading.set(true);
    this.auth.resetPassword(this.token, this.form.getRawValue().password).subscribe({
      next: () => {
        this.toast.success('Your password has been changed.');
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }
}
