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

// Add this at the top with other imports
const ENTRY_COLORS: { [key: string]: string } = {
  user: '#4f46e5',    // indigo
  name: '#2563eb',    // blue
  email: '#7c3aed',   // violet
  phone: '#db2777',   // pink
  address: '#059669'  // emerald
};

// Custom component for autocompleted entries
const AutocompletedSpan = (props: any) => {
  const text = props.children[0].props.text;
  const value = text.replace('<>', '');
  const color = ENTRY_COLORS[value] || '#4f46e5';

  return (
    <span 
      className="autocompleted-entry"
      style={{ 
        '--entry-color': color,
        '--entry-color-bg': `${color}10`
      } as React.CSSProperties}
    >
      {props.children}
    </span>
  );
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
    const regex = /<>[^\s<>]+/g;
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
      // Check if cursor is right after an autocompleted entry
      const beforeCursor = text.slice(0, cursorPos);
      const match = beforeCursor.match(/<>[^\s<>]+$/);
      
      if (match && match.index !== undefined && match.index + match[0].length === cursorPos) {
        // Remove only the autocompleted entry
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
    
    const beforeCursor = text.slice(0, cursorPos);
    const match = beforeCursor.match(/<>([^\s<>]*)$/);
    
    if (match) {
      const start = match.index!;
      const valueToInsert = suggestion || match[1];
      
      // Insert the autocompleted text without space
      const newContent = Modifier.replaceText(
        content,
        selection.merge({
          anchorOffset: start,
          focusOffset: cursorPos,
        }),
        `<>${valueToInsert}`
      );
      
      // Add space separately
      const newContentWithSpace = Modifier.insertText(
        newContent,
        newContent.getSelectionAfter(),
        ' '
      );
      
      const newState = EditorState.push(
        editorState,
        newContentWithSpace,
        'insert-characters'
      );
      
      // Move cursor after the space
      const newSelection = newState.getSelection().merge({
        anchorOffset: start + valueToInsert.length + 3,
        focusOffset: start + valueToInsert.length + 3
      });
      
      setEditorState(EditorState.forceSelection(newState, newSelection));
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
              style={{
                '--suggestion-color': ENTRY_COLORS[suggestion] || '#4f46e5'
              } as React.CSSProperties}
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