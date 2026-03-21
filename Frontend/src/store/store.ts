import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import issueReducer from './slices/issueSlice';
import placeReducer from './slices/placeSlice';
import environmentReducer from './slices/environmentSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    issues: issueReducer,
    places: placeReducer,
    environment: environmentReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
