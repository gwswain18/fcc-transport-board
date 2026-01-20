import { useEffect, useState } from 'react';
import { api } from '../../utils/api';
import { Floor } from '../../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface StaffingData {
  floor: Floor;
  active_transporters: number;
  available_transporters: number;
  busy_transporters: number;
  on_break_transporters: number;
}

interface StaffingMetricsProps {
  dateRange?: {
    start_date: string;
    end_date: string;
  };
}

const FLOOR_COLORS: Record<Floor, string> = {
  FCC1: '#3B82F6',
  FCC4: '#10B981',
  FCC5: '#F59E0B',
  FCC6: '#8B5CF6',
};

export default function StaffingMetrics({ dateRange }: StaffingMetricsProps) {
  const [staffingData, setStaffingData] = useState<StaffingData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStaffingData();
  }, [dateRange]);

  const loadStaffingData = async () => {
    setLoading(true);
    const response = await api.getStaffingByFloor(dateRange);
    if (response.data?.staffing) {
      setStaffingData(response.data.staffing);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Staffing by Floor</h3>
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  const chartData = staffingData.map((data) => ({
    floor: data.floor,
    Available: data.available_transporters,
    Busy: data.busy_transporters,
    'On Break': data.on_break_transporters,
    fill: FLOOR_COLORS[data.floor],
  }));

  const totalActive = staffingData.reduce((sum, d) => sum + d.active_transporters, 0);
  const totalAvailable = staffingData.reduce((sum, d) => sum + d.available_transporters, 0);
  const totalBusy = staffingData.reduce((sum, d) => sum + d.busy_transporters, 0);
  const totalOnBreak = staffingData.reduce((sum, d) => sum + d.on_break_transporters, 0);

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Staffing by Floor</h3>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <p className="text-2xl font-bold text-gray-900">{totalActive}</p>
          <p className="text-xs text-gray-500">Total Active</p>
        </div>
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <p className="text-2xl font-bold text-green-600">{totalAvailable}</p>
          <p className="text-xs text-gray-500">Available</p>
        </div>
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <p className="text-2xl font-bold text-blue-600">{totalBusy}</p>
          <p className="text-xs text-gray-500">Busy</p>
        </div>
        <div className="text-center p-3 bg-yellow-50 rounded-lg">
          <p className="text-2xl font-bold text-yellow-600">{totalOnBreak}</p>
          <p className="text-xs text-gray-500">On Break</p>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="floor" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="Available" stackId="a" fill="#10B981" />
            <Bar dataKey="Busy" stackId="a" fill="#3B82F6" />
            <Bar dataKey="On Break" stackId="a" fill="#F59E0B" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Floor Details */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {staffingData.map((data) => (
          <div
            key={data.floor}
            className="p-3 rounded-lg border"
            style={{ borderColor: FLOOR_COLORS[data.floor] }}
          >
            <h4 className="font-medium text-gray-900 mb-2">{data.floor}</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Active:</span>
                <span className="font-medium">{data.active_transporters}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-600">Available:</span>
                <span className="font-medium">{data.available_transporters}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-600">Busy:</span>
                <span className="font-medium">{data.busy_transporters}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-yellow-600">On Break:</span>
                <span className="font-medium">{data.on_break_transporters}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
