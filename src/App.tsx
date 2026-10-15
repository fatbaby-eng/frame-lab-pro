import { EditorProvider } from './editor/EditorContext';
import EditorLayout from './editor/EditorLayout';
import StartScreen from './splash/StartScreen';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <EditorProvider>
      <ErrorBoundary>
        <EditorLayout />
        <StartScreen />
      </ErrorBoundary>
    </EditorProvider>
  );
}

export default App;
