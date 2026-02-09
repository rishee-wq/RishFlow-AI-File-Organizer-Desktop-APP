/**
 * PyWebView API Bridge
 * This module provides a bridge to communicate with the Python backend via pywebview
 */

interface PyWebViewAPI {
  browse_folder: (title: string) => Promise<string | { error: string }>;
  start_organizing: (source: string, dest: string, mode: string, categories: any[]) => Promise<any>;
  scan_source: (folder: string) => Promise<any>;
  get_logs: () => Promise<any>;
  get_folder_stats: (folder: string) => Promise<any>;
  find_duplicates: (folder: string) => Promise<any>;
  revert_last: () => Promise<any>;
  query_ai: (folder: string, query: string) => Promise<any>;
  start_index_for_ai: (folder: string) => Promise<any>;
  get_ai_index_status: () => Promise<any>;
  index_for_ai: (folder: string) => Promise<any>;
  scan_organized_files: (rootPath: string) => Promise<any>;
  save_state: (key: string, value: any) => Promise<any>;
  load_state: (key: string) => Promise<any>;
  clear_activity_logs: () => Promise<any>;
}

declare global {
  interface Window {
    pywebview?: {
      api: PyWebViewAPI;
      ready?: Promise<void>;
    };
  }
}

/**
 * Get the PyWebView API
 * Handles both development and production environments
 */
export async function getPyWebViewAPI(): Promise<PyWebViewAPI | null> {
  // If API is already available, return it
  if (window.pywebview?.api) {
    return window.pywebview.api;
  }

  // If ready promise is available, wait for it
  if (window.pywebview?.ready) {
    await window.pywebview.ready;
    return window.pywebview.api || null;
  }

  // Wait for pywebviewready event
  return new Promise((resolve) => {
    const handleReady = () => {
      window.removeEventListener('pywebviewready', handleReady);
      resolve(window.pywebview?.api || null);
    };

    window.addEventListener('pywebviewready', handleReady);

    // Timeout after 3 seconds if not in pywebview environment
    setTimeout(() => {
      window.removeEventListener('pywebviewready', handleReady);
      // Double check if it became available during timeout
      if (window.pywebview?.api) {
        resolve(window.pywebview.api);
      } else {
        console.warn('PyWebView initialization timed out');
        resolve(null);
      }
    }, 3000);
  });
}

/**
 * Check if we're running in pywebview environment
 */
export function isInPyWebView(): boolean {
  return typeof window !== 'undefined' && !!window.pywebview;
}

/**
 * API wrapper with error handling
 */
export class PythonAPIClient {
  private api: PyWebViewAPI | null = null;

  async initialize(): Promise<void> {
    this.api = await getPyWebViewAPI();
  }

  async browseFolder(title = 'Select Folder'): Promise<string> {
    if (!this.api) throw new Error('Python API not available');
    const result = await this.api.browse_folder(title);

    // Handle error objects
    if (typeof result === 'object' && 'error' in result) {
      throw new Error(result.error);
    }

    // Handle empty string (user cancelled)
    if (!result || result === '') {
      throw new Error('No folder selected');
    }

    return result;
  }

  async startOrganizing(source: string, dest: string, mode: string, categories: any[] = []): Promise<any> {
    if (!this.api) throw new Error('Python API not available');
    return this.api.start_organizing(source, dest, mode, categories);
  }

  async scanSource(folder: string): Promise<any> {
    if (!this.api) throw new Error('Python API not available');
    return this.api.scan_source(folder);
  }

  async getLogs(): Promise<any> {
    if (!this.api) throw new Error('Python API not available');
    return this.api.get_logs();
  }

  async getFolderStats(folder: string): Promise<any> {
    if (!this.api) throw new Error('Python API not available');
    return this.api.get_folder_stats(folder);
  }

  async findDuplicates(folder: string): Promise<any> {
    if (!this.api) throw new Error('Python API not available');
    return this.api.find_duplicates(folder);
  }

  async revertLast(): Promise<any> {
    if (!this.api) throw new Error('Python API not available');
    return this.api.revert_last();
  }

  async queryAI(folder: string, query: string): Promise<any> {
    if (!this.api) throw new Error('Python API not available');
    return this.api.query_ai(folder, query);
  }

  async startIndexForAI(folder: string): Promise<any> {
    if (!this.api) throw new Error('Python API not available');
    return this.api.start_index_for_ai(folder);
  }

  async getAIIndexStatus(): Promise<any> {
    if (!this.api) throw new Error('Python API not available');
    return this.api.get_ai_index_status();
  }

  async indexForAI(folder: string): Promise<any> {
    if (!this.api) throw new Error('Python API not available');
    return this.api.index_for_ai(folder);
  }

  async scanOrganizedFiles(rootPath: string): Promise<any> {
    if (!this.api) throw new Error('Python API not available');
    return this.api.scan_organized_files(rootPath);
  }

  async saveState(key: string, value: any): Promise<any> {
    if (!this.api) throw new Error('Python API not available');
    return this.api.save_state(key, value);
  }

  async loadState(key: string): Promise<any> {
    if (!this.api) throw new Error('Python API not available');
    return this.api.load_state(key);
  }

  async clearActivityLogs(): Promise<any> {
    if (!this.api) throw new Error('Python API not available');
    return this.api.clear_activity_logs();
  }
}

// Export a singleton instance
export const pythonAPI = new PythonAPIClient();
