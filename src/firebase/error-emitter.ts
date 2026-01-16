// Using 'events' package for browser compatibility
import EventEmitter from 'events';
import type { FirestorePermissionError } from './errors';

// Define the event map
type AppEvents = {
  'permission-error': (error: FirestorePermissionError) => void;
};

// Extend EventEmitter to be type-safe
class TypedEventEmitter<T extends Record<string, (...args: any[]) => void>> {
  private emitter = new EventEmitter();

  emit<E extends keyof T>(event: E, ...args: Parameters<T[E]>) {
    this.emitter.emit(event as string, ...args);
  }

  on<E extends keyof T>(event: E, listener: T[E]) {
    this.emitter.on(event as string, listener);
  }

  off<E extends keyof T>(event: E, listener: T[E]) {
    this.emitter.off(event as string, listener);
  }
}

// Singleton instance of the event emitter
export const errorEmitter = new TypedEventEmitter<AppEvents>();
