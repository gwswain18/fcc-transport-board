import Header from '../components/common/Header';
import AlertBanners from '../components/common/AlertBanners';
import AlertSettings from '../components/settings/AlertSettings';
import CycleTimeThresholdSettings from '../components/settings/CycleTimeThresholdSettings';

export default function Settings() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <AlertBanners />

      <main className="max-w-7xl mx-auto p-4">
        <div className="space-y-6">
          <AlertSettings />
          <CycleTimeThresholdSettings />
        </div>
      </main>
    </div>
  );
}
