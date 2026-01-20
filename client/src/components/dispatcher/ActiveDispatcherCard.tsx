import { ActiveDispatcher } from '../../types';

interface ActiveDispatcherCardProps {
  dispatchers: ActiveDispatcher[];
}

export default function ActiveDispatcherCard({ dispatchers }: ActiveDispatcherCardProps) {
  const primary = dispatchers.find((d) => d.is_primary);
  const assistants = dispatchers.filter((d) => !d.is_primary);

  if (dispatchers.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <p className="text-sm text-yellow-700">No dispatcher currently active</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Active Dispatchers</h3>

      {primary && (
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <svg
              className="w-4 h-4 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900">
                {primary.user?.first_name} {primary.user?.last_name}
              </span>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                Primary
              </span>
            </div>
            {primary.contact_info && (
              <p className="text-xs text-gray-500 mt-0.5">{primary.contact_info}</p>
            )}
          </div>
        </div>
      )}

      {assistants.length > 0 && (
        <div className="border-t border-gray-100 pt-2 mt-2">
          <p className="text-xs text-gray-500 mb-2">Assistants</p>
          <div className="space-y-2">
            {assistants.map((assistant) => (
              <div key={assistant.id} className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <div>
                  <span className="text-sm text-gray-700">
                    {assistant.user?.first_name} {assistant.user?.last_name}
                  </span>
                  {assistant.contact_info && (
                    <span className="text-xs text-gray-400 ml-2">
                      {assistant.contact_info}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
