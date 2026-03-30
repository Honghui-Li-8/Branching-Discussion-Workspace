import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import appShellReducer from './slices/appShellSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    appShell: appShellReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
