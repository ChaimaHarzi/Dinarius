import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { SpinnerComponent } from '../../shared/ui';

/** Landing page of the Google OAuth redirect: the API puts the JWT in the URL fragment. */
@Component({
  selector: 'app-oauth-callback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpinnerComponent],
  template: `<app-spinner />`,
})
export class OAuthCallbackComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  async ngOnInit() {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
    history.replaceState(null, '', window.location.pathname);
    const ok = token ? await this.auth.acceptToken(token) : false;
    this.router.navigate(ok ? ['/dashboard'] : ['/login'], ok ? {} : { queryParams: { error: 'google' } });
  }
}
