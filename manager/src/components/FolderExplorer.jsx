import { useState, useMemo, useEffect } from 'react';

import { Folder, ChevronRight, ChevronDown, FolderOpen } from 'lucide-react';
import useBookmarkStore from '../store/useBookmarkStore';

/**
 * FolderExplorer Component
 * 
 * Renders a hierarchical tree view of native browser folders.
 * Built dynamically from the folder_path metadata of loaded bookmarks.
 */
function FolderExplorer() {
  const { allFolders, fetchFolders, selectedFolder, setSelectedFolder, clearFolder } = useBookmarkStore();
  const [expandedFolders, setExpandedFolders] = useState(new Set(['root']));

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);


  // Build tree structure from flat folder paths
  const folderTree = useMemo(() => {
    const root = { name: 'Root Bookmarks', path: null, children: {} };
    
    // Use allFolders instead of bookmarks to build the tree
    allFolders.forEach(folderPath => {
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
  }, [allFolders]);


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

  const renderNode = (node, depth = 0) => {
    const nodeKey = node.path || 'root';
    const isExpanded = expandedFolders.has(nodeKey);
    const hasChildren = Object.keys(node.children).length > 0;
    const isSelected = selectedFolder === node.path;

    return (
      <div key={nodeKey} className="select-none">
        <div 
          className={`flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer text-xs transition-all ${
            isSelected 
              ? 'bg-accent/10 text-accent font-semibold' 
              : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg hover:text-light-text dark:hover:text-dark-text'
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => node.path ? setSelectedFolder(node.path) : clearFolder()}
        >
          <div className="flex items-center gap-1.5 min-w-0">
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
    <div className="flex flex-col gap-1">
      {/* Root "All Bookmarks" - Now Collapsible */}
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

      {/* Dynamic Folder Tree - Only show if root is expanded */}
      {expandedFolders.has('root') && (
        <div className="mt-1 flex flex-col gap-0.5">
          {Object.values(folderTree.children)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(child => renderNode(child, 1))}
        </div>
      )}
    </div>
  );

}

export default FolderExplorer;
