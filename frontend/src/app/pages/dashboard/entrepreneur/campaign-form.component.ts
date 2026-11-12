import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CampaignService, UploadService } from '../../../core/data.service';
import { CATEGORIES, FUNDING_TYPES, categoryLabel, errorMessage, fundingLabel, mediaUrl } from '../../../core/format';
import { Campaign, CampaignInput, Category, FundingType } from '../../../core/models';
import { ToastService } from '../../../core/toast.service';
import { IconComponent } from '../../../shared/icon.component';
import { ImgFallbackDirective, SpinnerComponent } from '../../../shared/ui';

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

function datesValidator(group: AbstractControl): ValidationErrors | null {
  const { startDate, endDate } = group.value as { startDate: string; endDate: string };
  if (!startDate || !endDate) return null;
  if (endDate <= startDate) return { dateOrder: true };
  if (endDate <= today()) return { endInPast: true };
  return null;
}

const STEPS = ['Basics', 'Story & media', 'Funding', 'Review'] as const;

@Component({
  selector: 'app-campaign-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, CurrencyPipe, DatePipe, IconComponent, SpinnerComponent, ImgFallbackDirective],
  template: `
    <a routerLink="/dashboard/campaigns" class="inline-flex items-center gap-1 text-sm font-medium text-stone-500 hover:text-ink">
      <app-icon name="arrow-left" class="size-4" /> My campaigns
    </a>
    <h1 class="mt-3 text-2xl font-bold sm:text-3xl">{{ id() ? 'Edit campaign' : 'New campaign' }}</h1>

    @if (loading()) { <app-spinner /> }
    @else {
      @if (existing(); as c) {
        @if (c.status === 'active' || c.status === 'rejected') {
          <div class="mt-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <app-icon name="info" class="size-5 shrink-0" />
            Saving changes sends the campaign back to review{{ c.status === 'active' ? ': it will be hidden until an administrator approves it again.' : '.' }}
          </div>
        }
      }

      <!-- Stepper -->
      <ol class="mt-8 grid grid-cols-4 gap-2">
        @for (label of steps; track label; let i = $index) {
          <li>
            <button type="button" class="w-full text-left" (click)="goTo(i)" [disabled]="i > maxReachable()">
              <span class="block h-1.5 rounded-full" [class]="i <= step() ? 'bg-brand-600' : 'bg-stone-200'"></span>
              <span class="mt-2 hidden text-xs font-semibold sm:block" [class]="i === step() ? 'text-brand-700' : 'text-stone-500'">{{ i + 1 }}. {{ label }}</span>
            </button>
          </li>
        }
      </ol>

      <form [formGroup]="form" (ngSubmit)="save()" class="card mt-6 p-6 sm:p-8" novalidate>
        @switch (step()) {
          @case (0) {
            <div formGroupName="basics" class="grid gap-5 sm:grid-cols-2">
              <label class="block sm:col-span-2">
                <span class="label">Title</span>
                <input class="input" formControlName="title" maxlength="120" placeholder="e.g. SunDrip: solar irrigation for small farms" />
                @if (invalid('basics.title')) { <p class="field-error">Between 5 and 120 characters.</p> }
              </label>
              <label class="block sm:col-span-2">
                <span class="label">Short summary</span>
                <input class="input" formControlName="summary" maxlength="200" placeholder="One sentence that makes people want to know more" />
                @if (invalid('basics.summary')) { <p class="field-error">Between 10 and 200 characters.</p> }
              </label>
              <label class="block">
                <span class="label">Category</span>
                <select class="input" formControlName="category">
                  @for (c of categories; track c.value) { <option [value]="c.value">{{ c.label }}</option> }
                </select>
              </label>
              <div class="grid grid-cols-[1fr_8rem] gap-3">
                <label class="block">
                  <span class="label">Country</span>
                  <input class="input" formControlName="country" />
                </label>
                <label class="block">
                  <span class="label">Postcode</span>
                  <input class="input" formControlName="postalCode" maxlength="12" />
                </label>
              </div>
            </div>
          }
          @case (1) {
            <div formGroupName="story" class="space-y-5">
              <label class="block">
                <span class="label">Describe your project</span>
                <textarea class="input min-h-56" formControlName="description" maxlength="10000"
                          placeholder="What problem do you solve? Who is behind the project? How will the money be used?"></textarea>
                <p class="mt-1 text-xs" [class]="invalid('story.description') ? 'text-red-600' : 'text-stone-500'">
                  {{ form.controls.story.controls.description.value.length }} / 10,000 characters · minimum 50
                </p>
              </label>
              <div>
                <span class="label">Cover image</span>
                <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div class="aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-linear-to-br from-brand-100 to-brand-300 sm:w-64">
                    @if (coverPreview()) { <img appFallback [src]="coverPreview()" alt="Cover preview" class="size-full object-cover" /> }
                  </div>
                  <div class="flex-1 space-y-2">
                    <label class="btn btn-secondary cursor-pointer">
                      <app-icon name="upload" class="size-4" /> {{ uploading() ? 'Uploading…' : 'Upload an image' }}
                      <input type="file" accept="image/png,image/jpeg,image/webp" class="sr-only" (change)="upload($event)" [disabled]="uploading()" />
                    </label>
                    <p class="text-xs text-stone-500">JPG, PNG or WEBP, 3 MB max. Or paste an image URL:</p>
                    <input class="input" formControlName="coverImage" placeholder="https://…" />
                  </div>
                </div>
              </div>
            </div>
          }
          @case (2) {
            <div formGroupName="funding" class="space-y-6">
              <div class="grid gap-5 sm:grid-cols-3">
                <label class="block">
                  <span class="label">Funding goal (USD)</span>
                  <input class="input" type="number" min="1" formControlName="goalAmount" />
                  @if (invalid('funding.goalAmount')) { <p class="field-error">Enter a positive amount.</p> }
                </label>
                <label class="block">
                  <span class="label">Start date</span>
                  <input class="input" type="date" formControlName="startDate" />
                </label>
                <label class="block">
                  <span class="label">End date</span>
                  <input class="input" type="date" formControlName="endDate" [min]="today" />
                </label>
              </div>
              @if (form.controls.funding.errors?.['dateOrder']) { <p class="field-error">The end date must be after the start date.</p> }
              @if (form.controls.funding.errors?.['endInPast']) { <p class="field-error">The end date must be in the future.</p> }

              <fieldset>
                <legend class="label">Funding models you accept</legend>
                <div class="grid gap-3 sm:grid-cols-2">
                  @for (type of fundingTypes; track type.value) {
                    <label class="flex cursor-pointer gap-3 rounded-xl border p-4 transition"
                           [class]="hasType(type.value) ? 'border-brand-500 bg-brand-50/60' : 'border-stone-200 hover:border-stone-300'">
                      <input type="checkbox" class="mt-0.5 size-4 accent-brand-600" [checked]="hasType(type.value)" (change)="toggleType(type.value)" />
                      <span><span class="block text-sm font-semibold text-ink">{{ type.label }}</span>
                        <span class="text-xs text-stone-500">{{ type.hint }}</span></span>
                    </label>
                  }
                </div>
                @if (invalid('funding.fundingTypes')) { <p class="field-error">Choose at least one funding model.</p> }
              </fieldset>

              @if (hasType('equity') || hasType('loan') || hasType('reward')) {
                <div class="grid gap-5 sm:grid-cols-2">
                  @if (hasType('equity')) {
                    <label class="block"><span class="label">Equity offered (%)</span>
                      <input class="input" type="number" min="0.1" max="100" step="0.1" formControlName="equityPercentage" /></label>
                  }
                  @if (hasType('loan')) {
                    <label class="block"><span class="label">Annual interest rate (%)</span>
                      <input class="input" type="number" min="0" max="50" step="0.1" formControlName="loanInterestRate" /></label>
                  }
                  @if (hasType('reward')) {
                    <label class="block sm:col-span-2"><span class="label">What do backers receive?</span>
                      <input class="input" formControlName="rewardDescription" maxlength="500" placeholder="e.g. The first product off the line, shipped worldwide" /></label>
                  }
                </div>
              }
            </div>
          }
          @case (3) {
            @let v = form.getRawValue();
            <div class="grid gap-8 md:grid-cols-[16rem_1fr]">
              <div class="aspect-video overflow-hidden rounded-xl bg-linear-to-br from-brand-100 to-brand-300 md:aspect-square">
                @if (coverPreview()) { <img appFallback [src]="coverPreview()" alt="" class="size-full object-cover" /> }
              </div>
              <div>
                <p class="text-sm font-semibold text-brand-700">{{ label(v.basics.category) }} · {{ v.basics.country }}</p>
                <h2 class="mt-1 text-xl font-bold">{{ v.basics.title }}</h2>
                <p class="mt-1 text-stone-600">{{ v.basics.summary }}</p>
                <dl class="mt-5 grid grid-cols-2 gap-4 text-sm">
                  <div><dt class="text-stone-500">Goal</dt><dd class="font-semibold">{{ v.funding.goalAmount | currency: 'USD' : 'symbol' : '1.0-0' }}</dd></div>
                  <div><dt class="text-stone-500">Dates</dt><dd class="font-semibold">{{ v.funding.startDate | date: 'mediumDate' }} → {{ v.funding.endDate | date: 'mediumDate' }}</dd></div>
                  <div class="col-span-2"><dt class="text-stone-500">Funding models</dt>
                    <dd class="mt-1 flex flex-wrap gap-1.5">@for (t of v.funding.fundingTypes; track t) { <span class="rounded bg-stone-100 px-2 py-0.5 text-xs font-semibold">{{ funding(t) }}</span> }</dd></div>
                </dl>
                <p class="mt-5 line-clamp-4 text-sm whitespace-pre-line text-stone-600">{{ v.story.description }}</p>
              </div>
            </div>
          }
        }

        <div class="mt-8 flex items-center justify-between border-t border-stone-100 pt-6">
          <button type="button" class="btn btn-secondary" (click)="back()" [disabled]="step() === 0">Back</button>
          @if (step() < steps.length - 1) {
            <button type="button" class="btn btn-primary" (click)="next()">Continue <app-icon name="arrow-right" class="size-4" /></button>
          } @else {
            <button type="submit" class="btn btn-primary" [disabled]="saving()">{{ saving() ? 'Saving…' : id() ? 'Save and submit for review' : 'Submit for review' }}</button>
          }
        </div>
      </form>
    }
  `,
})
export class CampaignFormComponent implements OnInit {
  /** Route parameter, present when editing. */
  readonly id = input<string>();

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly campaigns = inject(CampaignService);
  private readonly uploads = inject(UploadService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly steps = STEPS;
  protected readonly categories = CATEGORIES;
  protected readonly fundingTypes = FUNDING_TYPES;
  protected readonly label = categoryLabel;
  protected readonly funding = fundingLabel;
  protected readonly today = today();

  protected readonly step = signal(0);
  protected readonly maxReachable = signal(0);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  protected readonly existing = signal<Campaign | null>(null);

  protected readonly form = this.fb.group({
    basics: this.fb.group({
      title: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(120)]],
      summary: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(200)]],
      category: ['technology' as Category, Validators.required],
      country: ['Tunisia', [Validators.required, Validators.minLength(2)]],
      postalCode: [''],
    }),
    story: this.fb.group({
      description: ['', [Validators.required, Validators.minLength(50), Validators.maxLength(10000)]],
      coverImage: [''],
    }),
    funding: this.fb.group(
      {
        goalAmount: [5000, [Validators.required, Validators.min(1)]],
        startDate: [today(), Validators.required],
        endDate: [inDays(60), Validators.required],
        fundingTypes: [['donation'] as FundingType[], Validators.required],
        equityPercentage: [null as number | null],
        loanInterestRate: [null as number | null],
        rewardDescription: [''],
      },
      { validators: datesValidator },
    ),
  });

  private readonly groups = [this.form.controls.basics, this.form.controls.story, this.form.controls.funding];
  private readonly coverValue = toSignal(this.form.controls.story.controls.coverImage.valueChanges, { initialValue: '' });
  protected readonly coverPreview = computed(() => mediaUrl(this.coverValue()));

  ngOnInit() {
    const id = this.id();
    if (!id) return;
    this.loading.set(true);
    this.campaigns.get(id).subscribe({
      next: (c) => {
        this.existing.set(c);
        this.form.setValue({
          basics: { title: c.title, summary: c.summary, category: c.category, country: c.country, postalCode: c.postalCode ?? '' },
          story: { description: c.description, coverImage: c.coverImage ?? '' },
          funding: {
            goalAmount: c.goalAmount,
            startDate: c.startDate.slice(0, 10),
            endDate: c.endDate.slice(0, 10),
            fundingTypes: c.fundingTypes,
            equityPercentage: c.equityPercentage ?? null,
            loanInterestRate: c.loanInterestRate ?? null,
            rewardDescription: c.rewardDescription ?? '',
          },
        });
        this.maxReachable.set(STEPS.length - 1);
        this.loading.set(false);
      },
      error: (err) => {
        this.toast.error(errorMessage(err));
        this.router.navigate(['/dashboard/campaigns']);
      },
    });
  }

  protected invalid(path: string) {
    const control = this.form.get(path);
    return !!control && control.invalid && control.touched;
  }

  protected hasType(type: FundingType) {
    return this.form.controls.funding.controls.fundingTypes.value.includes(type);
  }

  protected toggleType(type: FundingType) {
    const control = this.form.controls.funding.controls.fundingTypes;
    const current = control.value;
    control.setValue(current.includes(type) ? current.filter((t) => t !== type) : [...current, type]);
    control.markAsTouched();
    if (control.value.length === 0) control.setErrors({ required: true });
  }

  protected upload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading.set(true);
    this.uploads.image(file).subscribe({
      next: (url) => {
        this.form.controls.story.controls.coverImage.setValue(url);
        this.uploading.set(false);
      },
      error: (err) => {
        this.toast.error(errorMessage(err));
        this.uploading.set(false);
      },
    });
  }

  protected next() {
    const group = this.groups[this.step()];
    if (group && group.invalid) {
      group.markAllAsTouched();
      return;
    }
    this.step.update((s) => s + 1);
    this.maxReachable.update((m) => Math.max(m, this.step()));
  }

  protected back() {
    this.step.update((s) => Math.max(0, s - 1));
  }

  protected goTo(index: number) {
    if (index <= this.maxReachable()) this.step.set(index);
  }

  protected save() {
    const firstInvalid = this.groups.findIndex((g) => g.invalid);
    if (firstInvalid !== -1) {
      this.groups[firstInvalid].markAllAsTouched();
      this.step.set(firstInvalid);
      return;
    }

    const { basics, story, funding } = this.form.getRawValue();
    const types = funding.fundingTypes;
    const body: Partial<CampaignInput> = {
      ...basics,
      ...story,
      goalAmount: Number(funding.goalAmount),
      startDate: funding.startDate,
      endDate: funding.endDate,
      fundingTypes: types,
      ...(types.includes('equity') && funding.equityPercentage != null && { equityPercentage: Number(funding.equityPercentage) }),
      ...(types.includes('loan') && funding.loanInterestRate != null && { loanInterestRate: Number(funding.loanInterestRate) }),
      ...(types.includes('reward') && funding.rewardDescription && { rewardDescription: funding.rewardDescription }),
    };

    this.saving.set(true);
    const id = this.id();
    const request = id ? this.campaigns.update(id, body) : this.campaigns.create(body);
    request.subscribe({
      next: () => {
        this.toast.success(id ? 'Changes saved and sent for review.' : 'Campaign submitted! We will review it shortly.');
        this.router.navigate(['/dashboard/campaigns']);
      },
      error: (err) => {
        this.toast.error(errorMessage(err));
        this.saving.set(false);
      },
    });
  }
}
