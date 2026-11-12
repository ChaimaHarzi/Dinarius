import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { UploadService, UserService } from '../../core/data.service';
import { ROLE_LABEL, errorMessage, mediaUrl } from '../../core/format';
import { ToastService } from '../../core/toast.service';
import { IconComponent } from '../../shared/icon.component';
import { ModalComponent } from '../../shared/ui';
import { PASSWORD_PATTERN } from '../auth/auth-shell.component';

@Component({
  selector: 'app-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent, ModalComponent],
  template: `
    <h1 class="text-2xl font-bold sm:text-3xl">My profile</h1>
    <p class="mt-1 text-stone-600">{{ roleLabel() }} account</p>

    <div class="mt-8 grid gap-6 xl:grid-cols-[1fr_22rem]">
      <!-- Personal information -->
      <form class="card p-6 sm:p-8" [formGroup]="profile" (ngSubmit)="saveProfile()" novalidate>
        <h2 class="font-bold">Personal information</h2>
        <div class="mt-6 flex items-center gap-5">
          @if (avatar()) {
            <img [src]="avatar()" alt="" class="size-20 rounded-full object-cover ring-4 ring-brand-50" />
          } @else {
            <span class="flex size-20 items-center justify-center rounded-full bg-brand-100 text-2xl font-bold text-brand-700">{{ initials() }}</span>
          }
          <div>
            <label class="btn btn-secondary btn-sm cursor-pointer">
              <app-icon name="upload" class="size-4" /> {{ uploading() ? 'Uploading…' : 'Change photo' }}
              <input type="file" class="sr-only" accept="image/png,image/jpeg,image/webp" (change)="uploadAvatar($event)" [disabled]="uploading()" />
            </label>
            <p class="mt-1.5 text-xs text-stone-500">JPG, PNG or WEBP, 3 MB max.</p>
          </div>
        </div>

        <div class="mt-6 grid gap-5 sm:grid-cols-2">
          <label class="block"><span class="label">First name</span><input class="input" formControlName="firstName" autocomplete="given-name" /></label>
          <label class="block"><span class="label">Last name</span><input class="input" formControlName="lastName" autocomplete="family-name" /></label>
          <label class="block sm:col-span-2">
            <span class="label">Email</span><input class="input" type="email" formControlName="email" autocomplete="email" />
            @if (profile.controls.email.touched && profile.controls.email.invalid) { <p class="field-error">Enter a valid email address.</p> }
          </label>
          <label class="block"><span class="label">Phone</span><input class="input" formControlName="phone" autocomplete="tel" placeholder="+216 …" /></label>
          <label class="block"><span class="label">Birth date</span><input class="input" type="date" formControlName="birthDate" /></label>
          <label class="block sm:col-span-2"><span class="label">Location</span><input class="input" formControlName="location" placeholder="City, country" /></label>
          <label class="block sm:col-span-2">
            <span class="label">About you</span>
            <textarea class="input" rows="4" maxlength="500" formControlName="bio" placeholder="A few words shown on your campaigns"></textarea>
          </label>
        </div>
        <div class="mt-6 flex justify-end">
          <button class="btn btn-primary" [disabled]="savingProfile() || profile.pristine">{{ savingProfile() ? 'Saving…' : 'Save changes' }}</button>
        </div>
      </form>

      <div class="space-y-6">
        <!-- Password -->
        <form class="card p-6" [formGroup]="password" (ngSubmit)="savePassword()" novalidate>
          <h2 class="font-bold">Password</h2>
          <label class="mt-4 block">
            <span class="label">Current password</span>
            <input class="input" type="password" formControlName="currentPassword" autocomplete="current-password" />
            <p class="mt-1 text-xs text-stone-500">Leave empty if you signed up with Google.</p>
          </label>
          <label class="mt-4 block">
            <span class="label">New password</span>
            <input class="input" type="password" formControlName="newPassword" autocomplete="new-password" />
            <p class="mt-1 text-xs" [class]="password.controls.newPassword.touched && password.controls.newPassword.invalid ? 'text-red-600' : 'text-stone-500'">
              At least 8 characters, with a letter and a number.
            </p>
          </label>
          <button class="btn btn-secondary mt-5 w-full" [disabled]="savingPassword()">{{ savingPassword() ? 'Updating…' : 'Update password' }}</button>
        </form>

        <!-- Danger zone -->
        <section class="card border-red-200 p-6">
          <h2 class="font-bold text-red-700">Delete my account</h2>
          <p class="mt-2 text-sm text-stone-600">Your open campaigns and offers are cancelled. This cannot be undone.</p>
          <button class="btn btn-danger mt-4 w-full" (click)="confirmingDelete.set(true)">Delete my account</button>
        </section>
      </div>
    </div>

    <app-modal [open]="confirmingDelete()" title="Delete your account?" (closed)="confirmingDelete.set(false)">
      <p class="text-sm text-stone-600">You will be logged out and your account will be permanently removed.</p>
      <div class="mt-6 flex justify-end gap-2">
        <button class="btn btn-secondary" (click)="confirmingDelete.set(false)">Keep my account</button>
        <button class="btn btn-danger" [disabled]="deleting()" (click)="deleteAccount()">Delete permanently</button>
      </div>
    </app-modal>
  `,
})
export class ProfileComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly users = inject(UserService);
  private readonly uploads = inject(UploadService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly savingProfile = signal(false);
  protected readonly savingPassword = signal(false);
  protected readonly uploading = signal(false);
  protected readonly confirmingDelete = signal(false);
  protected readonly deleting = signal(false);

  protected readonly roleLabel = computed(() => ROLE_LABEL[this.auth.role() ?? ''] ?? '');
  protected readonly avatar = computed(() => mediaUrl(this.auth.user()?.avatarUrl));
  protected readonly initials = computed(() => {
    const u = this.auth.user();
    return u ? `${u.firstName[0] ?? ''}${u.lastName[0] ?? ''}`.toUpperCase() : '';
  });

  protected readonly profile = this.fb.group({
    firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
    lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.pattern(/^(\+?[\d\s-]{6,20})?$/)],
    birthDate: [''],
    location: ['', Validators.maxLength(100)],
    bio: ['', Validators.maxLength(500)],
  });

  protected readonly password = this.fb.group({
    currentPassword: [''],
    newPassword: ['', [Validators.required, Validators.pattern(PASSWORD_PATTERN)]],
  });

  ngOnInit() {
    const user = this.auth.user();
    if (!user) return;
    this.profile.reset({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone ?? '',
      birthDate: user.birthDate ? user.birthDate.slice(0, 10) : '',
      location: user.location ?? '',
      bio: user.bio ?? '',
    });
  }

  protected saveProfile() {
    if (this.profile.invalid) return this.profile.markAllAsTouched();
    const { birthDate, ...rest } = this.profile.getRawValue();
    this.savingProfile.set(true);
    this.users.updateMe({ ...rest, birthDate: birthDate || null }).subscribe({
      next: (user) => {
        this.auth.updateUser(user);
        this.profile.markAsPristine();
        this.toast.success('Profile updated.');
        this.savingProfile.set(false);
      },
      error: (err) => {
        this.toast.error(errorMessage(err));
        this.savingProfile.set(false);
      },
    });
  }

  protected uploadAvatar(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading.set(true);
    this.uploads.image(file).subscribe({
      next: (avatarUrl) =>
        this.users.updateMe({ avatarUrl }).subscribe({
          next: (user) => {
            this.auth.updateUser(user);
            this.toast.success('Photo updated.');
            this.uploading.set(false);
          },
          error: (err) => {
            this.toast.error(errorMessage(err));
            this.uploading.set(false);
          },
        }),
      error: (err) => {
        this.toast.error(errorMessage(err));
        this.uploading.set(false);
      },
    });
  }

  protected savePassword() {
    if (this.password.invalid) return this.password.markAllAsTouched();
    const { currentPassword, newPassword } = this.password.getRawValue();
    this.savingPassword.set(true);
    this.users.changePassword(newPassword, currentPassword).subscribe({
      next: (session) => {
        this.auth.setSession(session);
        this.password.reset();
        this.toast.success('Password updated.');
        this.savingPassword.set(false);
      },
      error: (err) => {
        this.toast.error(errorMessage(err));
        this.savingPassword.set(false);
      },
    });
  }

  protected deleteAccount() {
    this.deleting.set(true);
    this.users.deleteMe().subscribe({
      next: () => {
        this.toast.info('Your account has been deleted.');
        this.auth.logout();
      },
      error: (err) => {
        this.toast.error(errorMessage(err));
        this.deleting.set(false);
      },
    });
  }
}
