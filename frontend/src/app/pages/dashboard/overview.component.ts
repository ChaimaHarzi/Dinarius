import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Signal, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ChartDataset } from 'chart.js';
import { Observable, catchError, of } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { StatsService } from '../../core/data.service';
import { CAMPAIGN_STATUS, CHART_COLORS, ROLE_LABEL, categoryLabel, fundingLabel } from '../../core/format';
import { AdminStats, CampaignStatus, EntrepreneurStats, InvestorStats, MonthRow } from '../../core/models';
import { ChartComponent } from '../../shared/chart.component';
import { IconComponent } from '../../shared/icon.component';
import { EmptyStateComponent, ProgressComponent, SpinnerComponent, StatCardComponent, StatusBadgeComponent } from '../../shared/ui';

/** undefined while loading, null when the request failed. */
function load<T>(source: Observable<T>): Signal<T | null | undefined> {
  return toSignal(source.pipe(catchError(() => of(null))));
}

const usd = (value: number) => `$${Math.round(value).toLocaleString('en-US')}`;

function monthlyDataset(rows: MonthRow[]): ChartDataset[] {
  return [
    {
      label: 'Funds raised',
      data: rows.map((r) => r.total),
      borderColor: CHART_COLORS[0],
      backgroundColor: 'rgba(3, 152, 85, 0.12)',
      fill: true,
      cubicInterpolationMode: 'monotone',
      pointRadius: 3,
    } as ChartDataset,
  ];
}

const doughnut = (values: number[]): ChartDataset[] => [
  { data: values, backgroundColor: CHART_COLORS, borderWidth: 0 } as ChartDataset,
];

const SHARED = [ChartComponent, StatCardComponent, SpinnerComponent, EmptyStateComponent, RouterLink];

const PAGE_HEADER = `
  <div class="mb-8 flex flex-wrap items-end justify-between gap-4">
    <div>
      <p class="text-sm font-medium text-stone-500">{{ subtitle() }}</p>
      <h1 class="text-2xl font-bold sm:text-3xl">Welcome back, {{ name() }}</h1>
    </div>
    <ng-content />
  </div>`;

@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: PAGE_HEADER,
})
export class PageHeaderComponent {
  readonly name = input.required<string>();
  readonly subtitle = input('');
}

// ---------------------------------------------------------------- admin
@Component({
  selector: 'app-admin-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED, PageHeaderComponent, CurrencyPipe],
  template: `
    <app-page-header [name]="auth.user()?.firstName ?? ''" subtitle="Platform overview" />
    @let s = stats();
    @if (s === undefined) { <app-spinner /> }
    @else if (s === null) { <app-empty-state icon="alert" title="Statistics are unavailable" text="Please refresh the page." /> }
    @else {
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <app-stat-card label="Total raised" [value]="usd(s.totals.raised)" icon="dollar" [hint]="s.totals.contributions + ' contributions'" />
        <app-stat-card label="Campaigns" [value]="s.totals.campaigns" icon="flag" />
        <app-stat-card label="Users" [value]="s.totals.users" icon="users" />
        <a routerLink="/dashboard/review" class="block"><app-stat-card label="Awaiting review" [value]="s.totals.pendingCampaigns" icon="shield" hint="Open the review queue →" /></a>
      </div>

      <div class="mt-6 grid gap-6 xl:grid-cols-3">
        <section class="card p-6 xl:col-span-2">
          <h2 class="font-bold">Funds raised · last 12 months</h2>
          <app-chart class="mt-4 block" type="line" [money]="true" [labels]="monthLabels()" [datasets]="monthly()" />
        </section>
        <section class="card p-6">
          <h2 class="font-bold">Users by role</h2>
          <app-chart class="mt-4 block" type="doughnut" [labels]="roleLabels()" [datasets]="roles()" />
        </section>
        <section class="card p-6">
          <h2 class="font-bold">Campaigns by category</h2>
          <app-chart class="mt-4 block" type="doughnut" [labels]="categoryLabels()" [datasets]="categories()" />
        </section>
        <section class="card p-6">
          <h2 class="font-bold">Campaigns by status</h2>
          <app-chart class="mt-4 block" type="bar" [labels]="statusLabels()" [datasets]="statuses()" />
        </section>
        <section class="card p-6">
          <h2 class="font-bold">Top 5 investors</h2>
          @if (s.topInvestors.length) {
            <ol class="mt-4 space-y-3">
              @for (inv of s.topInvestors; track inv.investorId; let i = $index) {
                <li class="flex items-center gap-3">
                  <span class="flex size-8 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">{{ i + 1 }}</span>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-semibold text-ink">{{ inv.name }}</p>
                    <p class="text-xs text-stone-500">{{ inv.projects }} project(s) · {{ inv.contributions }} contribution(s)</p>
                  </div>
                  <span class="text-sm font-bold text-ink">{{ inv.total | currency: 'USD' : 'symbol' : '1.0-0' }}</span>
                </li>
              }
            </ol>
          } @else { <p class="mt-4 text-sm text-stone-500">No contribution yet.</p> }
        </section>
      </div>
    }
  `,
})
export class AdminOverviewComponent {
  protected readonly auth = inject(AuthService);
  protected readonly stats = load<AdminStats>(inject(StatsService).admin());
  protected readonly usd = usd;

  protected readonly monthLabels = computed(() => this.stats()?.monthly.map((m) => m.label) ?? []);
  protected readonly monthly = computed(() => monthlyDataset(this.stats()?.monthly ?? []));
  protected readonly roleLabels = computed(() => this.stats()?.usersByRole.map((r) => ROLE_LABEL[r.key]) ?? []);
  protected readonly roles = computed(() => doughnut(this.stats()?.usersByRole.map((r) => r.count) ?? []));
  protected readonly categoryRows = computed(() => this.stats()?.campaignsByCategory.filter((r) => r.count > 0) ?? []);
  protected readonly categoryLabels = computed(() => this.categoryRows().map((r) => categoryLabel(r.key)));
  protected readonly categories = computed(() => doughnut(this.categoryRows().map((r) => r.count)));
  protected readonly statusLabels = computed(
    () => this.stats()?.campaignsByStatus.map((r) => CAMPAIGN_STATUS[r.key as CampaignStatus].label) ?? [],
  );
  protected readonly statuses = computed((): ChartDataset[] => [
    {
      label: 'Campaigns',
      data: this.stats()?.campaignsByStatus.map((r) => r.count) ?? [],
      backgroundColor: CHART_COLORS[0],
      borderRadius: 6,
      maxBarThickness: 36,
    } as ChartDataset,
  ]);
}

// ---------------------------------------------------------------- entrepreneur
@Component({
  selector: 'app-entrepreneur-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED, PageHeaderComponent, CurrencyPipe, DatePipe, IconComponent],
  template: `
    <app-page-header [name]="auth.user()?.firstName ?? ''" subtitle="Your fundraising at a glance">
      <a routerLink="/dashboard/campaigns/new" class="btn btn-primary"><app-icon name="plus" class="size-4" /> New campaign</a>
    </app-page-header>
    @let s = stats();
    @if (s === undefined) { <app-spinner /> }
    @else if (s === null) { <app-empty-state icon="alert" title="Statistics are unavailable" text="Please refresh the page." /> }
    @else if (s.totals.campaigns === 0) {
      <div class="card">
        <app-empty-state icon="flag" title="Launch your first campaign" text="Describe your project and choose how investors can support you. Our team reviews it within 48 hours.">
          <a routerLink="/dashboard/campaigns/new" class="btn btn-primary">Create a campaign</a>
        </app-empty-state>
      </div>
    } @else {
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <app-stat-card label="Total raised" [value]="usd(s.totals.raised)" icon="dollar" />
        <app-stat-card label="Campaigns" [value]="s.totals.campaigns" icon="flag" [hint]="s.totals.active + ' live'" />
        <app-stat-card label="Contributors" [value]="s.totals.contributors" icon="users" />
        <a routerLink="/dashboard/requests" class="block"><app-stat-card label="Offers to answer" [value]="s.totals.pendingOffers" icon="inbox" hint="Open funding requests →" /></a>
      </div>

      <div class="mt-6 grid gap-6 xl:grid-cols-3">
        <section class="card p-6 xl:col-span-2">
          <h2 class="font-bold">Funds raised · last 12 months</h2>
          <app-chart class="mt-4 block" type="line" [money]="true" [labels]="monthLabels()" [datasets]="monthly()" />
        </section>
        <section class="card p-6">
          <h2 class="font-bold">My campaigns by status</h2>
          <app-chart class="mt-4 block" type="doughnut" [labels]="statusLabels()" [datasets]="statuses()" />
        </section>
        <section class="card p-6 xl:col-span-2">
          <h2 class="font-bold">Raised vs goal</h2>
          <app-chart class="mt-4 block" type="bar" [money]="true" [labels]="campaignLabels()" [datasets]="progress()" [height]="280" />
        </section>
        <section class="card p-6">
          <h2 class="font-bold">Latest contributions</h2>
          @if (s.recentContributions.length) {
            <ul class="mt-4 divide-y divide-stone-100">
              @for (c of s.recentContributions; track c.id) {
                <li class="flex items-center justify-between gap-3 py-3">
                  <div class="min-w-0">
                    <p class="truncate text-sm font-semibold text-ink">{{ c.investor ? c.investor.firstName + ' ' + c.investor.lastName : 'Former user' }}</p>
                    <p class="truncate text-xs text-stone-500">{{ c.campaign.title }} · {{ c.paidAt | date: 'mediumDate' }}</p>
                  </div>
                  <span class="text-sm font-bold text-brand-700">+{{ c.amount | currency: 'USD' : 'symbol' : '1.0-0' }}</span>
                </li>
              }
            </ul>
          } @else { <p class="mt-4 text-sm text-stone-500">No contribution yet.</p> }
        </section>
      </div>
    }
  `,
})
export class EntrepreneurOverviewComponent {
  protected readonly auth = inject(AuthService);
  protected readonly stats = load<EntrepreneurStats>(inject(StatsService).entrepreneur());
  protected readonly usd = usd;

  protected readonly monthLabels = computed(() => this.stats()?.monthly.map((m) => m.label) ?? []);
  protected readonly monthly = computed(() => monthlyDataset(this.stats()?.monthly ?? []));
  private readonly statusRows = computed(() => this.stats()?.campaignsByStatus.filter((r) => r.count > 0) ?? []);
  protected readonly statusLabels = computed(() => this.statusRows().map((r) => CAMPAIGN_STATUS[r.key as CampaignStatus].label));
  protected readonly statuses = computed(() => doughnut(this.statusRows().map((r) => r.count)));
  protected readonly campaignLabels = computed(() =>
    (this.stats()?.campaigns ?? []).map((c) => (c.title.length > 22 ? c.title.slice(0, 21) + '…' : c.title)),
  );
  protected readonly progress = computed((): ChartDataset[] => {
    const rows = this.stats()?.campaigns ?? [];
    return [
      { label: 'Raised', data: rows.map((c) => c.raised), backgroundColor: CHART_COLORS[0], borderRadius: 6, maxBarThickness: 28 } as ChartDataset,
      { label: 'Goal', data: rows.map((c) => c.goal), backgroundColor: '#e7e5e4', borderRadius: 6, maxBarThickness: 28 } as ChartDataset,
    ];
  });
}

// ---------------------------------------------------------------- investor
@Component({
  selector: 'app-investor-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED, PageHeaderComponent, CurrencyPipe, ProgressComponent, StatusBadgeComponent, IconComponent],
  template: `
    <app-page-header [name]="auth.user()?.firstName ?? ''" subtitle="Your portfolio">
      <a routerLink="/campaigns" class="btn btn-primary"><app-icon name="search" class="size-4" /> Find projects</a>
    </app-page-header>
    @let s = stats();
    @if (s === undefined) { <app-spinner /> }
    @else if (s === null) { <app-empty-state icon="alert" title="Statistics are unavailable" text="Please refresh the page." /> }
    @else {
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <app-stat-card label="Total invested" [value]="usd(s.totals.invested)" icon="wallet" />
        <app-stat-card label="Projects backed" [value]="s.totals.projects" icon="flag" [hint]="s.totals.contributions + ' contributions'" />
        <app-stat-card label="Average ticket" [value]="usd(s.totals.averageTicket)" icon="trending" />
        <a routerLink="/dashboard/investments" class="block"><app-stat-card label="Open offers" [value]="s.totals.openOffers" icon="inbox" hint="Equity & loan offers →" /></a>
      </div>

      <div class="mt-6 grid gap-6 xl:grid-cols-3">
        <section class="card p-6 xl:col-span-2">
          <h2 class="font-bold">Invested · last 12 months</h2>
          <app-chart class="mt-4 block" type="line" [money]="true" [labels]="monthLabels()" [datasets]="monthly()" />
        </section>
        <section class="card p-6">
          <h2 class="font-bold">By funding model</h2>
          @if (s.totals.invested > 0) {
            <app-chart class="mt-4 block" type="doughnut" [money]="true" [labels]="typeLabels()" [datasets]="types()" />
          } @else { <p class="mt-4 text-sm text-stone-500">Nothing invested yet.</p> }
        </section>

        <section class="card p-6 xl:col-span-2">
          <h2 class="font-bold">Projects I support</h2>
          @if (s.campaigns.length) {
            <div class="table-wrap mt-2">
              <table class="table">
                <thead><tr><th>Project</th><th>Invested</th><th class="w-48">Campaign progress</th><th>Status</th></tr></thead>
                <tbody>
                  @for (c of s.campaigns; track c.id) {
                    <tr>
                      <td><a [routerLink]="['/campaigns', c.id]" class="font-semibold text-ink hover:text-brand-700">{{ c.title }}</a></td>
                      <td class="font-semibold">{{ c.invested | currency: 'USD' : 'symbol' : '1.0-0' }}</td>
                      <td><div class="flex items-center gap-2"><app-progress class="flex-1" [value]="c.progress" /><span class="w-10 text-right text-xs text-stone-500">{{ c.progress }}%</span></div></td>
                      <td><app-status-badge [status]="c.status" /></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else { <p class="mt-4 text-sm text-stone-500">You have not backed any project yet.</p> }
        </section>

        <section class="card p-6">
          <h2 class="flex items-center gap-2 font-bold"><app-icon name="sparkles" class="size-5 text-brand-600" /> Advice for you</h2>
          <ul class="mt-4 space-y-3">
            @for (tip of s.advice; track $index) {
              <li class="rounded-xl p-3 text-sm"
                  [class]="tip.level === 'warning' ? 'bg-amber-50 text-amber-900' : tip.level === 'tip' ? 'bg-brand-50 text-brand-900' : 'bg-sky-50 text-sky-900'">
                {{ tip.message }}
                @if (tip.campaignId) { <a [routerLink]="['/campaigns', tip.campaignId]" class="mt-1 block font-semibold underline">View the campaign</a> }
              </li>
            }
          </ul>
        </section>
      </div>
    }
  `,
})
export class InvestorOverviewComponent {
  protected readonly auth = inject(AuthService);
  protected readonly stats = load<InvestorStats>(inject(StatsService).investor());
  protected readonly usd = usd;

  protected readonly monthLabels = computed(() => this.stats()?.monthly.map((m) => m.label) ?? []);
  protected readonly monthly = computed(() => monthlyDataset(this.stats()?.monthly ?? []));
  private readonly typeRows = computed(() => this.stats()?.byType.filter((r) => r.total > 0) ?? []);
  protected readonly typeLabels = computed(() => this.typeRows().map((r) => fundingLabel(r.key)));
  protected readonly types = computed(() => doughnut(this.typeRows().map((r) => r.total)));
}

// ---------------------------------------------------------------- entry point
@Component({
  selector: 'app-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdminOverviewComponent, EntrepreneurOverviewComponent, InvestorOverviewComponent],
  template: `
    @switch (auth.role()) {
      @case ('admin') { <app-admin-overview /> }
      @case ('entrepreneur') { <app-entrepreneur-overview /> }
      @default { <app-investor-overview /> }
    }
  `,
})
export class OverviewComponent {
  protected readonly auth = inject(AuthService);
}
