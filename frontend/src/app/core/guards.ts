import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Role } from './models';

export const authGuard: CanActivateFn = (_route, state) =>
  inject(AuthService).isLoggedIn() ||
  inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });

export const guestGuard: CanActivateFn = () =>
  !inject(AuthService).isLoggedIn() || inject(Router).createUrlTree(['/dashboard']);

export const roleGuard =
  (...roles: Role[]): CanActivateFn =>
  () => {
    const role = inject(AuthService).role();
    return (role !== null && roles.includes(role)) || inject(Router).createUrlTree(['/dashboard']);
  };
