import { ActiveDispatcher } from '../../types';

interface DispatcherInfoCardProps {
  dispatchers: ActiveDispatcher[];
}

export default function DispatcherInfoCard({ dispatchers }: DispatcherInfoCardProps) {
  if (dispatchers.length === 0) return null;

  const available = dispatchers.filter((d) => !d.on_break);
  const primary = available.find((d) => d.is_primary);
  const assistants = available.filter((d) => !d.is_primary);

  if (available.length === 0) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-sm text-blue-700">All dispatchers currently unavailable</p>
      </div>
    );
  }

  const getContact = (d: ActiveDispatcher): string | null =>
    d.contact_info || d.user?.phone_number || null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
      <p className="text-xs font-medium text-blue-500 mb-1">Dispatcher On Duty</p>
      {primary && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-blue-900">
            {primary.user?.first_name} {primary.user?.last_name}
          </span>
          {getContact(primary) && (
            <span className="text-sm text-blue-700 font-medium">
              Ext. {getContact(primary)}
            </span>
          )}
        </div>
      )}
      {assistants.map((asst) => (
        <div key={asst.id} className="flex items-center justify-between mt-1">
          <span className="text-sm text-blue-800">
            {asst.user?.first_name} {asst.user?.last_name}{' '}
            <span className="text-blue-500">(Asst)</span>
          </span>
          {getContact(asst) && (
            <span className="text-sm text-blue-700">
              Ext. {getContact(asst)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
