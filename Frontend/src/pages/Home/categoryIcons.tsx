import React from 'react';
import {
  EditRoadRounded,
  DeleteOutlineRounded,
  LightbulbOutlined,
  FloodOutlined,
  ParkOutlined,
  ReportProblemOutlined,
} from '@mui/icons-material';
import { CATEGORY_MAP } from '../../utils/constants';

/** Cùng bộ icon với app di động (AppIcons.category) — web và app nhìn thống nhất. */
const ICONS: Record<string, React.ElementType> = {
  pothole: EditRoadRounded,
  garbage: DeleteOutlineRounded,
  streetlight: LightbulbOutlined,
  flooding: FloodOutlined,
  tree: ParkOutlined,
};

export const categoryIcon = (key: string): React.ElementType => ICONS[key] ?? ReportProblemOutlined;
export const categoryColor = (key: string) => CATEGORY_MAP[key]?.color ?? '#6B7280';
export const categoryLabel = (key: string) => CATEGORY_MAP[key]?.label ?? 'Khác';
