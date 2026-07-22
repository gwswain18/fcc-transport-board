import Header from '../components/common/Header';
import AlertBanners from '../components/common/AlertBanners';
import AlertSettings from '../components/settings/AlertSettings';
import AssignmentAlgorithmSettings from '../components/settings/AssignmentAlgorithmSettings';
import AuthProviderSettings from '../components/settings/AuthProviderSettings';
import AutoReassignSettings from '../components/settings/AutoReassignSettings';
import CycleTimeThresholdSettings from '../components/settings/CycleTimeThresholdSettings';
import NotesSettings from '../components/settings/NotesSettings';
import SettingsChangeHistory from '../components/settings/SettingsChangeHistory';

export default function Settings() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <AlertBanners />

      <main className="max-w-7xl mx-auto p-4">
        <div className="space-y-6">
          <AlertSettings />
          <AutoReassignSettings />
          <CycleTimeThresholdSettings />
          <NotesSettings />
          <AuthProviderSettings />
          <AssignmentAlgorithmSettings />
          <SettingsChangeHistory />
        </div>
      </main>
    </div>
  );
}
