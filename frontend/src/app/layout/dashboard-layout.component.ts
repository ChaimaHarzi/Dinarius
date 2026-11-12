import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ROLE_LABEL, mediaUrl } from '../core/format';
import { Role } from '../core/models';
import { IconComponent, IconName } from '../shared/icon.component';
import { LogoComponent } from '../shared/ui';

interface NavItem {
  label: string;
  link: string;
  icon: IconName;
  exact?: boolean;
}

const NAV: Record<Role, NavItem[]> = {
  entrepreneur: [
    { label: 'Overview', link: '/dashboard', icon: 'grid', exact: true },
    { label: 'My campaigns', link: '/dashboard/campaigns', icon: 'flag' },
    { label: 'Funding requests', link: '/dashboard/requests', icon: 'inbox' },
  ],
  investor: [
    { label: 'Overview', link: '/dashboard', icon: 'grid', exact: true },
    { label: 'My investments', link: '/dashboard/investments', icon: 'wallet' },
    { label: 'Explore campaigns', link: '/campaigns', icon: 'search' },
  ],
  admin: [
    { label: 'Overview', link: '/dashboard', icon: 'grid', exact: true },
    { label: 'Campaign review', link: '/dashboard/review', icon: 'shield' },
    { label: 'Users', link: '/dashboard/users', icon: 'users' },
    { label: 'Transactions', link: '/dashboard/transactions', icon: 'receipt' },
  ],
};

@Component({
  selector: 'app-dashboard-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, LogoComponent],
  template: `
    <div class="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <!-- Sidebar -->
      <aside class="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-stone-200 bg-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:w-auto lg:translate-x-0"
             [class.-translate-x-full]="!sidebarOpen()">
        <div class="flex h-16 items-center px-6"><app-logo /></div>
        <nav class="flex-1 space-y-1 px-3 py-4" (click)="sidebarOpen.set(false)">
          @for (item of nav(); track item.link) {
            <a [routerLink]="item.link" routerLinkActive="!bg-brand-50 !text-brand-700"
               [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
               class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50 hover:text-ink">
              <app-icon [name]="item.icon" class="size-5" /> {{ item.label }}
            </a>
          }
          <a routerLink="/dashboard/profile" routerLinkActive="!bg-brand-50 !text-brand-700"
             class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50 hover:text-ink">
            <app-icon name="user" class="size-5" /> My profile
          </a>
        </nav>
        @if (auth.user(); as user) {
          <div class="border-t border-stone-200 p-4">
            <div class="flex items-center gap-3">
              @if (avatar()) {
                <img [src]="avatar()" alt="" class="size-10 rounded-full object-cover" />
              } @else {
                <span class="flex size-10 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700">{{ initials() }}</span>
              }
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold text-ink">{{ user.fullName }}</p>
                <p class="text-xs text-stone-500">{{ roleLabel() }}</p>
              </div>
              <button class="btn btn-ghost p-2" (click)="auth.logout()" title="Log out" aria-label="Log out">
                <app-icon name="logout" class="size-5" />
              </button>
            </div>
          </div>
        }
      </aside>
      @if (sidebarOpen()) {
        <div class="fixed inset-0 z-30 bg-ink/40 lg:hidden" (click)="sidebarOpen.set(false)"></div>
      }

      <!-- Content -->
      <div class="min-w-0">
        <header class="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-stone-200 bg-sand/90 px-4 backdrop-blur lg:hidden">
          <button class="btn btn-ghost p-2" (click)="sidebarOpen.set(true)" aria-label="Open menu">
            <app-icon name="menu" class="size-6" />
          </button>
          <app-logo />
        </header>
        <main class="mx-auto max-w-7xl px-4 py-8 sm:px-8"><router-outlet /></main>
      </div>
    </div>
  `,
})
export class DashboardLayoutComponent {
  protected readonly auth = inject(AuthService);
  protected readonly sidebarOpen = signal(false);
  protected readonly nav = computed(() => NAV[this.auth.role() ?? 'investor']);
  protected readonly roleLabel = computed(() => ROLE_LABEL[this.auth.role() ?? ''] ?? '');
  protected readonly avatar = computed(() => mediaUrl(this.auth.user()?.avatarUrl));
  protected readonly initials = computed(() => {
    const user = this.auth.user();
    return user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() : '';
  });
}
