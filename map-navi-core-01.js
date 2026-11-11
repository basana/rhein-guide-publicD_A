(function (root) {
  'use strict';

  function createInitialState(defaultTargetNodeId) {
    return {
      location: { status: 'idle', coords: null, updatedAt: null },
      intent: {
        selectedNodeId: null,
        activeCategory: null,
        categoryTargetNodeId: null,
        searchQuery: '',
        searchTargetNodeId: null
      },
      camera: { mode: 'tourist-follow' },
      display: { defaultTargetNodeId: defaultTargetNodeId || null }
    };
  }

  function reducer(state, action) {
    if (!state || !action || !action.type) return state;

    switch (action.type) {
      case 'LOCATION_UPDATED':
        return {
          ...state,
          location: {
            status: 'available',
            coords: { lat: action.lat, lng: action.lng },
            updatedAt: action.updatedAt || null
          }
        };

      case 'LOCATION_UNAVAILABLE':
        return {
          ...state,
          location: { status: 'unavailable', coords: null, updatedAt: null }
        };

      case 'NODE_SELECTED':
        return {
          ...state,
          intent: { ...state.intent, selectedNodeId: action.nodeId || null }
        };

      case 'NODE_SELECTION_CLEARED':
        return {
          ...state,
          intent: { ...state.intent, selectedNodeId: null }
        };

      case 'CATEGORY_ACTIVATED':
        return {
          ...state,
          intent: {
            ...state.intent,
            activeCategory: action.category || null,
            categoryTargetNodeId: action.targetNodeId || null
          }
        };

      case 'SEARCH_ACTIVATED':
        return {
          ...state,
          intent: {
            ...state.intent,
            searchQuery: action.query || '',
            searchTargetNodeId: action.targetNodeId || null
          }
        };

      case 'INTENT_CLEARED':
        return {
          ...state,
          intent: {
            selectedNodeId: null,
            activeCategory: null,
            categoryTargetNodeId: null,
            searchQuery: '',
            searchTargetNodeId: null
          }
        };

      case 'CAMERA_MODE_SET':
        if (action.mode !== 'tourist-follow' && action.mode !== 'free-view') return state;
        return { ...state, camera: { mode: action.mode } };

      case 'USER_PANNED':
        return { ...state, camera: { mode: 'free-view' } };

      default:
        return state;
    }
  }

  function getActiveTargetId(state) {
    const intent = state.intent;
    return intent.selectedNodeId ||
      intent.searchTargetNodeId ||
      intent.categoryTargetNodeId ||
      state.display.defaultTargetNodeId ||
      null;
  }

  function shouldFollowUser(state) {
    return state.camera.mode === 'tourist-follow' &&
      state.location.status === 'available' &&
      !!state.location.coords;
  }

  function getHighlightLevels(selectedNodeId, edges, maxDepth) {
    const depthLimit = Number.isInteger(maxDepth) ? Math.max(0, maxDepth) : 2;
    if (!selectedNodeId) return {};

    const adjacency = new Map();
    (edges || []).forEach(function (edge) {
      const from = edge.source || edge.from || edge.a;
      const to = edge.target || edge.to || edge.b;
      if (!from || !to) return;
      if (!adjacency.has(from)) adjacency.set(from, []);
      if (!adjacency.has(to)) adjacency.set(to, []);
      adjacency.get(from).push(to);
      adjacency.get(to).push(from);
    });

    const levels = { [selectedNodeId]: 0 };
    const queue = [selectedNodeId];

    while (queue.length) {
      const current = queue.shift();
      const nextDepth = levels[current] + 1;
      if (nextDepth > depthLimit) continue;

      (adjacency.get(current) || []).forEach(function (neighbor) {
        if (Object.prototype.hasOwnProperty.call(levels, neighbor)) return;
        levels[neighbor] = nextDepth;
        queue.push(neighbor);
      });
    }

    return levels;
  }

  const api = {
    createInitialState: createInitialState,
    reducer: reducer,
    getActiveTargetId: getActiveTargetId,
    shouldFollowUser: shouldFollowUser,
    getHighlightLevels: getHighlightLevels
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MapNaviCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
