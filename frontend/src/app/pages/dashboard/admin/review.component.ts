import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CampaignService } from '../../../core/data.service';
import { categoryLabel, errorMessage, fundingLabel, mediaUrl } from '../../../core/format';
import { Campaign, CampaignStatus, Page } from '../../../core/models';
import { ToastService } from '../../../core/toast.service';
import { IconComponent } from '../../../shared/icon.component';
import {
  EmptyStateComponent,
  ImgFallbackDirective,
  ModalComponent,
  PaginationComponent,
  SpinnerComponent,
  StatusBadgeComponent,
} from '../../../shared/ui';

@Component({
  selector: 'app-review',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    CurrencyPipe,
    DatePipe,
    IconComponent,
    EmptyStateComponent,
    ModalComponent,
    PaginationComponent,
    SpinnerComponent,
    StatusBadgeComponent,
    ImgFallbackDirective,
  ],
  template: `
    <h1 class="text-2xl font-bold sm:text-3xl">Campaign review</h1>
    <p class="mt-1 text-stone-600">Check each campaign before it becomes visible to investors.</p>

    <div class="mt-6 mb-4 flex flex-wrap gap-2">
      @for (tab of tabs; track tab.value) {
        <button class="rounded-full px-3.5 py-1.5 text-sm font-semibold transition"
                [class]="status() === tab.value ? 'bg-ink text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50'"
                (click)="setStatus(tab.value)">{{ tab.label }}</button>
      }
    </div>

    @if (page() === undefined) { <app-spinner /> }
    @else if (!page()?.items?.length) {
      <div class="card"><app-empty-state icon="shield" title="Nothing to review" text="New campaigns will appear here as soon as they are submitted." /></div>
    } @else {
      <div class="grid gap-4 lg:grid-cols-2">
        @for (c of page()!.items; track c.id) {
          <article class="card flex flex-col overflow-hidden sm:flex-row">
            <div class="aspect-video shrink-0 bg-linear-to-br from-brand-100 to-brand-300 sm:aspect-auto sm:w-40">
              @if (c.coverImage) { <img appFallback [src]="media(c.coverImage)" alt="" class="size-full object-cover" /> }
            </div>
            <div class="flex flex-1 flex-col p-5">
              <div class="flex items-start justify-between gap-3">
                <p class="text-xs font-semibold text-brand-700">{{ category(c.category) }}</p>
                <app-status-badge [status]="c.status" />
              </div>
              <h2 class="mt-1 font-bold text-ink">{{ c.title }}</h2>
              <p class="mt-1 line-clamp-2 text-sm text-stone-600">{{ c.summary }}</p>
              <p class="mt-3 text-xs text-stone-500">
                By {{ c.entrepreneur?.firstName }} {{ c.entrepreneur?.lastName }} · Goal {{ c.goalAmount | currency: 'USD' : 'symbol' : '1.0-0' }} ·
                {{ c.startDate | date: 'mediumDate' }} → {{ c.endDate | date: 'mediumDate' }}
              </p>
              <div class="mt-auto flex flex-wrap gap-2 pt-4">
                <button class="btn btn-secondary btn-sm" (click)="viewing.set(c)"><app-icon name="eye" class="size-4" /> Details</button>
                @if (c.status === 'pending') {
                  <button class="btn btn-primary btn-sm" [disabled]="busy()" (click)="approve(c)"><app-icon name="check" class="size-4" /> Approve</button>
                  <button class="btn btn-secondary btn-sm text-red-600" (click)="openReject(c)"><app-icon name="x" class="size-4" /> Reject</button>
                }
              </div>
            </div>
          </article>
        }
      </div>
      <app-pagination [page]="page()!.page" [pages]="page()!.pages" [total]="page()!.total" (changed)="load($event)" />
    }

    <app-modal [open]="viewing() !== null" [title]="viewing()?.title ?? ''" width="max-w-2xl" (closed)="viewing.set(null)">
      @if (viewing(); as c) {
        <p class="text-stone-600">{{ c.summary }}</p>
        <dl class="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-stone-50 p-4 text-sm">
          <div><dt class="text-stone-500">Founder</dt><dd class="font-semibold">{{ c.entrepreneur?.firstName }} {{ c.entrepreneur?.lastName }}</dd></div>
          <div><dt class="text-stone-500">Email</dt><dd class="font-semibold break-all">{{ c.entrepreneur?.email }}</dd></div>
          <div><dt class="text-stone-500">Goal</dt><dd class="font-semibold">{{ c.goalAmount | currency: 'USD' : 'symbol' : '1.0-0' }}</dd></div>
          <div><dt class="text-stone-500">Models</dt><dd class="font-semibold">{{ models(c) }}</dd></div>
        </dl>
        <p class="mt-4 text-sm leading-relaxed whitespace-pre-line text-stone-700">{{ c.description }}</p>
        <a [routerLink]="['/campaigns', c.id]" class="btn btn-secondary mt-6" (click)="viewing.set(null)">Open the public page</a>
      }
    </app-modal>

    <app-modal [open]="rejecting() !== null" title="Reject this campaign" (closed)="rejecting.set(null)">
      <p class="text-sm text-stone-600">The founder receives this explanation by email and can edit the campaign.</p>
      <label class="mt-4 block">
        <span class="label">Reason</span>
        <textarea class="input" rows="4" maxlength="500" [(ngModel)]="reason" placeholder="e.g. Please add a budget breakdown and a clearer cover image."></textarea>
      </label>
      <div class="mt-6 flex justify-end gap-2">
        <button class="btn btn-secondary" (click)="rejecting.set(null)">Cancel</button>
        <button class="btn btn-danger" [disabled]="busy() || reason.trim().length < 5" (click)="reject()">Reject</button>
      </div>
    </app-modal>
  `,
})
export class ReviewComponent implements OnInit {
  private readonly campaigns = inject(CampaignService);
  private readonly toast = inject(ToastService);

  protected readonly page = signal<Page<Campaign> | null | undefined>(undefined);
  protected readonly status = signal<CampaignStatus | ''>('pending');
  protected readonly viewing = signal<Campaign | null>(null);
  protected readonly rejecting = signal<Campaign | null>(null);
  protected readonly busy = signal(false);
  protected reason = '';
  protected readonly media = mediaUrl;
  protected readonly category = categoryLabel;
  protected readonly models = (c: Campaign) => c.fundingTypes.map(fundingLabel).join(', ');
  protected readonly tabs: { value: CampaignStatus | ''; label: string }[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'active', label: 'Live' },
    { value: 'rejected', label: 'Rejected' },
    { value: '', label: 'All' },
  ];

  ngOnInit() {
    this.load(1);
  }

  protected setStatus(status: CampaignStatus | '') {
    this.status.set(status);
    this.load(1);
  }

  protected load(page: number) {
    this.page.set(undefined);
    this.campaigns.adminList({ page, limit: 10, status: this.status(), sort: 'newest' }).subscribe({
      next: (result) => this.page.set(result),
      error: (err) => {
        this.page.set(null);
        this.toast.error(errorMessage(err));
      },
    });
  }

  protected approve(campaign: Campaign) {
    this.decide(campaign, 'approve');
  }

  protected openReject(campaign: Campaign) {
    this.reason = '';
    this.rejecting.set(campaign);
  }

  protected reject() {
    const campaign = this.rejecting();
    if (campaign) this.decide(campaign, 'reject', this.reason.trim());
  }

  private decide(campaign: Campaign, decision: 'approve' | 'reject', reason?: string) {
    this.busy.set(true);
    this.campaigns.review(campaign.id, decision, reason).subscribe({
      next: () => {
        this.toast.success(decision === 'approve' ? `“${campaign.title}” is now live.` : 'Campaign rejected. The founder has been notified.');
        this.rejecting.set(null);
        this.busy.set(false);
        this.load(this.page()?.page ?? 1);
      },
      error: (err) => {
        this.toast.error(errorMessage(err));
        this.busy.set(false);
      },
    });
  }
}
