import { act } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import type * as ZustandExportedTypes from "zustand";

export * from "zustand";

const { create: actualCreate, createStore: actualCreateStore } =
  await vi.importActual<typeof ZustandExportedTypes>("zustand");

/** Reset functions for every store created while the mock is active. */
export const storeResetFns = new Set<() => void>();

const createUncurried = <T>(stateCreator: ZustandExportedTypes.StateCreator<T>) => {
  const store = actualCreate(stateCreator);
  const initialState = store.getInitialState();

  storeResetFns.add(() => {
    store.setState(initialState, true);
  });

  return store;
};

// Support both `create(stateCreator)` and curried `create<T>()(stateCreator)`.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- mirrors Zustand's published Vitest mock for create overloads
export const create = (<T>(stateCreator: ZustandExportedTypes.StateCreator<T>) =>
  typeof stateCreator === "function"
    ? createUncurried(stateCreator)
    : createUncurried) as typeof ZustandExportedTypes.create;

const createStoreUncurried = <T>(stateCreator: ZustandExportedTypes.StateCreator<T>) => {
  const store = actualCreateStore(stateCreator);
  const initialState = store.getInitialState();

  storeResetFns.add(() => {
    store.setState(initialState, true);
  });

  return store;
};

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- mirrors Zustand's published Vitest mock for createStore overloads
export const createStore = (<T>(stateCreator: ZustandExportedTypes.StateCreator<T>) =>
  typeof stateCreator === "function"
    ? createStoreUncurried(stateCreator)
    : createStoreUncurried) as typeof ZustandExportedTypes.createStore;

afterEach(() => {
  act(() => {
    for (const resetFn of storeResetFns) {
      resetFn();
    }
  });
});
