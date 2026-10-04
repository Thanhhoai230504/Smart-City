import React, { useEffect, useState } from 'react';
import { FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, Stack, TextField, Button } from '@mui/material';
import { PERIOD_PRESETS, PeriodPreset, PeriodValue, validateCustomPeriod } from '../../../utils/period';

const toInputDate = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Chọn kỳ đánh giá. Kỳ tùy chọn chỉ áp dụng khi bấm "Áp dụng" và đã hợp lệ, để không
 * gọi API mỗi lần gõ một chữ số.
 */
const PeriodPicker: React.FC<{ value: PeriodValue; onChange: (v: PeriodValue) => void; disabled?: boolean }> = ({
  value, onChange, disabled,
}) => {
  const today = toInputDate(new Date());
  const [from, setFrom] = useState(value.from || toInputDate(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(value.to || today);
  const [preset, setPreset] = useState<PeriodPreset>(value.preset);
  useEffect(() => { setPreset(value.preset); }, [value.preset]);

  const error = preset === 'custom' ? validateCustomPeriod(from, to) : null;

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'flex-start' }}>
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <InputLabel id="perf-period-label">Kỳ đánh giá</InputLabel>
        <Select
          labelId="perf-period-label"
          label="Kỳ đánh giá"
          value={preset}
          disabled={disabled}
          onChange={(event: SelectChangeEvent) => {
            const next = event.target.value as PeriodPreset;
            setPreset(next);
            if (next !== 'custom') onChange({ preset: next });
          }}
        >
          {PERIOD_PRESETS.map((p) => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
        </Select>
      </FormControl>
      {preset === 'custom' && (
        <>
          <TextField
            size="small" type="date" label="Từ ngày" value={from} onChange={(e) => setFrom(e.target.value)}
            InputLabelProps={{ shrink: true }} inputProps={{ max: today }} sx={{ minWidth: 165 }}
          />
          <TextField
            size="small" type="date" label="Đến ngày" value={to} onChange={(e) => setTo(e.target.value)}
            InputLabelProps={{ shrink: true }} inputProps={{ max: today }} sx={{ minWidth: 165, maxWidth: { sm: 220 } }}
            error={Boolean(error)} helperText={error || undefined}
          />
          <Button variant="contained" disabled={Boolean(error) || disabled} sx={{ height: 40, whiteSpace: 'nowrap' }}
            onClick={() => onChange({ preset: 'custom', from, to })}>
            Áp dụng
          </Button>
        </>
      )}
    </Stack>
  );
};

export default PeriodPicker;
