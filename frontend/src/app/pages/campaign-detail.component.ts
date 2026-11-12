import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { CampaignService, InvestmentService } from '../core/data.service';
import { FUNDING_TYPES, categoryLabel, errorMessage, mediaUrl } from '../core/format';
import { Campaign, FundingType } from '../core/models';
import { ToastService } from '../core/toast.service';
import { IconComponent } from '../shared/icon.component';
import { EmptyStateComponent, ImgFallbackDirective, ProgressComponent, SpinnerComponent, StatusBadgeComponent } from '../shared/ui';

@Component({
  selector: 'app-campaign-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    FormsModule,
    CurrencyPipe,
    DatePipe,
    IconComponent,
    ProgressComponent,
    SpinnerComponent,
    EmptyStateComponent,
    StatusBadgeComponent,
    ImgFallbackDirective,
  ],
  template: `
    @if (loading()) {
      <app-spinner />
    } @else if (!campaign()) {
      <app-empty-state icon="search" title="Campaign not found" text="It may have been removed or is not public yet.">
        <a routerLink="/campaigns" class="btn btn-primary">Browse campaigns</a>
      </app-empty-state>
    } @else {
      @let c = campaign()!;
      <article class="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <a routerLink="/campaigns" class="inline-flex items-center gap-1 text-sm font-medium text-stone-500 hover:text-ink">
          <app-icon name="arrow-left" class="size-4" /> All campaigns
        </a>

        @if (c.status !== 'active') {
          <div class="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <app-status-badge [status]="c.status" />
            @switch (c.status) {
              @case ('pending') { This campaign is waiting for review and is only visible to you and administrators. }
              @case ('rejected') { Rejected: {{ c.rejectionReason }} }
              @case ('completed') { This campaign has ended. Thank you to every backer! }
              @default { This campaign is closed. }
            }
          </div>
        }

        <div class="mt-6 grid gap-10 lg:grid-cols-[1fr_380px]">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-brand-700">{{ category() }} · {{ c.country }}</p>
            <h1 class="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{{ c.title }}</h1>
            <p class="mt-3 text-lg text-stone-600">{{ c.summary }}</p>

            <div class="mt-6 aspect-video overflow-hidden rounded-2xl bg-linear-to-br from-brand-100 to-brand-300">
              @if (cover()) { <img appFallback [src]="cover()" [alt]="c.title" class="size-full object-cover" /> }
            </div>

            @if (c.entrepreneur; as owner) {
              <div class="mt-6 flex items-center gap-3">
                @if (owner.avatarUrl) {
                  <img appFallback [src]="media(owner.avatarUrl)" alt="" class="size-11 rounded-full object-cover" />
                } @else {
                  <span class="flex size-11 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700">{{ owner.firstName[0] }}</span>
                }
                <div>
                  <p class="font-semibold text-ink">{{ owner.firstName }} {{ owner.lastName }}</p>
                  <p class="text-sm text-stone-500">Founder{{ owner.location ? ' · ' + owner.location : '' }}</p>
                </div>
              </div>
            }

            <h2 class="mt-10 text-xl font-bold">About the project</h2>
            <p class="mt-3 leading-relaxed whitespace-pre-line text-stone-700">{{ c.description }}</p>

            <h2 class="mt-10 text-xl font-bold">Funding terms</h2>
            <dl class="mt-4 grid gap-3 sm:grid-cols-2">
              @for (type of c.fundingTypes; track type) {
                <div class="rounded-xl border border-stone-200 bg-white p-4">
                  <dt class="font-semibold text-ink">{{ fundingMeta(type).label }}</dt>
                  <dd class="mt-1 text-sm text-stone-600">
                    @switch (type) {
                      @case ('equity') { {{ c.equityPercentage ? c.equityPercentage + '% of the company is offered to investors.' : fundingMeta(type).hint }} }
                      @case ('loan') { {{ c.loanInterestRate != null ? c.loanInterestRate + '% annual interest.' : fundingMeta(type).hint }} }
                      @case ('reward') { {{ c.rewardDescription || fundingMeta(type).hint }} }
                      @default { {{ fundingMeta(type).hint }} }
                    }
                  </dd>
                </div>
              }
            </dl>
          </div>

          <!-- Funding panel -->
          <aside class="lg:sticky lg:top-24 lg:self-start">
            <div class="card p-6">
              <p class="text-3xl font-extrabold text-ink">{{ c.raisedAmount | currency: 'USD' : 'symbol' : '1.0-0' }}</p>
              <p class="text-sm text-stone-500">raised of {{ c.goalAmount | currency: 'USD' : 'symbol' : '1.0-0' }} goal</p>
              <app-progress class="mt-4 block" [value]="c.progress" />
              <div class="mt-5 grid grid-cols-3 gap-2 text-center">
                <div><p class="text-lg font-bold text-ink">{{ c.progress }}%</p><p class="text-xs text-stone-500">funded</p></div>
                <div><p class="text-lg font-bold text-ink">{{ c.contributionsCount }}</p><p class="text-xs text-stone-500">contributions</p></div>
                <div><p class="text-lg font-bold text-ink">{{ c.daysLeft }}</p><p class="text-xs text-stone-500">days left</p></div>
              </div>
              <p class="mt-4 text-center text-xs text-stone-400">Ends on {{ c.endDate | date: 'mediumDate' }}</p>

              <div class="mt-6 border-t border-stone-100 pt-6">
                @if (c.status !== 'active') {
                  <p class="text-center text-sm text-stone-500">This campaign is not accepting contributions.</p>
                } @else if (!auth.isLoggedIn()) {
                  <a routerLink="/login" [queryParams]="{ returnUrl: '/campaigns/' + c.id }" class="btn btn-primary w-full py-3">Log in to back this project</a>
                  <p class="mt-3 text-center text-xs text-stone-500">No account? <a routerLink="/register" class="font-semibold text-brand-700">Join as an investor</a></p>
                } @else if (auth.role() !== 'investor') {
                  <p class="rounded-lg bg-stone-50 p-3 text-center text-sm text-stone-600">Only investor accounts can fund campaigns.</p>
                } @else {
                  <p class="text-sm font-semibold text-ink">How do you want to contribute?</p>
                  <div class="mt-3 grid grid-cols-2 gap-2">
                    @for (type of c.fundingTypes; track type) {
                      <button type="button" class="rounded-lg border px-3 py-2 text-sm font-semibold transition"
                              [class]="selectedType() === type ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-stone-200 text-stone-600 hover:border-stone-300'"
                              (click)="selectedType.set(type)">
                        {{ fundingMeta(type).label }}
                      </button>
                    }
                  </div>
                  <p class="mt-2 text-xs text-stone-500">{{ fundingMeta(selectedType()).hint }}</p>

                  <form class="mt-4 space-y-3" (ngSubmit)="submit(c)">
                    <label class="block">
                      <span class="label">Amount (USD)</span>
                      <input class="input" type="number" min="1" step="1" name="amount" required [(ngModel)]="amount" />
                    </label>
                    @if (needsApproval()) {
                      <label class="block">
                        <span class="label">Message to the founder <span class="font-normal text-stone-400">(optional)</span></span>
                        <textarea class="input" rows="3" name="message" maxlength="1000" [(ngModel)]="message"></textarea>
                      </label>
                    }
                    <button class="btn btn-primary w-full py-3" [disabled]="submitting() || !(amount > 0)">
                      @if (submitting()) { Processing… } @else if (needsApproval()) { Send my offer } @else { Contribute {{ amount | currency: 'USD' : 'symbol' : '1.0-0' }} }
                    </button>
                    @if (!needsApproval() && paymentMode() === 'demo') {
                      <p class="text-center text-xs text-amber-700">Demo mode: no card is charged.</p>
                    } @else if (!needsApproval()) {
                      <p class="flex items-center justify-center gap-1 text-xs text-stone-500"><app-icon name="lock" class="size-3.5" /> Secure payment by Stripe</p>
                    }
                  </form>
                }
              </div>
            </div>
          </aside>
        </div>
      </article>
    }
  `,
})
export class CampaignDetailComponent implements OnInit {
  readonly id = input.required<string>();

  protected readonly auth = inject(AuthService);
  private readonly campaigns = inject(CampaignService);
  private readonly investments = inject(InvestmentService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly loading = signal(true);
  protected readonly campaign = signal<Campaign | null>(null);
  protected readonly selectedType = signal<FundingType>('donation');
  protected readonly submitting = signal(false);
  protected readonly paymentMode = signal<'stripe' | 'demo'>('stripe');
  protected amount = 50;
  protected message = '';

  protected readonly cover = computed(() => mediaUrl(this.campaign()?.coverImage));
  protected readonly category = computed(() => categoryLabel(this.campaign()?.category ?? ''));
  protected readonly needsApproval = computed(() => ['equity', 'loan'].includes(this.selectedType()));
  protected readonly media = mediaUrl;
  protected readonly fundingMeta = (type: FundingType) => FUNDING_TYPES.find((f) => f.value === type)!;

  ngOnInit() {
    if (this.route.snapshot.queryParamMap.get('payment') === 'cancelled') {
      this.toast.info('Payment cancelled. You have not been charged.');
    }
    this.investments.paymentMode().subscribe({ next: (mode) => this.paymentMode.set(mode), error: () => {} });
    this.campaigns.get(this.id()).subscribe({
      next: (campaign) => {
        this.campaign.set(campaign);
        this.selectedType.set(campaign.fundingTypes[0]);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected submit(campaign: Campaign) {
    const type = this.selectedType();
    this.submitting.set(true);

    if (type === 'equity' || type === 'loan') {
      this.investments.engage(campaign.id, this.amount, type, this.message.trim()).subscribe({
        next: () => {
          this.toast.success('Offer sent! The founder has been notified by email.');
          this.router.navigate(['/dashboard/investments']);
        },
        error: (err) => {
          this.toast.error(errorMessage(err));
          this.submitting.set(false);
        },
      });
      return;
    }

    this.investments.checkout(campaign.id, this.amount, type).subscribe({
      next: ({ url }) => (window.location.href = url),
      error: (err) => {
        this.toast.error(errorMessage(err));
        this.submitting.set(false);
      },
    });
  }
}
