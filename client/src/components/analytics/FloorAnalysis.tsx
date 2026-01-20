import { useEffect, useState } from 'react';
import { api } from '../../utils/api';
import { Floor } from '../../types';
import { formatMinutes } from '../../utils/formatters';
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

interface FloorAnalysisData {
  floor: Floor;
  total_requests: number;
  avg_response_time: number;
  avg_pickup_time: number;
  avg_transport_time: number;
  avg_cycle_time: number;
  pct_transferred: number;
  cancelled_count: number;
}

interface FloorAnalysisProps {
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

export default function FloorAnalysis({ dateRange }: FloorAnalysisProps) {
  const [floorData, setFloorData] = useState<FloorAnalysisData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFloorAnalysis();
  }, [dateRange]);

  const loadFloorAnalysis = async () => {
    setLoading(true);
    const response = await api.getFloorAnalysis(dateRange);
    if (response.data?.floors) {
      setFloorData(response.data.floors);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Floor Analysis</h3>
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  // Prepare data for charts
  const volumeData = floorData.map((d) => ({
    floor: d.floor,
    Requests: d.total_requests,
    Cancelled: d.cancelled_count,
    PCT: Math.round(d.total_requests * d.pct_transferred / 100),
    fill: FLOOR_COLORS[d.floor],
  }));

  const timeData = floorData.map((d) => ({
    floor: d.floor,
    Response: d.avg_response_time,
    Pickup: d.avg_pickup_time,
    Transport: d.avg_transport_time,
    Cycle: d.avg_cycle_time,
  }));

  return (
    <div className="space-y-6">
      {/* Volume by Floor */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Volume by Floor</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={volumeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="floor" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Requests" fill="#3B82F6" name="Total Requests" />
              <Bar dataKey="PCT" fill="#F97316" name="PCT Transfers" />
              <Bar dataKey="Cancelled" fill="#EF4444" name="Cancelled" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Average Times by Floor */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Average Times by Floor (minutes)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timeData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="floor" type="category" />
              <Tooltip formatter={(value: number) => formatMinutes(value)} />
              <Legend />
              <Bar dataKey="Response" fill="#10B981" name="Response Time" />
              <Bar dataKey="Pickup" fill="#3B82F6" name="Pickup Time" />
              <Bar dataKey="Transport" fill="#F59E0B" name="Transport Time" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Floor Performance Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-600">Floor</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Requests</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Avg Response</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Avg Pickup</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Avg Transport</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Avg Cycle</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">PCT %</th>
              </tr>
            </thead>
            <tbody>
              {floorData.map((floor) => (
                <tr
                  key={floor.floor}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-3 px-4">
                    <span
                      className="font-medium"
                      style={{ color: FLOOR_COLORS[floor.floor] }}
                    >
                      {floor.floor}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-gray-600">
                    {floor.total_requests}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-600">
                    {formatMinutes(floor.avg_response_time)}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-600">
                    {formatMinutes(floor.avg_pickup_time)}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-600">
                    {formatMinutes(floor.avg_transport_time)}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-gray-900">
                    {formatMinutes(floor.avg_cycle_time)}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-600">
                    {floor.pct_transferred.toFixed(1)}%
                  </td>
                </tr>
              ))}
              {floorData.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    No data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
