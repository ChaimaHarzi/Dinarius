import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { IconComponent } from '../shared/icon.component';
import { LogoComponent } from '../shared/ui';

@Component({
  selector: 'app-public-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LogoComponent, IconComponent],
  template: `
    <header class="sticky top-0 z-40 border-b border-stone-200/70 bg-sand/85 backdrop-blur">
      <nav class="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <app-logo />
        <div class="hidden items-center gap-1 text-sm font-medium md:flex">
          <a routerLink="/campaigns" routerLinkActive="text-brand-700" class="rounded-lg px-3 py-2 text-stone-600 hover:text-ink">Explore</a>
          <a routerLink="/" fragment="how-it-works" class="rounded-lg px-3 py-2 text-stone-600 hover:text-ink">How it works</a>
          <a routerLink="/" fragment="models" class="rounded-lg px-3 py-2 text-stone-600 hover:text-ink">Funding models</a>
        </div>
        <div class="hidden items-center gap-2 md:flex">
          @if (auth.user(); as user) {
            <a routerLink="/dashboard" class="btn btn-primary">Dashboard</a>
          } @else {
            <a routerLink="/login" class="btn btn-ghost">Log in</a>
            <a routerLink="/register" class="btn btn-primary">Get started</a>
          }
        </div>
        <button class="btn btn-ghost p-2 md:hidden" (click)="menuOpen.set(!menuOpen())" aria-label="Menu">
          <app-icon [name]="menuOpen() ? 'x' : 'menu'" class="size-6" />
        </button>
      </nav>
      @if (menuOpen()) {
        <div class="border-t border-stone-200 bg-white px-4 py-3 md:hidden" (click)="menuOpen.set(false)">
          <a routerLink="/campaigns" class="block rounded-lg px-3 py-2.5 font-medium">Explore campaigns</a>
          <a routerLink="/" fragment="how-it-works" class="block rounded-lg px-3 py-2.5 font-medium">How it works</a>
          @if (auth.isLoggedIn()) {
            <a routerLink="/dashboard" class="btn btn-primary mt-2 w-full">Dashboard</a>
          } @else {
            <div class="mt-2 grid grid-cols-2 gap-2">
              <a routerLink="/login" class="btn btn-secondary">Log in</a>
              <a routerLink="/register" class="btn btn-primary">Get started</a>
            </div>
          }
        </div>
      }
    </header>

    <main class="min-h-[calc(100vh-4rem)]"><router-outlet /></main>

    <footer class="bg-ink text-stone-300">
      <div class="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <app-logo [light]="true" />
          <p class="mt-4 max-w-sm text-sm text-stone-400">
            Crowdfunding built for Tunisian startups: donations, rewards, equity and loans, open to local and diaspora investors.
          </p>
        </div>
        <div>
          <p class="text-sm font-semibold text-white">Platform</p>
          <ul class="mt-3 space-y-2 text-sm">
            <li><a routerLink="/campaigns" class="hover:text-white">Explore campaigns</a></li>
            <li><a routerLink="/register" class="hover:text-white">Start a campaign</a></li>
          </ul>
        </div>
        <div>
          <p class="text-sm font-semibold text-white">Account</p>
          <ul class="mt-3 space-y-2 text-sm">
            <li><a routerLink="/login" class="hover:text-white">Log in</a></li>
            <li><a routerLink="/register" class="hover:text-white">Create an account</a></li>
          </ul>
        </div>
      </div>
      <p class="border-t border-white/10 py-6 text-center text-xs text-stone-500">© {{ year }} Dinarius</p>
    </footer>
  `,
})
export class PublicLayoutComponent {
  protected readonly auth = inject(AuthService);
  protected readonly menuOpen = signal(false);
  protected readonly year = new Date().getFullYear();
}
