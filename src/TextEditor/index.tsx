import React, { useCallback, useState, useRef } from 'react';
import { 
  Editor, 
  EditorState, 
  CompositeDecorator, 
  Modifier, 
  SelectionState,
  getDefaultKeyBinding 
} from 'draft-js';
import 'draft-js/dist/Draft.css';
import './text-editor.css';

// Hardcoded suggestions for demo
const SUGGESTIONS = [
  'user', 
  'name', 
  'email', 
  'phone',
  'address'
];

// Custom component for autocompleted entries
const AutocompletedSpan = (props: any) => {
  return <span style={{ color: '#2563eb', userSelect: 'none' }}>{props.children}</span>;
};

const CustomEditor = () => {
  const [editorState, setEditorState] = useState(() => {
    const decorator = new CompositeDecorator([{
      strategy: findAutocompleted,
      component: AutocompletedSpan,
    }]);
    return EditorState.createEmpty(decorator);
  });
  
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const editorRef = useRef<Editor>(null);

  // Strategy to find autocompleted entries
  function findAutocompleted(contentBlock: any, callback: any) {
    const text = contentBlock.getText();
    let matchArr, start;
    const regex = /<>[^<>\n]+/g;
    while ((matchArr = regex.exec(text)) !== null) {
      start = matchArr.index;
      callback(start, start + matchArr[0].length);
    }
  }

  const handleKeyCommand = useCallback((command: string) => {
    const selection = editorState.getSelection();
    const content = editorState.getCurrentContent();
    const block = content.getBlockForKey(selection.getStartKey());
    const text = block.getText();
    const cursorPos = selection.getStartOffset();
    
    if (command === 'backspace') {
      // Check if cursor is at the end of an autocompleted entry
      const beforeCursor = text.slice(0, cursorPos);
      const match = beforeCursor.match(/<>[^<>\n]+$/);
      
      if (match) {
        // Remove the entire autocompleted entry
        const newContent = Modifier.removeRange(
          content,
          selection.merge({
            anchorOffset: match.index,
            focusOffset: cursorPos
          }),
          'backward'
        );
        
        setEditorState(EditorState.push(
          editorState,
          newContent,
          'remove-range'
        ));
        return 'handled';
      }
    }
    return 'not-handled';
  }, [editorState]);

  const onChange = (newState: EditorState) => {
    const selection = newState.getSelection();
    const content = newState.getCurrentContent();
    const block = content.getBlockForKey(selection.getStartKey());
    const text = block.getText();
    const cursorPos = selection.getStartOffset();

    // Check for autocomplete trigger
    const beforeCursor = text.slice(0, cursorPos);
    const match = beforeCursor.match(/<>([^<>\n]*)$/);

    if (match) {
      const searchText = match[1];
      const filtered = SUGGESTIONS.filter(s => 
        s.toLowerCase().startsWith(searchText.toLowerCase())
      );
      setSuggestions(filtered);
      setSelectedSuggestion(0);
    } else {
      setSuggestions([]);
    }

    setEditorState(newState);
  };

  const insertSuggestion = (suggestion?: string) => {
    const selection = editorState.getSelection();
    const content = editorState.getCurrentContent();
    const block = content.getBlockForKey(selection.getStartKey());
    const text = block.getText();
    const cursorPos = selection.getStartOffset();
    
    // Find the start of the autocomplete trigger
    const beforeCursor = text.slice(0, cursorPos);
    const match = beforeCursor.match(/<>([^<>\n]*)$/);
    
    if (match) {
      const start = match.index!;
      // Use suggestion if provided, otherwise use the match string
      const valueToInsert = suggestion || match[1];
      
      const newContent = Modifier.replaceText(
        content,
        selection.merge({
          anchorOffset: start,
          focusOffset: cursorPos,
        }),
        `<>${valueToInsert}`
      );
      
      const newState = EditorState.push(
        editorState,
        newContent,
        'insert-characters'
      );
      
      setEditorState(newState);
      setSuggestions([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (suggestions.length > 0) {
      if (e.keyCode === 40) { // Down arrow
        e.preventDefault();
        setSelectedSuggestion(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
      } else if (e.keyCode === 38) { // Up arrow
        e.preventDefault();
        setSelectedSuggestion(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
      } else if (e.keyCode === 13 || e.keyCode === 9) { // Enter or Tab
        e.preventDefault();
        insertSuggestion(suggestions[selectedSuggestion]);
      } else if (e.keyCode === 27) { // Escape
        e.preventDefault();
        // Insert current match string without suggestion
        insertSuggestion();
      }
    }
  };

  return (
    <div className="editor-wrapper">
      <div 
        className="editor-container"
        onKeyDown={handleKeyDown}
      >
        <Editor
          ref={editorRef}
          editorState={editorState}
          onChange={onChange}
          handleKeyCommand={handleKeyCommand}
          placeholder="Type <> to trigger autocomplete..."
          keyBindingFn={(e) => {
            if (suggestions.length > 0 && 
               (e.keyCode === 38 || e.keyCode === 40 || 
                e.keyCode === 13 || e.keyCode === 9)) {
              return 'handle-suggestion';
            }
            return getDefaultKeyBinding(e);
          }}
        />
      </div>
      
      {suggestions.length > 0 && (
        <div className="suggestions-dropdown">
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion}
              className={`suggestion-item ${
                index === selectedSuggestion ? 'selected' : ''
              }`}
              onClick={() => insertSuggestion(suggestion)}
              onMouseEnter={() => setSelectedSuggestion(index)}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomEditor;