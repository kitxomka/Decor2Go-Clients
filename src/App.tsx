import { Dashboard } from './components/Dashboard';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  return (
    <div data-testid="app-container">
      <ErrorBoundary>
        <Dashboard />
      </ErrorBoundary>
    </div>
  );
}
