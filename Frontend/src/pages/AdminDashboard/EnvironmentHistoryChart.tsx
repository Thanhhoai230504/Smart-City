import React, { useEffect, useState } from 'react';
import { environmentApi } from '../../api/environmentApi';
import {
  Box, Typography, Stack, ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

interface HistoryEntry {
  location: string;
  temperature: number;
  humidity: number;
  createdAt: string;
}

interface ChartPoint {
  time: string;
  [key: string]: string | number;
}

interface Props {
  GlassCard: React.ComponentType<{ children: React.ReactNode; sx?: object }>;
  ChartTooltip: React.ComponentType<any>;
}

const LOCATION_COLORS = ['#6C63FF', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899'];

const EnvironmentHistoryChart: React.FC<Props> = ({ GlassCard, ChartTooltip }) => {
  const [period, setPeriod] = useState<string>('168'); // hours (7 days)
  const [dataType, setDataType] = useState<'temperature' | 'humidity'>('temperature');
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [locations, setLocations] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await environmentApi.getEnvironmentHistory({ hours: parseInt(period) });
        const history: HistoryEntry[] = data.data.history;

        // Group by time (round to nearest hour)
        const grouped: Record<string, Record<string, { temp: number; hum: number; count: number }>> = {};
        const locSet = new Set<string>();

        history.forEach((entry) => {
          const date = new Date(entry.createdAt);
          const timeKey = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:00`;
          const shortLoc = entry.location.replace(', Đà Nẵng', '').replace('Quận ', '');

          locSet.add(shortLoc);
          if (!grouped[timeKey]) grouped[timeKey] = {};
          if (!grouped[timeKey][shortLoc]) grouped[timeKey][shortLoc] = { temp: 0, hum: 0, count: 0 };
          grouped[timeKey][shortLoc].temp += entry.temperature;
          grouped[timeKey][shortLoc].hum += entry.humidity;
          grouped[timeKey][shortLoc].count += 1;
        });

        const locs = Array.from(locSet);
        setLocations(locs);

        const points: ChartPoint[] = Object.entries(grouped)
          .map(([time, locData]) => {
            const point: ChartPoint = { time };
            locs.forEach((loc) => {
              if (locData[loc]) {
                point[`${loc}_temp`] = Math.round((locData[loc].temp / locData[loc].count) * 10) / 10;
                point[`${loc}_hum`] = Math.round(locData[loc].hum / locData[loc].count);
              }
            });
            return point;
          })
          .sort((a, b) => a.time.localeCompare(b.time));

        setChartData(points);
      } catch { /* ignore */ }
    })();
  }, [period]);

  return (
    <GlassCard sx={{}}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={1}>
        <Typography fontWeight={600}>
          {dataType === 'temperature' ? '🌡️ Lịch sử nhiệt độ' : '💧 Lịch sử độ ẩm'}
        </Typography>
        <Stack direction="row" spacing={1}>
          <ToggleButtonGroup size="small" exclusive value={dataType} onChange={(_, v) => v && setDataType(v)}>
            <ToggleButton value="temperature" sx={{ fontSize: '0.7rem', py: 0.3, px: 1.5, borderRadius: '8px !important' }}>🌡️ Nhiệt độ</ToggleButton>
            <ToggleButton value="humidity" sx={{ fontSize: '0.7rem', py: 0.3, px: 1.5, borderRadius: '8px !important' }}>💧 Độ ẩm</ToggleButton>
          </ToggleButtonGroup>
          <ToggleButtonGroup size="small" exclusive value={period} onChange={(_, v) => v && setPeriod(v)}>
            <ToggleButton value="24" sx={{ fontSize: '0.7rem', py: 0.3, px: 1, borderRadius: '8px !important' }}>24h</ToggleButton>
            <ToggleButton value="168" sx={{ fontSize: '0.7rem', py: 0.3, px: 1, borderRadius: '8px !important' }}>7 ngày</ToggleButton>
            <ToggleButton value="720" sx={{ fontSize: '0.7rem', py: 0.3, px: 1, borderRadius: '8px !important' }}>30 ngày</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Stack>

      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="time" tick={{ fill: '#9CA3AF', fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }}
              domain={dataType === 'temperature' ? ['auto', 'auto'] : [0, 100]}
              unit={dataType === 'temperature' ? '°C' : '%'} />
            <RTooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {locations.map((loc, i) => (
              <Line
                key={loc}
                type="monotone"
                dataKey={`${loc}_${dataType === 'temperature' ? 'temp' : 'hum'}`}
                name={loc}
                stroke={LOCATION_COLORS[i % LOCATION_COLORS.length]}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Chưa có dữ liệu lịch sử. Dữ liệu sẽ tích lũy theo thời gian.
          </Typography>
        </Box>
      )}
    </GlassCard>
  );
};

export default EnvironmentHistoryChart;
