import { useState, useMemo, useEffect } from 'react';
import { Folder, ChevronRight, ChevronDown, FolderOpen, Pencil, Move, Trash2, X, Search } from 'lucide-react';
import useBookmarkStore from '../store/useBookmarkStore';

/**
 * FolderExplorer Component
 * 
 * Renders a hierarchical tree view of native browser folders.
 * Built dynamically from the folder_path metadata of loaded bookmarks.
 * Supports renaming, moving, and deleting/dissolving folders.
 */
function FolderExplorer() {
  const { 
    allFolders, 
    fetchFolders, 
    selectedFolder, 
    setSelectedFolder, 
    clearFolder,
    renameFolder,
    moveFolder,
    deleteFolder
  } = useBookmarkStore();

  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [folderSearch, setFolderSearch] = useState('');

  // Modal States
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState(null);

  const [moveTarget, setMoveTarget] = useState(null);
  const [moveParentPath, setMoveParentPath] = useState('');
  const [moveSaving, setMoveSaving] = useState(false);
  const [moveError, setMoveError] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBookmarksOption, setDeleteBookmarksOption] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  // Filter folder paths based on search query
  const filteredFolders = useMemo(() => {
    if (!folderSearch.trim()) return allFolders;
    const query = folderSearch.trim().toLowerCase();
    
    // Find all matching folders (match anywhere in the full folder path)
    const matches = allFolders.filter(path => {
      if (!path) return false;
      return path.toLowerCase().includes(query);
    });

    // Include all parent paths
    const results = new Set();
    matches.forEach(path => {
      const parts = path.split(' > ');
      let currentPath = '';
      parts.forEach(part => {
        currentPath = currentPath ? `${currentPath} > ${part}` : part;
        results.add(currentPath);
      });
    });

    return Array.from(results);
  }, [allFolders, folderSearch]);

  // Build tree structure from flat folder paths
  const folderTree = useMemo(() => {
    const root = { name: 'Root Bookmarks', path: null, children: {} };
    
    filteredFolders.forEach(folderPath => {
      if (!folderPath) return;
      
      const parts = folderPath.split(' > ');
      let current = root;
      let currentPath = '';
      
      parts.forEach((part) => {
        currentPath = currentPath ? `${currentPath} > ${part}` : part;
        if (!current.children[part]) {
          current.children[part] = { 
            name: part, 
            path: currentPath, 
            children: {} 
          };
        }
        current = current.children[part];
      });
    });
    
    return root;
  }, [filteredFolders]);

  const toggleExpand = (path, e) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedFolders);
    const key = path || 'root';
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedFolders(newExpanded);
  };

  // Click Handlers for actions
  const handleRenameClick = (node) => {
    setRenameTarget(node);
    setRenameValue(node.name);
    setRenameError(null);
  };

  const handleMoveClick = (node) => {
    setMoveTarget(node);
    setMoveParentPath('');
    setMoveError(null);
  };

  const handleDeleteClick = (node) => {
    setDeleteTarget(node);
    setDeleteBookmarksOption(false);
    setDeleteError(null);
  };

  // Submit operations
  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    if (!renameTarget || !renameValue.trim()) return;
    setRenameSaving(true);
    setRenameError(null);

    // Compute new full path
    const parts = renameTarget.path.split(' > ');
    parts[parts.length - 1] = renameValue.trim();
    const newPath = parts.join(' > ');

    const res = await renameFolder(renameTarget.path, newPath);
    setRenameSaving(false);
    if (res.success) {
      setRenameTarget(null);
      // If renamed active folder, update selected folder path
      if (selectedFolder === renameTarget.path) {
        setSelectedFolder(newPath);
      }
    } else {
      setRenameError(res.error || 'Failed to rename folder');
    }
  };

  const handleMoveSubmit = async (e) => {
    e.preventDefault();
    if (!moveTarget) return;
    setMoveSaving(true);
    setMoveError(null);

    const res = await moveFolder(moveTarget.path, moveParentPath || null);
    setMoveSaving(false);
    if (res.success) {
      setMoveTarget(null);
      // Compute new path of this folder to select it
      const pathParts = moveTarget.path.split(' > ');
      const folderName = pathParts[pathParts.length - 1];
      const newPath = !moveParentPath ? folderName : `${moveParentPath} > ${folderName}`;
      if (selectedFolder === moveTarget.path) {
        setSelectedFolder(newPath);
      }
    } else {
      setMoveError(res.error || 'Failed to move folder');
    }
  };

  const handleDeleteSubmit = async (e) => {
    e.preventDefault();
    if (!deleteTarget) return;
    setDeleteSaving(true);
    setDeleteError(null);

    const res = await deleteFolder(deleteTarget.path, deleteBookmarksOption);
    setDeleteSaving(false);
    if (res.success) {
      setDeleteTarget(null);
      // Clear selected folder if we just deleted/dissolved it
      if (selectedFolder === deleteTarget.path || selectedFolder?.startsWith(deleteTarget.path + ' > ')) {
        clearFolder();
      }
    } else {
      setDeleteError(res.error || 'Failed to delete folder');
    }
  };

  // Filter valid potential parents to move a folder under
  const validParentFolders = useMemo(() => {
    if (!moveTarget) return [];
    return allFolders.filter(path => 
      path !== moveTarget.path && 
      !path.startsWith(moveTarget.path + ' > ')
    );
  }, [allFolders, moveTarget]);

  const renderNode = (node, depth = 0) => {
    const nodeKey = node.path || 'root';
    const isExpanded = folderSearch.trim() ? true : expandedFolders.has(nodeKey);
    const hasChildren = Object.keys(node.children).length > 0;
    const isSelected = selectedFolder === node.path;

    return (
      <div key={nodeKey} className="select-none">
        <div 
          className={`group flex items-center justify-between py-1.5 px-2 rounded-md cursor-pointer text-xs transition-all ${
            isSelected 
              ? 'bg-accent/10 text-accent font-semibold' 
              : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg hover:text-light-text dark:hover:text-dark-text'
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => node.path ? setSelectedFolder(node.path) : clearFolder()}
        >
          <div className="flex items-center gap-1.5 min-w-0 mr-1">
            {hasChildren ? (
              <button 
                onClick={(e) => toggleExpand(node.path, e)}
                className="p-0.5 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-transform"
              >
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
            ) : (
              <div className="w-4" />
            )}
            
            {isSelected ? (
              <FolderOpen size={14} className="text-accent shrink-0" />
            ) : (
              <Folder size={14} className="text-light-text-secondary dark:text-dark-text-secondary shrink-0" />
            )}
            
            <span className="truncate">{node.name}</span>
          </div>

          {/* Action icons shown on hover */}
          {node.path && (
            <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRenameClick(node);
                }}
                title="Rename folder"
                className="p-1 text-light-text-secondary hover:text-accent dark:text-dark-text-secondary dark:hover:text-accent hover:bg-black/5 dark:hover:bg-white/5 rounded transition-all"
              >
                <Pencil size={11} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMoveClick(node);
                }}
                title="Move folder"
                className="p-1 text-light-text-secondary hover:text-accent dark:text-dark-text-secondary dark:hover:text-accent hover:bg-black/5 dark:hover:bg-white/5 rounded transition-all"
              >
                <Move size={11} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteClick(node);
                }}
                title="Delete folder"
                className="p-1 text-light-text-secondary hover:text-red-500 dark:text-dark-text-secondary dark:hover:text-red-400 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-all"
              >
                <Trash2 size={11} />
              </button>
            </div>
          )}
        </div>

        {isExpanded && hasChildren && (
          <div className="flex flex-col gap-0.5 mt-0.5">
            {Object.values(node.children)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-1 relative">
      {/* Folder Search input */}
      <div className="relative mb-3 group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-light-text-secondary group-focus-within:text-accent transition-colors" />
        <input
          type="text"
          placeholder="Filter folders..."
          value={folderSearch}
          onChange={(e) => setFolderSearch(e.target.value)}
          className="w-full pl-9 pr-8 py-1.5 text-xs bg-light-bg/50 dark:bg-dark-bg/50 border border-light-border dark:border-dark-border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
        />
        {folderSearch && (
          <button 
            type="button"
            onClick={() => setFolderSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-light-text-secondary hover:text-accent bg-light-bg dark:bg-dark-bg rounded-md shadow-sm"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Root "All Bookmarks" */}
      <div 
        className={`flex items-center justify-between py-1.5 px-2 rounded-md cursor-pointer text-xs transition-all ${
          selectedFolder === null 
            ? 'bg-accent/10 text-accent font-semibold' 
            : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg'
        }`}
        onClick={clearFolder}
      >
        <div className="flex items-center gap-2 min-w-0">
          <button 
            onClick={(e) => toggleExpand('root', e)}
            className="p-0.5 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-transform"
          >
            {expandedFolders.has('root') ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
          <FolderOpen size={14} className={selectedFolder === null ? 'text-accent' : 'text-light-text-secondary'} />
          <span className="truncate">All Bookmarks</span>
        </div>
      </div>

      {/* Dynamic Folder Tree */}
      {expandedFolders.has('root') && (
        <div className="mt-1 flex flex-col gap-0.5">
          {Object.values(folderTree.children)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(child => renderNode(child, 1))}
        </div>
      )}

      {/* RENAME MODAL */}
      {renameTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="bg-light-card dark:bg-dark-card rounded-lg shadow-xl p-5 max-w-sm w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-light-text dark:text-dark-text">Rename Folder</h3>
              <button onClick={() => setRenameTarget(null)} className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleRenameSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">
                  Folder Name
                </label>
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="input w-full py-1.5 px-3 text-xs"
                  placeholder="New folder name"
                  required
                  autoFocus
                />
              </div>
              {renameError && (
                <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/20 p-2 rounded">
                  {renameError}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRenameTarget(null)}
                  className="px-3 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/5 rounded-md"
                  disabled={renameSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-accent text-white hover:bg-accent-dark rounded-md font-medium flex items-center gap-1.5 disabled:opacity-50"
                  disabled={renameSaving}
                >
                  {renameSaving && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MOVE MODAL */}
      {moveTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="bg-light-card dark:bg-dark-card rounded-lg shadow-xl p-5 max-w-sm w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-light-text dark:text-dark-text">Move Folder</h3>
              <button onClick={() => setMoveTarget(null)} className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleMoveSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">
                  Select Parent Folder
                </label>
                <select
                  value={moveParentPath}
                  onChange={(e) => setMoveParentPath(e.target.value)}
                  className="input w-full py-1.5 px-3 text-xs bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md"
                >
                  <option value="">Root (Top Level)</option>
                  {validParentFolders
                    .sort((a, b) => a.localeCompare(b))
                    .map(path => (
                      <option key={path} value={path}>
                        {path}
                      </option>
                    ))
                  }
                </select>
              </div>
              {moveError && (
                <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/20 p-2 rounded">
                  {moveError}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMoveTarget(null)}
                  className="px-3 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/5 rounded-md"
                  disabled={moveSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-accent text-white hover:bg-accent-dark rounded-md font-medium flex items-center gap-1.5 disabled:opacity-50"
                  disabled={moveSaving}
                >
                  {moveSaving && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  Move
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="bg-light-card dark:bg-dark-card rounded-lg shadow-xl p-5 max-w-sm w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-red-500 dark:text-red-400">Delete Folder</h3>
              <button onClick={() => setDeleteTarget(null)} className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleDeleteSubmit} className="space-y-4">
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                How do you want to handle the folder <span className="font-semibold text-light-text dark:text-dark-text">"{deleteTarget.name}"</span>?
              </p>
              
              <div className="space-y-3 pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                  <input
                    type="radio"
                    name="deleteOption"
                    checked={!deleteBookmarksOption}
                    onChange={() => setDeleteBookmarksOption(false)}
                    className="mt-0.5 text-accent focus:ring-accent"
                  />
                  <div>
                    <span className="font-medium text-light-text dark:text-dark-text">Dissolve folder</span>
                    <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                      Keeps all bookmarks but removes them from this folder.
                    </p>
                  </div>
                </label>
                
                <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                  <input
                    type="radio"
                    name="deleteOption"
                    checked={deleteBookmarksOption}
                    onChange={() => setDeleteBookmarksOption(true)}
                    className="mt-0.5 text-accent focus:ring-accent"
                  />
                  <div>
                    <span className="font-medium text-red-500 dark:text-red-400">Delete folder & bookmarks</span>
                    <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                      Permanently deletes the folder and all bookmarks inside it.
                    </p>
                  </div>
                </label>
              </div>

              {deleteError && (
                <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/20 p-2 rounded">
                  {deleteError}
                </div>
              )}
              
              <div className="flex justify-end gap-2 pt-4 border-t border-light-border dark:border-dark-border">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-3 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/5 rounded-md"
                  disabled={deleteSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-1.5 text-xs text-white rounded-md font-medium flex items-center gap-1.5 disabled:opacity-50 ${
                    deleteBookmarksOption 
                      ? 'bg-red-500 hover:bg-red-600' 
                      : 'bg-accent hover:bg-accent-dark'
                  }`}
                  disabled={deleteSaving}
                >
                  {deleteSaving && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default FolderExplorer;
