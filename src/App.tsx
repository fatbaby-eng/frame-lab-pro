import { EditorProvider } from './editor/EditorContext';
import EditorLayout from './editor/EditorLayout';

function App() {
  return (
    <EditorProvider>
      <EditorLayout />
    </EditorProvider>
  );
}

export default App;
