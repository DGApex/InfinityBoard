import { create } from 'zustand';

const MAX_HISTORY = 50;

const useStore = create((set, get) => ({
  items: [],
  selectedId: null,
  activeTool: 'pointer',
  scale: 1,
  position: { x: 0, y: 0 },
  stageSize: { width: window.innerWidth, height: window.innerHeight },
  contentLayerRef: null,

  // History for undo/redo
  history: [{ items: [], timestamp: Date.now() }],
  historyIndex: 0,

  // Helper to push to history
  pushHistory: () => {
    const state = get();
    const snapshot = {
      items: JSON.parse(JSON.stringify(state.items)), // Deep clone
      timestamp: Date.now()
    };

    // Remove any "future" history if we're in the middle
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(snapshot);

    // Limit history size
    const limitedHistory = newHistory.slice(-MAX_HISTORY);

    set({
      history: limitedHistory,
      historyIndex: limitedHistory.length - 1
    });
  },

  // Actions
  addItem: (item) => {
    const state = get();
    state.pushHistory();
    set({ items: [...state.items, item] });
  },

  updateItem: (id, newAttrs) => {
    const state = get();
    // Don't push history for every transform update (too many snapshots)
    // Only push if it's a significant change (content, color, etc.)
    const item = state.items.find(i => i.id === id);
    const isContentChange = newAttrs.content !== undefined || newAttrs.color !== undefined ||
      newAttrs.fill !== undefined || newAttrs.fontSize !== undefined;

    if (isContentChange) {
      state.pushHistory();
    }

    set({
      items: state.items.map((item) => (item.id === id ? { ...item, ...newAttrs } : item)),
    });
  },

  removeItem: (id) => {
    const state = get();
    state.pushHistory();
    set({
      items: state.items.filter((item) => item.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId
    });
  },

  // Undo/Redo
  undo: () => {
    const state = get();
    if (state.historyIndex > 0) {
      const newIndex = state.historyIndex - 1;
      const snapshot = state.history[newIndex];
      set({
        items: JSON.parse(JSON.stringify(snapshot.items)),
        historyIndex: newIndex
      });
    }
  },

  redo: () => {
    const state = get();
    if (state.historyIndex < state.history.length - 1) {
      const newIndex = state.historyIndex + 1;
      const snapshot = state.history[newIndex];
      set({
        items: JSON.parse(JSON.stringify(snapshot.items)),
        historyIndex: newIndex
      });
    }
  },

  selectItem: (id) => set({ selectedId: id }),
  setTool: (tool) => set({
    activeTool: tool,
    selectedId: null
  }),

  setScale: (scale) => set({ scale }),
  setPosition: (position) => set({ position }),
  setStageSize: (width, height) => set({ stageSize: { width, height } }),
  setContentLayerRef: (ref) => set({ contentLayerRef: ref }),

  saveBoard: async () => {
    try {
      const state = get();
      const data = {
        scale: state.scale,
        position: state.position,
        items: state.items,
      };
      const jsonData = JSON.stringify(data, null, 2);

      // Check if we're in Tauri or web mode
      if (window.__TAURI__) {
        const { save } = await import('@tauri-apps/api/dialog');
        const { writeTextFile } = await import('@tauri-apps/api/fs');

        const filePath = await save({
          filters: [{ name: 'InfiniteBoard', extensions: ['json'] }],
        });

        if (filePath) {
          await writeTextFile(filePath, jsonData);
          console.log('Board saved successfully');
          alert('Board saved successfully!');
        }
      } else {
        // Web fallback: download as file
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `infiniteboard-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log('Board downloaded successfully');
      }
    } catch (error) {
      console.error('Failed to save board:', error);
      alert('Failed to save board: ' + error.message);
    }
  },

  loadBoard: async () => {
    try {
      if (window.__TAURI__) {
        const { open } = await import('@tauri-apps/api/dialog');
        const { readTextFile } = await import('@tauri-apps/api/fs');

        const filePath = await open({
          filters: [{ name: 'InfiniteBoard', extensions: ['json'] }],
        });

        if (filePath && typeof filePath === 'string') {
          const content = await readTextFile(filePath);
          const data = JSON.parse(content);

          set({
            scale: data.scale,
            position: data.position,
            items: data.items || [],
          });

          // Reset history after load
          get().pushHistory();
          console.log('Board loaded successfully');
          alert('Board loaded successfully!');
        }
      } else {
        // Web fallback: file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
          const file = e.target.files[0];
          if (file) {
            const content = await file.text();
            const data = JSON.parse(content);

            set({
              scale: data.scale,
              position: data.position,
              items: data.items || [],
            });

            get().pushHistory();
            console.log('Board loaded successfully');
            alert('Board loaded successfully!');
          }
        };
        input.click();
      }
    } catch (error) {
      console.error('Failed to load board:', error);
      alert('Failed to load board: ' + error.message);
    }
  },

  exportBoard: async () => {
    try {
      const { contentLayerRef } = get();
      if (!contentLayerRef) {
        alert('Canvas not ready for export');
        return;
      }

      // Export to image using Konva's built-in method
      const uri = contentLayerRef.toDataURL({ pixelRatio: 2 });

      if (window.__TAURI__) {
        const { save } = await import('@tauri-apps/api/dialog');
        const { writeBinaryFile } = await import('@tauri-apps/api/fs');

        const filePath = await save({
          filters: [{ name: 'PNG Image', extensions: ['png'] }],
        });

        if (filePath) {
          // Convert data URL to binary
          const base64Data = uri.split(',')[1];
          const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          await writeBinaryFile(filePath, binaryData);
          console.log('Board exported successfully');
          alert('Board exported successfully!');
        }
      } else {
        // Web fallback: download image
        const link = document.createElement('a');
        link.download = `infiniteboard-${Date.now()}.png`;
        link.href = uri;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        console.log('Board exported successfully');
      }
    } catch (error) {
      console.error('Failed to export board:', error);
      alert('Failed to export board: ' + error.message);
    }
  }
}));

export default useStore;
