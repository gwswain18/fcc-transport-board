import { useState } from 'react';
import { Floor } from '../../types';

interface ShiftStartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (data: { extension?: string; floor_assignment?: Floor }) => void;
  loading?: boolean;
}

const FLOORS: Floor[] = ['FCC1', 'FCC4', 'FCC5', 'FCC6'];

// Sentinel for an explicit "no specific floor" choice — distinct from the
// unselected placeholder so the choice is mandatory but "none" stays possible
const NO_FLOOR = 'NONE';

export default function ShiftStartModal({
  isOpen,
  onClose,
  onStart,
  loading = false,
}: ShiftStartModalProps) {
  const [extension, setExtension] = useState('');
  const [floorAssignment, setFloorAssignment] = useState<Floor | typeof NO_FLOOR | ''>('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!floorAssignment) return;
    onStart({
      extension: extension.trim() || undefined,
      floor_assignment:
        floorAssignment === NO_FLOOR ? undefined : (floorAssignment as Floor),
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-25" />
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Start Your Shift
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Welcome! Please enter your extension number and select the floor you
            are assigned to today. Your floor choice steers which jobs are
            auto-assigned to you.
          </p>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="extension"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Extension Number
                </label>
                <input
                  type="text"
                  id="extension"
                  value={extension}
                  onChange={(e) => setExtension(e.target.value)}
                  placeholder="e.g., 1234"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  autoFocus
                />
              </div>
              <div>
                <label
                  htmlFor="floor"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Floor Assignment
                </label>
                <select
                  id="floor"
                  value={floorAssignment}
                  onChange={(e) => setFloorAssignment(e.target.value as Floor | typeof NO_FLOOR)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  required
                >
                  <option value="" disabled>
                    Select your floor…
                  </option>
                  {FLOORS.map((floor) => (
                    <option key={floor} value={floor}>
                      {floor}
                    </option>
                  ))}
                  <option value={NO_FLOOR}>No specific floor</option>
                </select>
                {!floorAssignment && (
                  <p className="mt-1 text-xs text-amber-600">
                    Select your floor for today (or "No specific floor") to start
                    your shift.
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !floorAssignment}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {loading ? 'Starting...' : 'Start Shift'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
