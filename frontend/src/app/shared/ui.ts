import { DecimalPipe, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, Directive, ElementRef, HostListener, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CAMPAIGN_STATUS, INVESTMENT_STATUS, Tone } from '../core/format';
import { CampaignStatus, InvestmentStatus } from '../core/models';
import { IconComponent, IconName } from './icon.component';

const TONES: Record<Tone, string> = {
  green: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  gray: 'bg-stone-100 text-stone-600 ring-stone-500/20',
};

/** Hides an image that fails to load, so the gradient placeholder behind it shows instead of alt text. */
@Directive({ selector: 'img[appFallback]' })
export class ImgFallbackDirective {
  private readonly el = inject<ElementRef<HTMLImageElement>>(ElementRef);

  @HostListener('error')
  onError() {
    this.el.nativeElement.style.visibility = 'hidden';
  }

  @HostListener('load')
  onLoad() {
    this.el.nativeElement.style.visibility = '';
  }
}

@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <a routerLink="/" class="inline-flex items-center gap-2 font-extrabold tracking-tight text-ink" [class.text-white]="light()">
      <svg viewBox="0 0 32 32" class="size-8"><rect width="32" height="32" rx="8" fill="#039855" />
        <path d="M10 8h6.5a8 8 0 0 1 0 16H10z" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round" />
        <circle cx="16.5" cy="16" r="2.5" fill="#fff" /></svg>
      <span class="text-lg">Dinarius</span>
    </a>
  `,
})
export class LogoComponent {
  readonly light = input(false);
}

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  template: `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset" [ngClass]="classes()">{{ label() }}</span>`,
})
export class StatusBadgeComponent {
  readonly status = input.required<string>();
  readonly kind = input<'campaign' | 'investment'>('campaign');

  private readonly meta = computed(() =>
    this.kind() === 'campaign'
      ? CAMPAIGN_STATUS[this.status() as CampaignStatus]
      : INVESTMENT_STATUS[this.status() as InvestmentStatus],
  );
  protected readonly label = computed(() => this.meta()?.label ?? this.status());
  protected readonly classes = computed(() => TONES[this.meta()?.tone ?? 'gray']);
}

@Component({
  selector: 'app-stat-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="card flex items-start gap-4 p-5">
      <span class="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
        <app-icon [name]="icon()" class="size-5" />
      </span>
      <div class="min-w-0">
        <p class="text-sm font-medium text-stone-500">{{ label() }}</p>
        <p class="mt-1 text-2xl font-bold text-ink">{{ value() }}</p>
        @if (hint()) { <p class="mt-0.5 text-xs text-stone-400">{{ hint() }}</p> }
      </div>
    </div>
  `,
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number | null>();
  readonly icon = input<IconName>('trending');
  readonly hint = input<string>('');
}

@Component({
  selector: 'app-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-2 w-full overflow-hidden rounded-full bg-stone-100" role="progressbar"
         [attr.aria-valuenow]="value()" aria-valuemin="0" aria-valuemax="100">
      <div class="h-full rounded-full bg-brand-500 transition-all" [style.width.%]="clamped()"></div>
    </div>
  `,
})
export class ProgressComponent {
  readonly value = input.required<number>();
  protected readonly clamped = computed(() => Math.min(100, Math.max(0, this.value())));
}

@Component({
  selector: 'app-pagination',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, DecimalPipe],
  template: `
    @if (pages() > 1) {
      <nav class="flex items-center justify-between gap-4 pt-4 text-sm" aria-label="Pagination">
        <p class="text-stone-500">Page {{ page() }} of {{ pages() }} · {{ total() | number }} results</p>
        <div class="flex gap-2">
          <button class="btn btn-secondary btn-sm" [disabled]="page() <= 1" (click)="changed.emit(page() - 1)">
            <app-icon name="arrow-left" class="size-4" /> Previous
          </button>
          <button class="btn btn-secondary btn-sm" [disabled]="page() >= pages()" (click)="changed.emit(page() + 1)">
            Next <app-icon name="arrow-right" class="size-4" />
          </button>
        </div>
      </nav>
    }
  `,
})
export class PaginationComponent {
  readonly page = input.required<number>();
  readonly pages = input.required<number>();
  readonly total = input(0);
  readonly changed = output<number>();
}

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span class="flex size-12 items-center justify-center rounded-full bg-stone-100 text-stone-400">
        <app-icon [name]="icon()" class="size-6" />
      </span>
      <p class="mt-4 font-semibold text-ink">{{ title() }}</p>
      @if (text()) { <p class="mt-1 max-w-sm text-sm text-stone-500">{{ text() }}</p> }
      <div class="mt-5"><ng-content /></div>
    </div>
  `,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly text = input('');
  readonly icon = input<IconName>('inbox');
}

@Component({
  selector: 'app-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="flex justify-center py-16" role="status" aria-label="Loading">
    <span class="size-8 animate-spin rounded-full border-[3px] border-brand-200 border-t-brand-600"></span></div>`,
})
export class SpinnerComponent {}

@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 backdrop-blur-sm sm:items-center"
           (click)="closed.emit()">
        <div class="card max-h-[90vh] w-full overflow-y-auto p-6 shadow-xl" [class]="width()" role="dialog"
             aria-modal="true" [attr.aria-label]="title()" (click)="$event.stopPropagation()">
          <div class="mb-4 flex items-start justify-between gap-4">
            <h2 class="text-lg font-bold">{{ title() }}</h2>
            <button class="btn btn-ghost -m-2 p-2" (click)="closed.emit()" aria-label="Close">
              <app-icon name="x" class="size-5" />
            </button>
          </div>
          <ng-content />
        </div>
      </div>
    }
  `,
})
export class ModalComponent {
  readonly open = input.required<boolean>();
  readonly title = input.required<string>();
  readonly width = input('max-w-lg');
  readonly closed = output<void>();

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.open()) this.closed.emit();
  }
}
