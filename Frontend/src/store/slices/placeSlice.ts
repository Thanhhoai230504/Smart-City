import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { placeApi } from '../../api/placeApi';
import { Place } from '../../types';
import { getApiErrorMessage } from '../../utils/apiError';

interface PlaceState {
  places: Place[];
  loading: boolean;
  error: string | null;
}

const initialState: PlaceState = { places: [], loading: false, error: null };

export const fetchPlaces = createAsyncThunk('places/fetchAll', async (params: Record<string, string> | undefined, { rejectWithValue }) => {
  try {
    const { data } = await placeApi.getPlaces(params);
    return data.data;
  } catch (err: unknown) {
    return rejectWithValue(getApiErrorMessage(err, 'Không tải được danh sách địa điểm.'));
  }
});

const placeSlice = createSlice({
  name: 'places',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPlaces.pending, (state) => { state.loading = true; })
      .addCase(fetchPlaces.fulfilled, (state, action) => {
        state.loading = false;
        state.places = action.payload.places;
      })
      .addCase(fetchPlaces.rejected, (state, action) => { state.loading = false; state.error = action.payload as string; });
  },
});

export default placeSlice.reducer;
