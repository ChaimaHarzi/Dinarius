import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../core/toast.service';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-toasts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:left-auto" aria-live="polite">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-white p-4 text-sm shadow-lg"
             [class.border-brand-200]="toast.kind === 'success'"
             [class.border-red-200]="toast.kind === 'error'"
             [class.border-stone-200]="toast.kind === 'info'">
          <app-icon [name]="toast.kind === 'success' ? 'check' : toast.kind === 'error' ? 'alert' : 'info'"
                    class="mt-0.5 size-5"
                    [class.text-brand-600]="toast.kind === 'success'"
                    [class.text-red-600]="toast.kind === 'error'"
                    [class.text-sky-600]="toast.kind === 'info'" />
          <p class="flex-1 text-stone-700">{{ toast.message }}</p>
          <button class="text-stone-400 hover:text-stone-600" (click)="toasts.dismiss(toast.id)" aria-label="Dismiss">
            <app-icon name="x" class="size-4" />
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastsComponent {
  protected readonly toasts = inject(ToastService);
}
