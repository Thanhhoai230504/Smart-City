import { useCallback, useEffect, useRef, useState } from 'react';
import { geoApi, GeoPrediction } from '../../api/geoApi';
import { DA_NANG_CENTER } from '../../utils/constants';
import { describeRoute } from '../../utils/mapFilters';

export type LatLngTuple = [number, number];
export type RouteEnd = 'start' | 'end';

export interface RoutePoint {
  label: string;
  /** Có toạ độ khi người dùng chọn một gợi ý, dùng vị trí của mình, hoặc điểm đến là sự cố. */
  coord: LatLngTuple | null;
  suggestions: GeoPrediction[];
}

const EMPTY: RoutePoint = { label: '', coord: null, suggestions: [] };

/**
 * Trạng thái và thao tác của bảng "Chỉ đường": gợi ý địa chỉ (chờ 400 ms sau lần gõ cuối, bỏ kết
 * quả về muộn), lấy toạ độ từ gợi ý, dùng vị trí của tôi, tìm đường. Mọi lời gọi đi qua proxy của
 * backend (`api/geoApi.ts`). Trang bản đồ chỉ đọc `path` và toạ độ hai điểm để vẽ.
 */
export const useRoutePlanner = () => {
  const [points, setPoints] = useState<Record<RouteEnd, RoutePoint>>({ start: EMPTY, end: EMPTY });
  const [path, setPath] = useState<LatLngTuple[]>([]);
  const [summary, setSummary] = useState<ReturnType<typeof describeRoute> | null>(null);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<Partial<Record<RouteEnd, ReturnType<typeof setTimeout>>>>({});
  const requestSeq = useRef<Record<RouteEnd, number>>({ start: 0, end: 0 });

  useEffect(() => () => {
    clearTimeout(timers.current.start);
    clearTimeout(timers.current.end);
  }, []);

  const patch = useCallback((which: RouteEnd, next: Partial<RoutePoint>) => {
    setPoints((current) => ({ ...current, [which]: { ...current[which], ...next } }));
  }, []);

  /** Đổi một đầu mút thì tuyến cũ không còn đúng nữa. */
  const resetRoute = useCallback(() => {
    setPath([]);
    setSummary(null);
    setError(null);
  }, []);

  const type = useCallback((which: RouteEnd, text: string) => {
    patch(which, { label: text, coord: null });
    resetRoute();
    clearTimeout(timers.current[which]);
    const seq = ++requestSeq.current[which];
    timers.current[which] = setTimeout(async () => {
      if (text.trim().length < 2) {
        patch(which, { suggestions: [] });
        return;
      }
      try {
        const { data } = await geoApi.autocomplete(text, {
          lat: DA_NANG_CENTER.lat, lng: DA_NANG_CENTER.lng, radius: 50, limit: 5,
        });
        if (seq === requestSeq.current[which]) patch(which, { suggestions: data.data.predictions || [] });
      } catch {
        if (seq === requestSeq.current[which]) patch(which, { suggestions: [] });
      }
    }, 400);
  }, [patch, resetRoute]);

  const closeSuggestions = useCallback((which: RouteEnd) => {
    clearTimeout(timers.current[which]);
    requestSeq.current[which] += 1;
    patch(which, { suggestions: [] });
  }, [patch]);

  const setPoint = useCallback((which: RouteEnd, label: string, coord: LatLngTuple) => {
    clearTimeout(timers.current[which]);
    requestSeq.current[which] += 1;
    patch(which, { label, coord, suggestions: [] });
    resetRoute();
  }, [patch, resetRoute]);

  const pick = useCallback(async (which: RouteEnd, prediction: GeoPrediction) => {
    closeSuggestions(which);
    patch(which, { label: prediction.description });
    try {
      const { data } = await geoApi.placeDetail(prediction.place_id);
      setPoint(which, prediction.description, [data.data.lat, data.data.lng]);
    } catch {
      setError('Không lấy được toạ độ của địa chỉ này. Hãy chọn một gợi ý khác.');
    }
  }, [closeSuggestions, patch, setPoint]);

  const locateStart = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Trình duyệt này không hỗ trợ lấy vị trí.');
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        let label = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        try {
          // Proxy đã tự trả lại toạ độ khi không tra được địa chỉ.
          const { data } = await geoApi.reverse(latitude, longitude);
          label = data.data.address;
        } catch {
          /* giữ toạ độ làm nhãn */
        }
        setPoint('start', label, [latitude, longitude]);
        setLocating(false);
      },
      () => {
        setLocating(false);
        setError('Không lấy được vị trí hiện tại. Hãy cho phép trình duyệt truy cập vị trí, hoặc nhập địa chỉ.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [setPoint]);

  const from = points.start.coord;
  const to = points.end.coord;

  const findRoute = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    resetRoute();
    try {
      // Backend đã bóc tách sẵn điểm và tóm tắt, client không phải đọc response thô.
      const { data } = await geoApi.route(from, to);
      if (data.data.points.length > 1) {
        setPath(data.data.points);
        setSummary(describeRoute(data.data));
      } else {
        setError('Không tìm được tuyến đường giữa hai điểm này. Thử chọn điểm khác.');
      }
    } catch {
      setError('Không tìm được tuyến đường giữa hai điểm này. Thử chọn điểm khác.');
    } finally {
      setLoading(false);
    }
  }, [from, to, resetRoute]);

  const clear = useCallback(() => {
    clearTimeout(timers.current.start);
    clearTimeout(timers.current.end);
    requestSeq.current.start += 1;
    requestSeq.current.end += 1;
    setPoints({ start: EMPTY, end: EMPTY });
    resetRoute();
  }, [resetRoute]);

  return {
    start: points.start,
    end: points.end,
    path,
    summary,
    loading,
    locating,
    error,
    type,
    pick,
    setPoint,
    closeSuggestions,
    locateStart,
    findRoute,
    clear,
  };
};

export type RoutePlanner = ReturnType<typeof useRoutePlanner>;
