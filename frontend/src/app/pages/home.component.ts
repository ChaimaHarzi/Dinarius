import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { CampaignService } from '../core/data.service';
import { FUNDING_TYPES } from '../core/format';
import { CampaignCardComponent } from '../shared/campaign-card.component';
import { IconComponent, IconName } from '../shared/icon.component';

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CampaignCardComponent, IconComponent],
  template: `
    <!-- Hero -->
    <section class="relative overflow-hidden">
      <div class="absolute inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_80%_-10%,var(--color-brand-100),transparent)]"></div>
      <div class="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <span class="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-600/15">
            <app-icon name="globe" class="size-3.5" /> For Tunisian startups and the diaspora
          </span>
          <h1 class="mt-5 text-4xl leading-tight font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            Fund the ideas that <span class="text-brand-600">build Tunisia</span>, one dinar at a time.
          </h1>
          <p class="mt-5 max-w-xl text-lg text-stone-600">
            Dinarius brings founders and backers together on one transparent platform: donate, pre-order,
            become a shareholder or lend to the startups you believe in.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <a routerLink="/campaigns" class="btn btn-primary px-6 py-3 text-base">Explore campaigns <app-icon name="arrow-right" class="size-4" /></a>
            <a [routerLink]="['/register']" [queryParams]="{ role: 'entrepreneur' }" class="btn btn-secondary px-6 py-3 text-base">Start a campaign</a>
          </div>
        </div>

        <div class="relative hidden lg:block">
          <div class="card rotate-2 p-6 shadow-xl">
            <div class="flex items-center justify-between">
              <p class="text-sm font-semibold text-stone-500">Raised this year</p>
              <span class="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">+38%</span>
            </div>
            <div class="mt-6 flex h-40 items-end gap-2">
              @for (h of bars; track $index) {
                <div class="flex-1 rounded-t-md bg-linear-to-t from-brand-600 to-brand-300" [style.height.%]="h"></div>
              }
            </div>
          </div>
          <div class="card absolute -bottom-8 -left-8 w-64 -rotate-3 p-4 shadow-xl">
            <p class="text-xs font-semibold text-stone-500">New equity offer</p>
            <p class="mt-1 font-bold text-ink">$4,000 for 1.2% of SunDrip</p>
            <div class="mt-3 flex gap-2"><span class="btn btn-primary btn-sm">Accept</span><span class="btn btn-secondary btn-sm">Decline</span></div>
          </div>
        </div>
      </div>
    </section>

    <!-- Featured -->
    <section class="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div class="flex items-end justify-between gap-4">
        <div>
          <h2 class="text-3xl font-bold tracking-tight">Campaigns gaining momentum</h2>
          <p class="mt-2 text-stone-600">Verified by our team before going live.</p>
        </div>
        <a routerLink="/campaigns" class="hidden items-center gap-1 text-sm font-semibold text-brand-700 hover:underline sm:flex">
          See all <app-icon name="arrow-right" class="size-4" />
        </a>
      </div>
      @if (featured(); as list) {
        @if (list.length) {
          <div class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            @for (campaign of list; track campaign.id) { <app-campaign-card [campaign]="campaign" /> }
          </div>
        } @else {
          <p class="card mt-8 p-8 text-center text-stone-500">No live campaign yet. Be the first to launch one!</p>
        }
      }
    </section>

    <!-- How it works -->
    <section id="how-it-works" class="scroll-mt-20 border-y border-stone-200 bg-white">
      <div class="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 class="text-center text-3xl font-bold tracking-tight">How it works</h2>
        <div class="mt-12 grid gap-8 md:grid-cols-3">
          @for (step of steps; track step.title; let i = $index) {
            <div class="relative rounded-2xl bg-sand p-6">
              <span class="flex size-11 items-center justify-center rounded-xl bg-brand-600 text-white">
                <app-icon [name]="step.icon" class="size-5" />
              </span>
              <p class="mt-5 text-xs font-bold tracking-wider text-brand-700 uppercase">Step {{ i + 1 }}</p>
              <h3 class="mt-1 text-lg font-bold">{{ step.title }}</h3>
              <p class="mt-2 text-sm text-stone-600">{{ step.text }}</p>
            </div>
          }
        </div>
      </div>
    </section>

    <!-- Funding models -->
    <section id="models" class="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
      <div class="max-w-2xl">
        <h2 class="text-3xl font-bold tracking-tight">Four ways to back a project</h2>
        <p class="mt-3 text-stone-600">Each campaign chooses the models it accepts. Equity and loan offers are reviewed by the founder before any payment.</p>
      </div>
      <div class="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        @for (model of models; track model.value) {
          <div class="card p-6">
            <p class="text-lg font-bold">{{ model.label }}</p>
            <p class="mt-2 text-sm text-stone-600">{{ model.hint }}</p>
          </div>
        }
      </div>
    </section>

    <!-- CTA -->
    <section class="px-4 pb-20 sm:px-6">
      <div class="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 rounded-3xl bg-ink px-8 py-12 md:flex-row md:items-center md:px-12">
        <div>
          <h2 class="text-2xl font-bold text-white sm:text-3xl">Have a project that deserves funding?</h2>
          <p class="mt-2 text-stone-300">Create your campaign in minutes. Our team reviews it within 48 hours.</p>
        </div>
        <a [routerLink]="['/register']" [queryParams]="{ role: 'entrepreneur' }" class="btn btn-primary px-6 py-3 text-base">Launch my campaign</a>
      </div>
    </section>
  `,
})
export class HomeComponent {
  private readonly campaigns = inject(CampaignService);

  protected readonly featured = toSignal(
    this.campaigns.list({ sort: 'mostFunded', limit: 3 }).pipe(
      map((page) => page.items),
      catchError(() => of([])),
    ),
  );

  protected readonly bars = [35, 48, 42, 60, 55, 72, 68, 85, 78, 92];
  protected readonly models = FUNDING_TYPES;
  protected readonly steps: { icon: IconName; title: string; text: string }[] = [
    { icon: 'flag', title: 'Founders publish a campaign', text: 'Describe the project, set a goal and choose which funding models you accept.' },
    { icon: 'shield', title: 'Our team verifies it', text: 'Every campaign is reviewed by an administrator before it becomes visible to investors.' },
    { icon: 'heart', title: 'Backers fund it securely', text: 'Pay by card through Stripe, or send an equity or loan offer the founder can accept.' },
  ];
}
