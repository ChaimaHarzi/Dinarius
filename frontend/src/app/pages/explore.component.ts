import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, debounceTime, map, of, startWith, switchMap } from 'rxjs';
import { CampaignQuery, CampaignService } from '../core/data.service';
import { CATEGORIES, FUNDING_TYPES } from '../core/format';
import { Campaign, Page } from '../core/models';
import { CampaignCardComponent } from '../shared/campaign-card.component';
import { IconComponent } from '../shared/icon.component';
import { EmptyStateComponent, PaginationComponent, SpinnerComponent } from '../shared/ui';

type State = { loading: true } | { loading: false; page: Page<Campaign> | null };

@Component({
  selector: 'app-explore',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CampaignCardComponent, IconComponent, PaginationComponent, SpinnerComponent, EmptyStateComponent],
  template: `
    <div class="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">Explore campaigns</h1>
      <p class="mt-2 text-stone-600">Discover verified Tunisian projects and back the ones you believe in.</p>

      <div class="card mt-8 grid gap-3 p-4 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <label class="relative">
          <span class="sr-only">Search</span>
          <app-icon name="search" class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" />
          <input class="input pl-9" placeholder="Search a project…" [ngModel]="query().q" (ngModelChange)="patch({ q: $event })" />
        </label>
        <select class="input" aria-label="Category" [ngModel]="query().category" (ngModelChange)="patch({ category: $event })">
          <option value="">All categories</option>
          @for (c of categories; track c.value) { <option [value]="c.value">{{ c.label }}</option> }
        </select>
        <select class="input" aria-label="Funding type" [ngModel]="query().fundingType" (ngModelChange)="patch({ fundingType: $event })">
          <option value="">All funding types</option>
          @for (f of fundingTypes; track f.value) { <option [value]="f.value">{{ f.label }}</option> }
        </select>
        <select class="input" aria-label="Sort by" [ngModel]="query().sort" (ngModelChange)="patch({ sort: $event })">
          <option value="newest">Newest</option>
          <option value="endingSoon">Ending soon</option>
          <option value="mostFunded">Most funded</option>
          <option value="goal">Smallest goal</option>
        </select>
      </div>

      @let s = state();
      @if (s.loading) {
        <app-spinner />
      } @else if (s.page === null) {
        <app-empty-state icon="alert" title="Could not load campaigns" text="Check that the API is running, then refresh the page." />
      } @else if (s.page.items.length === 0) {
        <app-empty-state icon="search" title="No campaign matches your filters" text="Try another category or a shorter search.">
          <button class="btn btn-secondary" (click)="reset()">Clear filters</button>
        </app-empty-state>
      } @else {
        <div class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          @for (campaign of s.page.items; track campaign.id) { <app-campaign-card [campaign]="campaign" /> }
        </div>
        <app-pagination class="mt-4 block" [page]="s.page.page" [pages]="s.page.pages" [total]="s.page.total" (changed)="patch({ page: $event }, false)" />
      }
    </div>
  `,
})
export class ExploreComponent {
  private readonly campaigns = inject(CampaignService);
  private readonly initial: CampaignQuery = { q: '', category: '', fundingType: '', sort: 'newest', page: 1 };

  protected readonly categories = CATEGORIES;
  protected readonly fundingTypes = FUNDING_TYPES;
  protected readonly query = signal<CampaignQuery>({ ...this.initial });

  protected readonly state = toSignal(
    toObservable(this.query).pipe(
      debounceTime(250),
      switchMap((query) =>
        this.campaigns.list(query).pipe(
          map((page): State => ({ loading: false, page })),
          catchError(() => of<State>({ loading: false, page: null })),
          startWith<State>({ loading: true }),
        ),
      ),
    ),
    { initialValue: { loading: true } as State },
  );

  /** Updates filters; any filter change goes back to page 1. */
  protected patch(change: Partial<CampaignQuery>, resetPage = true) {
    this.query.update((q) => ({ ...q, ...change, ...(resetPage && { page: 1 }) }));
    if (!resetPage) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected reset() {
    this.query.set({ ...this.initial });
  }
}
