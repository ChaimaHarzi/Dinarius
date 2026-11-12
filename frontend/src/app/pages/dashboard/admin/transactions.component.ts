import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InvestmentService } from '../../../core/data.service';
import { FUNDING_TYPES, INVESTMENT_STATUS, errorMessage, fundingLabel } from '../../../core/format';
import { FundingType, Investment, InvestmentStatus, Page } from '../../../core/models';
import { ToastService } from '../../../core/toast.service';
import { EmptyStateComponent, PaginationComponent, SpinnerComponent, StatusBadgeComponent } from '../../../shared/ui';

@Component({
  selector: 'app-transactions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, CurrencyPipe, DatePipe, EmptyStateComponent, PaginationComponent, SpinnerComponent, StatusBadgeComponent],
  template: `
    <h1 class="text-2xl font-bold sm:text-3xl">Transactions</h1>
    <p class="mt-1 text-stone-600">Every contribution and offer made on the platform.</p>

    <div class="card mt-6">
      <div class="grid gap-3 border-b border-stone-100 p-4 sm:grid-cols-2 lg:w-1/2">
        <select class="input" aria-label="Status" [(ngModel)]="status" (ngModelChange)="load(1)">
          <option value="">All statuses</option>
          @for (s of statuses; track s.value) { <option [value]="s.value">{{ s.label }}</option> }
        </select>
        <select class="input" aria-label="Type" [(ngModel)]="type" (ngModelChange)="load(1)">
          <option value="">All types</option>
          @for (t of types; track t.value) { <option [value]="t.value">{{ t.label }}</option> }
        </select>
      </div>

      @if (page() === undefined) { <app-spinner /> }
      @else if (!page()?.items?.length) { <app-empty-state icon="receipt" title="No transaction found" /> }
      @else {
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Date</th><th>Investor</th><th>Campaign</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              @for (inv of page()!.items; track inv.id) {
                <tr>
                  <td class="whitespace-nowrap text-stone-600">{{ (inv.paidAt ?? inv.createdAt) | date: 'mediumDate' }}</td>
                  <td>
                    <p class="font-medium text-ink">{{ inv.investor ? inv.investor.firstName + ' ' + inv.investor.lastName : 'Deleted user' }}</p>
                    <p class="text-xs text-stone-500">{{ inv.investor?.email }}</p>
                  </td>
                  <td><a [routerLink]="['/campaigns', inv.campaign.id]" class="font-medium hover:text-brand-700">{{ inv.campaign.title }}</a></td>
                  <td>{{ label(inv.type) }}</td>
                  <td class="font-semibold">{{ inv.amount | currency: 'USD' : 'symbol' : '1.0-0' }}</td>
                  <td><app-status-badge kind="investment" [status]="inv.status" /></td>
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
export class TransactionsComponent implements OnInit {
  private readonly investments = inject(InvestmentService);
  private readonly toast = inject(ToastService);

  protected readonly page = signal<Page<Investment> | null | undefined>(undefined);
  protected readonly label = fundingLabel;
  protected readonly types = FUNDING_TYPES;
  protected readonly statuses = Object.entries(INVESTMENT_STATUS).map(([value, meta]) => ({ value, label: meta.label }));
  protected status: InvestmentStatus | '' = '';
  protected type: FundingType | '' = '';

  ngOnInit() {
    this.load(1);
  }

  protected load(page: number) {
    this.investments.all({ page, limit: 15, status: this.status, type: this.type }).subscribe({
      next: (result) => this.page.set(result),
      error: (err) => {
        this.page.set(null);
        this.toast.error(errorMessage(err));
      },
    });
  }
}
