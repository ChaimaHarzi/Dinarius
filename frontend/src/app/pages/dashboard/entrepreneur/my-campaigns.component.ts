import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CampaignService } from '../../../core/data.service';
import { errorMessage, mediaUrl } from '../../../core/format';
import { Campaign, CampaignStatus, Page } from '../../../core/models';
import { ToastService } from '../../../core/toast.service';
import { IconComponent } from '../../../shared/icon.component';
import {
  EmptyStateComponent,
  ImgFallbackDirective,
  ModalComponent,
  PaginationComponent,
  ProgressComponent,
  SpinnerComponent,
  StatusBadgeComponent,
} from '../../../shared/ui';

@Component({
  selector: 'app-my-campaigns',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    CurrencyPipe,
    DatePipe,
    IconComponent,
    EmptyStateComponent,
    ModalComponent,
    PaginationComponent,
    ProgressComponent,
    SpinnerComponent,
    StatusBadgeComponent,
    ImgFallbackDirective,
  ],
  template: `
    <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold sm:text-3xl">My campaigns</h1>
        <p class="mt-1 text-stone-600">Every new or edited campaign is reviewed before going live.</p>
      </div>
      <a routerLink="/dashboard/campaigns/new" class="btn btn-primary"><app-icon name="plus" class="size-4" /> New campaign</a>
    </div>

    <div class="mb-4 flex flex-wrap gap-2">
      @for (tab of tabs; track tab.value) {
        <button class="rounded-full px-3.5 py-1.5 text-sm font-semibold transition"
                [class]="status() === tab.value ? 'bg-ink text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50'"
                (click)="setStatus(tab.value)">{{ tab.label }}</button>
      }
    </div>

    <div class="card">
      @if (page() === undefined) { <app-spinner /> }
      @else if (!page()?.items?.length) {
        <app-empty-state icon="flag" title="No campaign here" text="Create a campaign to start raising funds.">
          <a routerLink="/dashboard/campaigns/new" class="btn btn-primary">Create a campaign</a>
        </app-empty-state>
      } @else {
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Campaign</th><th>Status</th><th class="w-56">Funding</th><th>Ends</th><th class="text-right">Actions</th></tr></thead>
            <tbody>
              @for (c of page()!.items; track c.id) {
                <tr>
                  <td>
                    <div class="flex items-center gap-3">
                      <div class="size-12 shrink-0 overflow-hidden rounded-lg bg-brand-100">
                        @if (c.coverImage) { <img appFallback [src]="media(c.coverImage)" alt="" class="size-full object-cover" /> }
                      </div>
                      <div class="min-w-0">
                        <p class="max-w-xs truncate font-semibold text-ink">{{ c.title }}</p>
                        <p class="text-xs text-stone-500">{{ c.contributionsCount }} contribution(s)</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <app-status-badge [status]="c.status" />
                    @if (c.status === 'rejected' && c.rejectionReason) {
                      <p class="mt-1 max-w-[14rem] text-xs text-red-600">{{ c.rejectionReason }}</p>
                    }
                  </td>
                  <td>
                    <p class="text-xs text-stone-500"><strong class="text-ink">{{ c.raisedAmount | currency: 'USD' : 'symbol' : '1.0-0' }}</strong> / {{ c.goalAmount | currency: 'USD' : 'symbol' : '1.0-0' }}</p>
                    <app-progress class="mt-1.5 block" [value]="c.progress" />
                  </td>
                  <td class="whitespace-nowrap text-stone-600">{{ c.endDate | date: 'mediumDate' }}</td>
                  <td>
                    <div class="flex justify-end gap-1">
                      <a [routerLink]="['/campaigns', c.id]" class="btn btn-ghost p-2" title="View"><app-icon name="eye" class="size-4" /></a>
                      @if (c.status !== 'completed' && c.status !== 'cancelled') {
                        <a [routerLink]="['/dashboard/campaigns', c.id, 'edit']" class="btn btn-ghost p-2" title="Edit"><app-icon name="edit" class="size-4" /></a>
                        <button class="btn btn-ghost p-2 text-red-600 hover:bg-red-50" title="Delete" (click)="toDelete.set(c)"><app-icon name="trash" class="size-4" /></button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="px-4 pb-4"><app-pagination [page]="page()!.page" [pages]="page()!.pages" [total]="page()!.total" (changed)="load($event)" /></div>
      }
    </div>

    <app-modal [open]="toDelete() !== null" title="Delete this campaign?" (closed)="toDelete.set(null)">
      <p class="text-sm text-stone-600">
        “{{ toDelete()?.title }}” will be removed. If it already received contributions it is archived instead, and open offers are cancelled.
      </p>
      <div class="mt-6 flex justify-end gap-2">
        <button class="btn btn-secondary" (click)="toDelete.set(null)">Keep it</button>
        <button class="btn btn-danger" [disabled]="busy()" (click)="confirmDelete()">Delete</button>
      </div>
    </app-modal>
  `,
})
export class MyCampaignsComponent implements OnInit {
  private readonly campaigns = inject(CampaignService);
  private readonly toast = inject(ToastService);

  protected readonly page = signal<Page<Campaign> | null | undefined>(undefined);
  protected readonly status = signal<CampaignStatus | ''>('');
  protected readonly toDelete = signal<Campaign | null>(null);
  protected readonly busy = signal(false);
  protected readonly media = mediaUrl;
  protected readonly tabs: { value: CampaignStatus | ''; label: string }[] = [
    { value: '', label: 'All' },
    { value: 'active', label: 'Live' },
    { value: 'pending', label: 'Pending review' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'completed', label: 'Completed' },
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
    this.campaigns.mine({ page, limit: 10, status: this.status() }).subscribe({
      next: (result) => this.page.set(result),
      error: (err) => {
        this.page.set(null);
        this.toast.error(errorMessage(err));
      },
    });
  }

  protected confirmDelete() {
    const campaign = this.toDelete();
    if (!campaign) return;
    this.busy.set(true);
    this.campaigns.remove(campaign.id).subscribe({
      next: (res) => {
        this.toast.success(res?.archived ? 'Campaign archived: it had already received contributions.' : 'Campaign deleted.');
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
}
