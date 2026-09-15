import { combineReducers, configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import appShellReducer from './slices/appShellSlice'

const rootReducer = combineReducers({
  auth: authReducer,
  appShell: appShellReducer,
})

/** Derived from the reducer map, so adding a slice cannot silently drift the type. */
export type RootState = ReturnType<typeof rootReducer>

/**
 * Store factory. The app uses the singleton below; tests build an isolated
 * store per render (A06's route-level seam) with a preloaded auth state.
 */
export const createAppStore = (preloadedState?: Partial<RootState>) =>
  // combineReducers fills any slice a partial state omits from that slice's
  // initial state, so a partial is valid at runtime; the cast only bridges
  // RTK's stricter static type.
  configureStore({ reducer: rootReducer, preloadedState: preloadedState as RootState | undefined })

export const store = createAppStore()

export type AppDispatch = typeof store.dispatch
