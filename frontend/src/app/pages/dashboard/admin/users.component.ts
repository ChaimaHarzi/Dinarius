import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/auth.service';
import { UserService } from '../../../core/data.service';
import { ROLE_LABEL, errorMessage } from '../../../core/format';
import { Page, Role, User } from '../../../core/models';
import { ToastService } from '../../../core/toast.service';
import { IconComponent } from '../../../shared/icon.component';
import { EmptyStateComponent, ModalComponent, PaginationComponent, SpinnerComponent } from '../../../shared/ui';
import { PASSWORD_PATTERN } from '../../auth/auth-shell.component';

@Component({
  selector: 'app-users',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ReactiveFormsModule, DatePipe, IconComponent, EmptyStateComponent, ModalComponent, PaginationComponent, SpinnerComponent],
  template: `
    <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold sm:text-3xl">Users</h1>
        <p class="mt-1 text-stone-600">Manage accounts, roles and access.</p>
      </div>
      <button class="btn btn-primary" (click)="openCreate()"><app-icon name="plus" class="size-4" /> Add a user</button>
    </div>

    <div class="card">
      <div class="grid gap-3 border-b border-stone-100 p-4 sm:grid-cols-[1fr_12rem]">
        <label class="relative">
          <span class="sr-only">Search</span>
          <app-icon name="search" class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" />
          <input class="input pl-9" placeholder="Search by name or email" [(ngModel)]="q" (ngModelChange)="search$.next()" />
        </label>
        <select class="input" aria-label="Role" [(ngModel)]="role" (ngModelChange)="load(1)">
          <option value="">All roles</option>
          @for (r of roles; track r) { <option [value]="r">{{ roleLabel[r] }}</option> }
        </select>
      </div>

      @if (page() === undefined) { <app-spinner /> }
      @else if (!page()?.items?.length) { <app-empty-state icon="users" title="No user found" /> }
      @else {
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Joined</th><th class="text-right">Actions</th></tr></thead>
            <tbody>
              @for (u of page()!.items; track u.id) {
                @let isMe = u.id === auth.user()?.id;
                <tr [class.opacity-60]="!u.isActive">
                  <td>
                    <p class="font-semibold text-ink">{{ u.fullName }} @if (isMe) { <span class="text-xs font-normal text-stone-400">(you)</span> }</p>
                    <p class="text-xs text-stone-500">{{ u.email }}</p>
                  </td>
                  <td>
                    <select class="input w-36 py-1.5" [ngModel]="u.role" (ngModelChange)="changeRole(u, $event)" [disabled]="isMe" aria-label="Role">
                      @for (r of roles; track r) { <option [value]="r">{{ roleLabel[r] }}</option> }
                    </select>
                  </td>
                  <td>
                    <button class="rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset disabled:cursor-default"
                            [class]="u.isActive ? 'bg-brand-50 text-brand-700 ring-brand-600/20' : 'bg-stone-100 text-stone-600 ring-stone-400/30'"
                            [disabled]="isMe" (click)="toggleActive(u)" [title]="u.isActive ? 'Disable this account' : 'Enable this account'">
                      {{ u.isActive ? 'Active' : 'Disabled' }}
                    </button>
                  </td>
                  <td class="whitespace-nowrap text-stone-600">{{ u.createdAt | date: 'mediumDate' }}</td>
                  <td class="text-right">
                    @if (!isMe) {
                      <button class="btn btn-ghost p-2 text-red-600 hover:bg-red-50" title="Delete" (click)="toDelete.set(u)"><app-icon name="trash" class="size-4" /></button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="px-4 pb-4"><app-pagination [page]="page()!.page" [pages]="page()!.pages" [total]="page()!.total" (changed)="load($event)" /></div>
      }
    </div>

    <app-modal [open]="creating()" title="Add a user" (closed)="creating.set(false)">
      <form [formGroup]="form" (ngSubmit)="create()" class="space-y-4" novalidate>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block"><span class="label">First name</span><input class="input" formControlName="firstName" /></label>
          <label class="block"><span class="label">Last name</span><input class="input" formControlName="lastName" /></label>
        </div>
        <label class="block"><span class="label">Email</span><input class="input" type="email" formControlName="email" /></label>
        <label class="block">
          <span class="label">Temporary password</span><input class="input" type="text" formControlName="password" />
          <p class="mt-1 text-xs text-stone-500">At least 8 characters, with a letter and a number. Share it securely.</p>
        </label>
        <label class="block">
          <span class="label">Role</span>
          <select class="input" formControlName="role">@for (r of roles; track r) { <option [value]="r">{{ roleLabel[r] }}</option> }</select>
        </label>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn btn-secondary" (click)="creating.set(false)">Cancel</button>
          <button class="btn btn-primary" [disabled]="busy()">Create the account</button>
        </div>
      </form>
    </app-modal>

    <app-modal [open]="toDelete() !== null" title="Delete this account?" (closed)="toDelete.set(null)">
      <p class="text-sm text-stone-600">{{ toDelete()?.fullName }} ({{ toDelete()?.email }}) will be deleted. Their open campaigns and offers are cancelled; past payments are kept for accounting.</p>
      <div class="mt-6 flex justify-end gap-2">
        <button class="btn btn-secondary" (click)="toDelete.set(null)">Cancel</button>
        <button class="btn btn-danger" [disabled]="busy()" (click)="remove()">Delete</button>
      </div>
    </app-modal>
  `,
})
export class UsersComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly users = inject(UserService);
  private readonly toast = inject(ToastService);

  protected readonly roles: Role[] = ['investor', 'entrepreneur', 'admin'];
  protected readonly roleLabel = ROLE_LABEL;
  protected readonly page = signal<Page<User> | null | undefined>(undefined);
  protected readonly creating = signal(false);
  protected readonly toDelete = signal<User | null>(null);
  protected readonly busy = signal(false);
  protected readonly search$ = new Subject<void>();
  protected q = '';
  protected role: Role | '' = '';

  protected readonly form = inject(NonNullableFormBuilder).group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.pattern(PASSWORD_PATTERN)]],
    role: ['investor' as Role, Validators.required],
  });

  constructor() {
    this.search$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.load(1));
  }

  ngOnInit() {
    this.load(1);
  }

  protected load(page: number) {
    this.users.list({ page, limit: 10, q: this.q.trim(), role: this.role }).subscribe({
      next: (result) => this.page.set(result),
      error: (err) => {
        this.page.set(null);
        this.toast.error(errorMessage(err));
      },
    });
  }

  protected openCreate() {
    this.form.reset();
    this.creating.set(true);
  }

  protected create() {
    if (this.form.invalid) return this.form.markAllAsTouched();
    this.busy.set(true);
    this.users.create(this.form.getRawValue()).subscribe({
      next: (user) => {
        this.toast.success(`Account created for ${user.fullName}.`);
        this.creating.set(false);
        this.busy.set(false);
        this.load(1);
      },
      error: (err) => {
        this.toast.error(errorMessage(err));
        this.busy.set(false);
      },
    });
  }

  protected changeRole(user: User, role: Role) {
    this.patch(user, { role }, `${user.firstName} is now ${ROLE_LABEL[role].toLowerCase()}.`);
  }

  protected toggleActive(user: User) {
    this.patch(user, { isActive: !user.isActive }, user.isActive ? 'Account disabled.' : 'Account enabled.');
  }

  protected remove() {
    const user = this.toDelete();
    if (!user) return;
    this.busy.set(true);
    this.users.remove(user.id).subscribe({
      next: () => {
        this.toast.success('Account deleted.');
        this.toDelete.set(null);
        this.busy.set(false);
        this.load(this.page()?.page ?? 1);
      },
      error: (err) => {
        this.toast.error(errorMessage(err));
        this.busy.set(false);
      },
    });
  }

  private patch(user: User, body: { role?: Role; isActive?: boolean }, message: string) {
    this.users.update(user.id, body).subscribe({
      next: (updated) => {
        this.page.update((p) => p && { ...p, items: p.items.map((u) => (u.id === updated.id ? updated : u)) });
        this.toast.success(message);
      },
      error: (err) => {
        this.toast.error(errorMessage(err));
        this.load(this.page()?.page ?? 1);
      },
    });
  }
}
