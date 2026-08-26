import { MotionConfig } from 'motion/react';
import React, { useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { LibraryProvider } from './libraries/LibraryProvider';
import { useLibrary } from './libraries/useLibrary';
import { App } from './playground/App';
import { ThemeProvider } from './theme/ThemeProvider';
import './styles/base.css';
import './playground/playground.css';
import './playground/themepanel.css';

/** Theme + app shell. Component CSS rides each pack's code-split chunk
 *  (see libraries/<id>/index.ts). */
function PlaygroundRoot() {
  const { library } = useLibrary();
  const extraLayers = useMemo(() => [library.componentTokens], [library]);
  return (
    <ThemeProvider
      key={library.id}
      globalTokens={library.globalTokens}
      buildSemantic={library.buildSemantic}
      defaultPreset={library.defaultPreset}
      storageKey={`prism-ui-theme:${library.id}`}
      legacyStorageKeys={[
        `vector-theme:${library.id}`,
        ...(library.id === 'volt' ? ['volt-ds-theme'] : []),
      ]}
      extraLayers={extraLayers}
    >
      <App />
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <LibraryProvider>
        <PlaygroundRoot />
      </LibraryProvider>
    </MotionConfig>
  </React.StrictMode>,
);
