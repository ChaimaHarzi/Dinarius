import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { InvestmentService } from '../core/data.service';
import { errorMessage, fundingLabel } from '../core/format';
import { Investment } from '../core/models';
import { IconComponent } from '../shared/icon.component';
import { SpinnerComponent } from '../shared/ui';

@Component({
  selector: 'app-payment-success',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CurrencyPipe, IconComponent, SpinnerComponent],
  template: `
    <div class="mx-auto max-w-lg px-4 py-20 text-center">
      @let inv = investment();
      @if (loading()) {
        <app-spinner />
      } @else if (inv) {
        <span class="mx-auto flex size-16 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          <app-icon name="check" class="size-8" />
        </span>
        <h1 class="mt-6 text-3xl font-extrabold">Thank you!</h1>
        <p class="mt-3 text-stone-600">
          Your {{ label(inv.type).toLowerCase() }} of <strong class="text-ink">{{ inv.amount | currency: 'USD' : 'symbol' : '1.0-0' }}</strong>
          to “{{ inv.campaign.title }}” {{ inv.status === 'paid' ? 'has been received' : 'is being processed' }}.
        </p>
        <div class="mt-8 flex flex-wrap justify-center gap-3">
          <a routerLink="/dashboard/investments" class="btn btn-primary">See my investments</a>
          <a [routerLink]="['/campaigns', inv.campaign.id]" class="btn btn-secondary">Back to the campaign</a>
        </div>
      } @else {
        <h1 class="text-2xl font-bold">We could not confirm this payment</h1>
        <p class="mt-3 text-stone-600">{{ error() }}</p>
        <a routerLink="/dashboard/investments" class="btn btn-primary mt-8">Open my investments</a>
      }
    </div>
  `,
})
export class PaymentSuccessComponent implements OnInit {
  private readonly investments = inject(InvestmentService);
  private readonly params = inject(ActivatedRoute).snapshot.queryParamMap;

  protected readonly loading = signal(true);
  protected readonly investment = signal<Investment | null>(null);
  protected readonly error = signal('If you were charged, the payment will appear in your investments shortly.');
  protected readonly label = fundingLabel;

  ngOnInit() {
    const sessionId = this.params.get('session_id');
    const investmentId = this.params.get('investment');
    const request = sessionId
      ? this.investments.confirm(sessionId)
      : investmentId
        ? this.investments.get(investmentId)
        : null;

    if (!request) return this.loading.set(false);
    request.subscribe({
      next: (inv) => {
        this.investment.set(inv);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }
}
