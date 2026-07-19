import { ActiveSecretary } from '../../types';

interface ActiveSecretaryCardProps {
  secretaries: ActiveSecretary[];
  onEndSession?: (secretary: ActiveSecretary) => void;
}

export default function ActiveSecretaryCard({ secretaries, onEndSession }: ActiveSecretaryCardProps) {
  if (secretaries.length === 0) return null;

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Secretaries
        <span className="ml-2 text-sm font-normal text-gray-500">
          ({secretaries.length})
        </span>
      </h2>
      <div className="space-y-2">
        {secretaries.map((sec) => (
          <div
            key={sec.id}
            className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
          >
            <div>
              <span className="font-medium text-gray-900">
                {sec.session_first_name} {sec.session_last_name}
              </span>
              {sec.phone_extension && (
                <span className="ml-2 text-sm text-gray-500">
                  Ext. {sec.phone_extension}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                Active
              </span>
              {onEndSession && (
                <button
                  onClick={() => onEndSession(sec)}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Log Out
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
