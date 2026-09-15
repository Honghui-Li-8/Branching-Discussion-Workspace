import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import appShellReducer from './slices/appShellSlice'

const reducer = {
  auth: authReducer,
  appShell: appShellReducer,
}

export type RootState = {
  auth: ReturnType<typeof authReducer>
  appShell: ReturnType<typeof appShellReducer>
}

/**
 * Store factory. The app uses the singleton below; tests build an isolated
 * store per render (A06's route-level seam) with a preloaded auth state.
 */
export const createAppStore = (preloadedState?: Partial<RootState>) =>
  // combineReducers fills any slice a partial state omits from that slice's
  // initial state, so a partial is valid at runtime; the cast only bridges
  // RTK's stricter static type.
  configureStore({ reducer, preloadedState: preloadedState as RootState | undefined })

export const store = createAppStore()

export type AppDispatch = typeof store.dispatch
