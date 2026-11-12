import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/format';
import { IconComponent, IconName } from '../../shared/icon.component';
import { AuthShellComponent, GoogleMarkComponent, PASSWORD_PATTERN } from './auth-shell.component';

type PublicRole = 'investor' | 'entrepreneur';

@Component({
  selector: 'app-register',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, AuthShellComponent, GoogleMarkComponent, IconComponent],
  template: `
    @if (!role()) {
      <app-auth-shell title="Join Dinarius" subtitle="First, tell us how you want to use the platform." [wide]="true">
        <div class="grid gap-4 sm:grid-cols-2">
          @for (option of roles; track option.value) {
            <button type="button" (click)="role.set(option.value)"
                    class="group rounded-xl border-2 border-stone-200 p-6 text-left transition hover:border-brand-500 hover:bg-brand-50/50">
              <span class="flex size-12 items-center justify-center rounded-xl bg-brand-100 text-brand-700"><app-icon [name]="option.icon" class="size-6" /></span>
              <p class="mt-4 text-lg font-bold text-ink">{{ option.title }}</p>
              <p class="mt-1 text-sm text-stone-600">{{ option.text }}</p>
            </button>
          }
        </div>
        <p footer class="mt-6 text-center text-sm text-stone-600">
          Already have an account? <a routerLink="/login" class="font-semibold text-brand-700 hover:underline">Log in</a>
        </p>
      </app-auth-shell>
    } @else {
      <app-auth-shell [title]="role() === 'entrepreneur' ? 'Create your founder account' : 'Create your investor account'"
                      subtitle="It takes less than a minute.">
        <button type="button" class="mb-5 inline-flex items-center gap-1 text-sm font-medium text-stone-500 hover:text-ink" (click)="role.set(null)">
          <app-icon name="arrow-left" class="size-4" /> Change account type
        </button>
        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4" novalidate>
          @if (error()) { <p class="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{{ error() }}</p> }
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="label">First name</span>
              <input class="input" formControlName="firstName" autocomplete="given-name" />
              @if (form.controls.firstName.touched && form.controls.firstName.invalid) { <p class="field-error">At least 2 characters.</p> }
            </label>
            <label class="block">
              <span class="label">Last name</span>
              <input class="input" formControlName="lastName" autocomplete="family-name" />
              @if (form.controls.lastName.touched && form.controls.lastName.invalid) { <p class="field-error">At least 2 characters.</p> }
            </label>
          </div>
          <label class="block">
            <span class="label">Email</span>
            <input class="input" type="email" formControlName="email" autocomplete="email" />
            @if (form.controls.email.touched && form.controls.email.invalid) { <p class="field-error">Enter a valid email address.</p> }
          </label>
          <label class="block">
            <span class="label">Password</span>
            <input class="input" type="password" formControlName="password" autocomplete="new-password" />
            <p class="mt-1 text-xs" [class]="form.controls.password.touched && form.controls.password.invalid ? 'text-red-600' : 'text-stone-500'">
              At least 8 characters, with a letter and a number.
            </p>
          </label>
          <button class="btn btn-primary w-full py-3" [disabled]="loading()">{{ loading() ? 'Creating account…' : 'Create my account' }}</button>
        </form>

        @if (providers()?.google) {
          <div class="my-6 flex items-center gap-3 text-xs text-stone-400"><span class="h-px flex-1 bg-stone-200"></span>or<span class="h-px flex-1 bg-stone-200"></span></div>
          <a [href]="auth.googleUrl(role()!)" class="btn btn-secondary w-full py-3"><app-google-mark /> Sign up with Google</a>
        }
      </app-auth-shell>
    }
  `,
})
export class RegisterComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly role = signal<PublicRole | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly providers = toSignal(this.auth.providers().pipe(catchError(() => of({ google: false }))));

  protected readonly roles: { value: PublicRole; icon: IconName; title: string; text: string }[] = [
    { value: 'investor', icon: 'wallet', title: 'I want to invest', text: 'Back startups with donations, rewards, equity or loans and follow your portfolio.' },
    { value: 'entrepreneur', icon: 'flag', title: 'I want to raise funds', text: 'Publish a campaign, receive offers and track your fundraising in real time.' },
  ];

  protected readonly form = this.fb.group({
    firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
    lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.pattern(PASSWORD_PATTERN)]],
  });

  ngOnInit() {
    const preset = this.route.snapshot.queryParamMap.get('role');
    if (preset === 'investor' || preset === 'entrepreneur') this.role.set(preset);
  }

  protected submit() {
    if (this.form.invalid) return this.form.markAllAsTouched();
    this.loading.set(true);
    this.error.set('');
    this.auth.register({ ...this.form.getRawValue(), role: this.role()! }).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }
}
