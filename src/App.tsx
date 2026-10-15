import { EditorProvider } from './editor/EditorContext';
import EditorLayout from './editor/EditorLayout';
import StartScreen from './splash/StartScreen';

function App() {
  return (
    <EditorProvider>
      <EditorLayout />
      <StartScreen />
    </EditorProvider>
  );
}

export default App;
