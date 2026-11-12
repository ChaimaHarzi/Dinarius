import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LogoComponent } from '../shared/ui';

@Component({
  selector: 'app-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LogoComponent],
  template: `
    <div class="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <app-logo />
      <p class="mt-10 text-7xl font-extrabold text-brand-600">404</p>
      <h1 class="mt-4 text-2xl font-bold">This page does not exist</h1>
      <p class="mt-2 text-stone-600">The link may be broken or the page may have moved.</p>
      <a routerLink="/" class="btn btn-primary mt-8">Back to the home page</a>
    </div>
  `,
})
export class NotFoundComponent {}
