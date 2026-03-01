import { useState, useEffect } from 'react';

interface SecretarySessionModalProps {
  isOpen: boolean;
  onSubmit: (data: { first_name: string; last_name: string; phone_extension?: string }) => void;
  loading?: boolean;
}

export default function SecretarySessionModal({
  isOpen,
  onSubmit,
  loading = false,
}: SecretarySessionModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [extension, setExtension] = useState('');

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    onSubmit({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone_extension: extension.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" />

        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md transform transition-all">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Secretary Session</h3>
            <p className="text-sm text-gray-500 mt-1">
              Enter your name and extension for this session.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">First Name *</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="input"
                  placeholder="Your first name"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Last Name *</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="input"
                  placeholder="Your last name"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Phone Extension</label>
              <input
                type="text"
                value={extension}
                onChange={(e) => setExtension(e.target.value)}
                className="input"
                placeholder="e.g., 4521"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !firstName.trim() || !lastName.trim()}
              className="w-full btn-primary py-3 text-lg font-semibold"
            >
              {loading ? 'Starting session...' : 'Start Session'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
