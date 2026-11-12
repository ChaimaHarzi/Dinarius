import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InvestmentService } from '../../../core/data.service';
import { errorMessage, fundingLabel } from '../../../core/format';
import { Investment, InvestmentStatus, Page } from '../../../core/models';
import { ToastService } from '../../../core/toast.service';
import { EmptyStateComponent, ModalComponent, PaginationComponent, SpinnerComponent, StatusBadgeComponent } from '../../../shared/ui';

type Decision = { investment: Investment; decision: 'accept' | 'decline' };

@Component({
  selector: 'app-requests',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    CurrencyPipe,
    DatePipe,
    EmptyStateComponent,
    ModalComponent,
    PaginationComponent,
    SpinnerComponent,
    StatusBadgeComponent,
  ],
  template: `
    <h1 class="text-2xl font-bold sm:text-3xl">Funding requests</h1>
    <p class="mt-1 text-stone-600">Equity and loan offers need your answer before the investor can pay.</p>

    <div class="mt-6 mb-4 flex flex-wrap gap-2">
      @for (tab of tabs; track tab.value) {
        <button class="rounded-full px-3.5 py-1.5 text-sm font-semibold transition"
                [class]="status() === tab.value ? 'bg-ink text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50'"
                (click)="setStatus(tab.value)">{{ tab.label }}</button>
      }
    </div>

    @if (page() === undefined) { <app-spinner /> }
    @else if (!page()?.items?.length) {
      <div class="card"><app-empty-state icon="inbox" title="Nothing here yet" text="Offers and contributions to your campaigns will appear here." /></div>
    } @else {
      <div class="space-y-3">
        @for (inv of page()!.items; track inv.id) {
          <article class="card p-5">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div class="min-w-0">
                <p class="font-semibold text-ink">
                  {{ inv.investor ? inv.investor.firstName + ' ' + inv.investor.lastName : 'Former user' }}
                  <span class="font-normal text-stone-500">offers</span>
                  {{ inv.amount | currency: 'USD' : 'symbol' : '1.0-0' }}
                  <span class="font-normal text-stone-500">as {{ label(inv.type).toLowerCase() }}</span>
                </p>
                <p class="mt-0.5 text-sm text-stone-500">
                  <a [routerLink]="['/campaigns', inv.campaign.id]" class="hover:underline">{{ inv.campaign.title }}</a> ·
                  {{ inv.createdAt | date: 'medium' }}
                  @if (inv.investor?.email) { · <a [href]="'mailto:' + inv.investor!.email" class="text-brand-700 hover:underline">{{ inv.investor!.email }}</a> }
                </p>
              </div>
              <app-status-badge kind="investment" [status]="inv.status" />
            </div>
            @if (inv.message) {
              <blockquote class="mt-3 rounded-lg border-l-4 border-stone-200 bg-stone-50 px-4 py-2 text-sm text-stone-700">{{ inv.message }}</blockquote>
            }
            @if (inv.responseNote) { <p class="mt-2 text-xs text-stone-500">Your note: {{ inv.responseNote }}</p> }
            @if (inv.status === 'requested') {
              <div class="mt-4 flex gap-2">
                <button class="btn btn-primary btn-sm" (click)="open(inv, 'accept')">Accept</button>
                <button class="btn btn-secondary btn-sm" (click)="open(inv, 'decline')">Decline</button>
              </div>
            }
          </article>
        }
      </div>
      <app-pagination [page]="page()!.page" [pages]="page()!.pages" [total]="page()!.total" (changed)="load($event)" />
    }

    <app-modal [open]="pending() !== null" [title]="pending()?.decision === 'accept' ? 'Accept this offer?' : 'Decline this offer?'" (closed)="pending.set(null)">
      <p class="text-sm text-stone-600">
        @if (pending()?.decision === 'accept') { The investor will be asked to complete the payment. }
        @else { The investor will be notified that you declined. }
      </p>
      <label class="mt-4 block">
        <span class="label">Note to the investor <span class="font-normal text-stone-400">(optional)</span></span>
        <textarea class="input" rows="3" maxlength="500" [(ngModel)]="note"></textarea>
      </label>
      <div class="mt-6 flex justify-end gap-2">
        <button class="btn btn-secondary" (click)="pending.set(null)">Cancel</button>
        <button class="btn" [class]="pending()?.decision === 'accept' ? 'btn-primary' : 'btn-danger'" [disabled]="busy()" (click)="confirm()">
          {{ pending()?.decision === 'accept' ? 'Accept' : 'Decline' }}
        </button>
      </div>
    </app-modal>
  `,
})
export class RequestsComponent implements OnInit {
  private readonly investments = inject(InvestmentService);
  private readonly toast = inject(ToastService);

  protected readonly page = signal<Page<Investment> | null | undefined>(undefined);
  protected readonly status = signal<InvestmentStatus | ''>('requested');
  protected readonly pending = signal<Decision | null>(null);
  protected readonly busy = signal(false);
  protected readonly label = fundingLabel;
  protected note = '';
  protected readonly tabs: { value: InvestmentStatus | ''; label: string }[] = [
    { value: 'requested', label: 'To answer' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'paid', label: 'Received payments' },
    { value: '', label: 'All' },
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
    this.investments.received({ page, status: this.status() }).subscribe({
      next: (result) => this.page.set(result),
      error: (err) => {
        this.page.set(null);
        this.toast.error(errorMessage(err));
      },
    });
  }

  protected open(investment: Investment, decision: 'accept' | 'decline') {
    this.note = '';
    this.pending.set({ investment, decision });
  }

  protected confirm() {
    const pending = this.pending();
    if (!pending) return;
    this.busy.set(true);
    this.investments.respond(pending.investment.id, pending.decision, this.note.trim()).subscribe({
      next: () => {
        this.toast.success(pending.decision === 'accept' ? 'Offer accepted. The investor has been notified.' : 'Offer declined.');
        this.pending.set(null);
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
