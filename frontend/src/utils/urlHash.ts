/**
 * Utility functions for managing URL hash parameters
 * Format: #module=id1,id2,id3&otherModule=id4
 */

export type ModuleType = 'document' | 'file' | 'schema' | 'password' | 'task';

/**
 * Parse URL hash and return all module selections
 */
export function parseHash(): Record<ModuleType, string[]> {
  const hash = window.location.hash.substring(1); // Remove #
  const result: Record<ModuleType, string[]> = {
    document: [],
    file: [],
    schema: [],
    password: [],
    task: [],
  };

  if (!hash) return result;

  const params = hash.split('&');
  for (const param of params) {
    const [key, value] = param.split('=');
    if (key && value && key in result) {
      result[key as ModuleType] = value.split(',').filter(Boolean);
    }
  }

  return result;
}

/**
 * Get selected IDs for a specific module from URL hash
 */
export function getHashSelection(module: ModuleType): string[] {
  const allSelections = parseHash();
  return allSelections[module] || [];
}

/**
 * Update URL hash with new selection for a module
 */
export function setHashSelection(module: ModuleType, ids: string[]): void {
  const allSelections = parseHash();
  
  if (ids.length > 0) {
    allSelections[module] = ids;
  } else {
    delete allSelections[module];
  }

  // Build new hash string
  const hashParts: string[] = [];
  (Object.keys(allSelections) as ModuleType[]).forEach(key => {
    const moduleIds = allSelections[key];
    if (moduleIds && moduleIds.length > 0) {
      hashParts.push(`${key}=${moduleIds.join(',')}`);
    }
  });

  const newHash = hashParts.length > 0 ? `#${hashParts.join('&')}` : '';
  
  // Update URL without triggering navigation
  if (window.history.replaceState) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search + newHash);
  } else {
    window.location.hash = newHash;
  }
}

/**
 * Clear hash selection for a specific module
 */
export function clearHashSelection(module: ModuleType): void {
  setHashSelection(module, []);
}

/**
 * Listen to hash changes and call callback
 */
export function onHashChange(callback: (selections: Record<ModuleType, string[]>) => void): () => void {
  const handleHashChange = () => {
    callback(parseHash());
  };

  window.addEventListener('hashchange', handleHashChange);
  
  return () => {
    window.removeEventListener('hashchange', handleHashChange);
  };
}

