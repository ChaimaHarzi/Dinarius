import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InvestmentService } from '../../../core/data.service';
import { errorMessage, fundingLabel } from '../../../core/format';
import { Investment, InvestmentStatus, Page } from '../../../core/models';
import { ToastService } from '../../../core/toast.service';
import { EmptyStateComponent, PaginationComponent, SpinnerComponent, StatusBadgeComponent } from '../../../shared/ui';

@Component({
  selector: 'app-my-investments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CurrencyPipe, DatePipe, EmptyStateComponent, PaginationComponent, SpinnerComponent, StatusBadgeComponent],
  template: `
    <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold sm:text-3xl">My investments</h1>
        <p class="mt-1 text-stone-600">Payments, pending offers and their answers.</p>
      </div>
      <a routerLink="/campaigns" class="btn btn-primary">Find a project</a>
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
        <app-empty-state icon="wallet" title="No investment here" text="Back a campaign to see it appear in this list.">
          <a routerLink="/campaigns" class="btn btn-primary">Explore campaigns</a>
        </app-empty-state>
      } @else {
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Campaign</th><th>Type</th><th>Amount</th><th>Status</th><th>Date</th><th class="text-right">Actions</th></tr></thead>
            <tbody>
              @for (inv of page()!.items; track inv.id) {
                <tr>
                  <td>
                    <a [routerLink]="['/campaigns', inv.campaign.id]" class="font-semibold text-ink hover:text-brand-700">{{ inv.campaign.title }}</a>
                    @if (inv.responseNote) { <p class="mt-0.5 max-w-xs text-xs text-stone-500">Founder: “{{ inv.responseNote }}”</p> }
                  </td>
                  <td>{{ label(inv.type) }}</td>
                  <td class="font-semibold">{{ inv.amount | currency: 'USD' : 'symbol' : '1.0-0' }}</td>
                  <td><app-status-badge kind="investment" [status]="inv.status" /></td>
                  <td class="whitespace-nowrap text-stone-600">{{ (inv.paidAt ?? inv.createdAt) | date: 'mediumDate' }}</td>
                  <td>
                    <div class="flex justify-end gap-2">
                      @if (inv.status === 'accepted' || inv.status === 'pending') {
                        <button class="btn btn-primary btn-sm" [disabled]="busyId() === inv.id" (click)="pay(inv)">Pay now</button>
                      }
                      @if (inv.status === 'requested' || inv.status === 'accepted' || inv.status === 'pending') {
                        <button class="btn btn-ghost btn-sm text-red-600" [disabled]="busyId() === inv.id" (click)="cancel(inv)">Cancel</button>
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
  `,
})
export class MyInvestmentsComponent implements OnInit {
  private readonly investments = inject(InvestmentService);
  private readonly toast = inject(ToastService);

  protected readonly page = signal<Page<Investment> | null | undefined>(undefined);
  protected readonly status = signal<InvestmentStatus | ''>('');
  protected readonly busyId = signal<string | null>(null);
  protected readonly label = fundingLabel;
  protected readonly tabs: { value: InvestmentStatus | ''; label: string }[] = [
    { value: '', label: 'All' },
    { value: 'paid', label: 'Paid' },
    { value: 'requested', label: 'Awaiting answer' },
    { value: 'accepted', label: 'To pay' },
  ];

  ngOnInit() {
    this.load(1);
  }

  protected setStatus(status: InvestmentStatus | '') {
    this.status.set(status);
    this.load(1);
  }

  protected load(page: number) {
    this.page.set(undefined);
    this.investments.mine({ page, status: this.status() }).subscribe({
      next: (result) => this.page.set(result),
      error: (err) => {
        this.page.set(null);
        this.toast.error(errorMessage(err));
      },
    });
  }

  protected pay(inv: Investment) {
    this.busyId.set(inv.id);
    this.investments.pay(inv.id).subscribe({
      next: ({ url }) => (window.location.href = url),
      error: (err) => {
        this.toast.error(errorMessage(err));
        this.busyId.set(null);
      },
    });
  }

  protected cancel(inv: Investment) {
    this.busyId.set(inv.id);
    this.investments.cancel(inv.id).subscribe({
      next: () => {
        this.toast.success('Investment cancelled.');
        this.busyId.set(null);
        this.load(this.page()?.page ?? 1);
      },
      error: (err) => {
        this.toast.error(errorMessage(err));
        this.busyId.set(null);
      },
    });
  }
}
