import { makeAutoObservable } from "mobx";

/**
 * Deliberately process-local: tokens disappear on a full page reload or when
 * the tab is closed. Do not add persistence for this store.
 */
class AuthStore {
  accessToken: string | null = null;
  refreshToken: string | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  clear() {
    this.accessToken = null;
    this.refreshToken = null;
  }
}

export const authStore = new AuthStore();
