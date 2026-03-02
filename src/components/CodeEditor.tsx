import React, { useCallback, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { java } from '@codemirror/lang-java';
import { sql } from '@codemirror/lang-sql';
import { EditorView } from '@codemirror/view';

interface CodeEditorProps {
    value: string;
    onChange?: (value: string) => void;
    language: 'json' | 'java' | 'kotlin' | 'sql';
    readOnly?: boolean;
    placeholder?: string;
    appTheme?: 'dark' | 'light';
}

const sharedStyles = EditorView.theme({
    '&': { height: '100%' },
    '.cm-content': { fontFamily: "'JetBrains Mono', monospace", fontSize: '0.875rem', padding: '12px 0' },
    '.cm-line': { padding: '0 12px' },
    '.cm-foldGutter': { width: '12px' },
    '.cm-cursor': { borderLeftColor: '#818cf8' },
    '.cm-selectionBackground': { backgroundColor: 'rgba(99,102,241,0.2) !important' },
    '.cm-activeLine': { backgroundColor: 'rgba(99,102,241,0.06)' },
    '.cm-activeLineGutter': { backgroundColor: 'rgba(99,102,241,0.08)' },
});

const darkStyles = EditorView.theme({
    '&': { backgroundColor: 'rgba(10, 14, 26, 0.95)' },
    '.cm-gutters': { backgroundColor: 'rgba(255,255,255,0.02)', borderRight: '1px solid rgba(148,163,184,0.12)', color: 'rgba(148,163,184,0.4)' },
}, { dark: true });

const lightStyles = EditorView.theme({
    '&': { backgroundColor: '#ffffff' },
    '.cm-gutters': { backgroundColor: '#f8fafc', borderRight: '1px solid rgba(100,116,139,0.15)', color: '#94a3b8' },
    '.cm-content': { color: '#1e293b' },
    '.cm-activeLine': { backgroundColor: 'rgba(99,102,241,0.05)' },
    '.cm-activeLineGutter': { backgroundColor: 'rgba(99,102,241,0.06)' },
}, { dark: false });

export const CodeEditor: React.FC<CodeEditorProps> = ({ value, onChange, language, readOnly = false, placeholder, appTheme = 'dark' }) => {
    const extensions = useMemo(() => {
        const themeExt = appTheme === 'dark' ? darkStyles : lightStyles;
        const exts = [sharedStyles, themeExt, EditorView.lineWrapping];
        switch (language) {
            case 'json': exts.push(json()); break;
            case 'java': case 'kotlin': exts.push(java()); break;
            case 'sql': exts.push(sql()); break;
        }
        return exts;
    }, [language, appTheme]);

    const handleChange = useCallback((val: string) => {
        onChange?.(val);
    }, [onChange]);

    return (
        <CodeMirror
            value={value}
            onChange={handleChange}
            extensions={extensions}
            theme={appTheme}
            readOnly={readOnly}
            placeholder={placeholder || `Enter ${language.toUpperCase()} here...`}
            basicSetup={{
                lineNumbers: true,
                highlightActiveLine: true,
                bracketMatching: true,
                autocompletion: false,
                foldGutter: true,
                indentOnInput: true,
            }}
            style={{ height: '100%', minHeight: '450px' }}
        />
    );
};
