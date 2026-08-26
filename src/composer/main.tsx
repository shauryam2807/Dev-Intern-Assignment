import { MotionConfig } from 'motion/react';
import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { LibraryProvider } from '../libraries/LibraryProvider';
import { useLibrary } from '../libraries/useLibrary';
import type { UiLibrary } from '../libraries/types';
import { ThemeProvider } from '../theme/ThemeProvider';
import { ThemePanel } from '../playground/ThemePanel';
import { Board } from './Board';
import { ComposerExport } from './ComposerExport';
import { Editor } from './Editor';
import { patchScreen } from './schema';
import { useComposerDoc } from './store';
import '../styles/base.css';
import '../playground/themepanel.css';
import './board.css';

type Mode = { view: 'board' } | { view: 'editor'; screenId: string };

function ComposerApp({ library }: { library: UiLibrary }) {
  const { doc, update, replace } = useComposerDoc(library.id, library.seed);
  const [mode, setMode] = useState<Mode>({ view: 'board' });
  const [exportOpen, setExportOpen] = useState(false);

  if (mode.view === 'editor') {
    const screen = doc.screens.find((s) => s.id === mode.screenId);
    if (!screen) {
      setMode({ view: 'board' });
      return null;
    }
    return (
      <Editor
        key={screen.id}
        config={library.composerConfig}
        screen={screen}
        onChange={(data) =>
          update((d) => patchScreen(d, screen.id, { puckData: data }))
        }
        onClose={() => setMode({ view: 'board' })}
      />
    );
  }

  return (
    <>
      <Board
        config={library.composerConfig}
        doc={doc}
        update={update}
        onOpenScreen={(screenId) => setMode({ view: 'editor', screenId })}
        onExport={() => setExportOpen(true)}
      />
      <ThemePanel presets={library.presets} />
      <ComposerExport
        doc={doc}
        codegen={library.codegen}
        figma={library.figma}
        globalTokens={library.globalTokens}
        open={exportOpen}
        onOpenChange={setExportOpen}
        onImport={replace}
      />
    </>
  );
}

/** Theme + composer shell for the active library. */
function ComposerRoot() {
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
      <ComposerApp key={library.id} library={library} />
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <LibraryProvider>
        <ComposerRoot />
      </LibraryProvider>
    </MotionConfig>
  </React.StrictMode>,
);
