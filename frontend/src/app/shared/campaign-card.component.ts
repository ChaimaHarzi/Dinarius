import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { categoryLabel, fundingLabel, mediaUrl } from '../core/format';
import { Campaign } from '../core/models';
import { IconComponent } from './icon.component';
import { ImgFallbackDirective, ProgressComponent } from './ui';

@Component({
  selector: 'app-campaign-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CurrencyPipe, IconComponent, ProgressComponent, ImgFallbackDirective],
  template: `
    @let c = campaign();
    <a [routerLink]="['/campaigns', c.id]"
       class="card group flex h-full flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <div class="relative aspect-video overflow-hidden bg-linear-to-br from-brand-100 to-brand-300">
        @if (cover()) {
          <img appFallback [src]="cover()" [alt]="c.title" loading="lazy"
               class="size-full object-cover transition duration-500 group-hover:scale-105" />
        } @else {
          <span class="flex size-full items-center justify-center text-5xl font-extrabold text-brand-700/40">{{ c.title[0] }}</span>
        }
        <span class="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-ink backdrop-blur">
          {{ category() }}
        </span>
      </div>
      <div class="flex flex-1 flex-col p-5">
        <h3 class="line-clamp-2 font-bold group-hover:text-brand-700">{{ c.title }}</h3>
        <p class="mt-1.5 line-clamp-2 text-sm text-stone-500">{{ c.summary }}</p>
        <div class="mt-auto pt-5">
          <app-progress [value]="c.progress" />
          <div class="mt-2.5 flex items-baseline justify-between text-sm">
            <span><strong class="text-ink">{{ c.raisedAmount | currency: 'USD' : 'symbol' : '1.0-0' }}</strong>
              <span class="text-stone-500"> of {{ c.goalAmount | currency: 'USD' : 'symbol' : '1.0-0' }}</span></span>
            <span class="font-semibold text-brand-700">{{ c.progress }}%</span>
          </div>
          <div class="mt-4 flex items-center justify-between border-t border-stone-100 pt-3 text-xs text-stone-500">
            <span class="flex gap-1.5">
              @for (type of c.fundingTypes; track type) {
                <span class="rounded bg-stone-100 px-1.5 py-0.5 font-medium text-stone-600">{{ label(type) }}</span>
              }
            </span>
            <span class="flex items-center gap-1">
              <app-icon name="clock" class="size-3.5" />
              {{ c.status === 'active' ? c.daysLeft + ' days left' : 'Closed' }}
            </span>
          </div>
        </div>
      </div>
    </a>
  `,
})
export class CampaignCardComponent {
  readonly campaign = input.required<Campaign>();
  protected readonly cover = computed(() => mediaUrl(this.campaign().coverImage));
  protected readonly category = computed(() => categoryLabel(this.campaign().category));
  protected readonly label = fundingLabel;
}
