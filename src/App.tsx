import { Dashboard } from './components/Dashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from 'sonner';

export default function App() {
  return (
    <div data-testid="app-container">
      <ErrorBoundary>
        <Dashboard />
      </ErrorBoundary>
      <Toaster position="top-right" />
    </div>
  );
}
