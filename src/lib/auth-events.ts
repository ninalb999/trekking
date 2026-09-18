export type AuthScreen =
  | 'home'
  | 'login'
  | 'register'
  | 'routes'
  | 'record'
  | 'point'
  | 'finish'
  | 'detail';

export function screenAfterAuthEvent(
  event: string,
  hasSession: boolean,
  currentScreen: AuthScreen,
): AuthScreen {
  if (event === 'SIGNED_OUT') return 'login';
  if (
    hasSession
    && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')
    && (currentScreen === 'login' || currentScreen === 'register')
  ) return 'home';
  return currentScreen;
}
