/**
 * P5: Causal Log Context
 * Manages causal logs with localStorage persistence and lifecycle management
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CausalLog, CausalLogSummary } from '../types/causalLog';

interface CausalLogContextType {
  logs: CausalLog[];
  createLog: (sessionId: string, input: CausalLog['input']) => string;
  getLog: (logId: string) => CausalLog | undefined;
  getLogBySessionId: (sessionId: string) => CausalLog | undefined;
  updateLog: (logId: string, updates: Partial<CausalLog>) => void;
  deleteLog: (logId: string) => void;
  clearAllLogs: () => void;
  getLogSummaries: () => CausalLogSummary[];
  exportLog: (logId: string) => string;
}

const CausalLogContext = createContext<CausalLogContextType | undefined>(undefined);

const STORAGE_KEY = 'airia-causal-logs';
const LOG_RETENTION_DAYS = 30;

// Privacy: sanitize PII from input
function sanitizeInput(input: any): any {
  if (!input) return input;
  
  // Keep only safe fields
  return {
    mood: input.mood,
    duration: input.duration,
    timestamp: input.timestamp,
    // Do NOT log full raw user text or personal data
    customInput: input.customInput ? '[user input - redacted for privacy]' : undefined,
    onboardingAnswers: input.onboardingAnswers ? '[onboarding data - summary only]' : undefined,
  };
}

// Remove logs older than retention period
function cleanupOldLogs(logs: CausalLog[]): CausalLog[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - LOG_RETENTION_DAYS);
  
  return logs.filter(log => {
    const logDate = new Date(log.createdAt);
    return logDate >= cutoffDate;
  });
}

export const CausalLogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<CausalLog[]>([]);

  // Load logs from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert date strings back to Date objects
        const logsWithDates = parsed.map((log: any) => ({
          ...log,
          createdAt: new Date(log.createdAt),
          input: {
            ...log.input,
            timestamp: new Date(log.input.timestamp),
          },
          analysis: log.analysis ? {
            ...log.analysis,
            timestamp: new Date(log.analysis.timestamp),
          } : undefined,
          imageGeneration: log.imageGeneration ? {
            ...log.imageGeneration,
            timestamp: new Date(log.imageGeneration.timestamp),
          } : undefined,
          musicGeneration: log.musicGeneration ? {
            ...log.musicGeneration,
            timestamp: new Date(log.musicGeneration.timestamp),
          } : undefined,
          album: log.album ? {
            ...log.album,
            timestamp: new Date(log.album.timestamp),
          } : undefined,
          errors: log.errors?.map((err: any) => ({
            ...err,
            timestamp: new Date(err.timestamp),
          })),
        }));
        
        // Cleanup old logs on load
        const cleanedLogs = cleanupOldLogs(logsWithDates);
        setLogs(cleanedLogs);
      }
    } catch (error) {
      console.error('[CausalLog] Failed to load logs from localStorage:', error);
    }
  }, []);

  // Save logs to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    } catch (error) {
      console.error('[CausalLog] Failed to save logs to localStorage:', error);
    }
  }, [logs]);

  const createLog = (sessionId: string, input: CausalLog['input']): string => {
    const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const newLog: CausalLog = {
      id: logId,
      sessionId,
      createdAt: new Date(),
      input: sanitizeInput(input),
      totalDuration: 0,
      success: false,
    };
    
    setLogs(prev => [...prev, newLog]);
    console.log('[CausalLog] Created log:', logId, 'for session:', sessionId);
    return logId;
  };

  const getLog = (logId: string): CausalLog | undefined => {
    return logs.find(log => log.id === logId);
  };

  const getLogBySessionId = (sessionId: string): CausalLog | undefined => {
    return logs.find(log => log.sessionId === sessionId);
  };

  const updateLog = (logId: string, updates: Partial<CausalLog>): void => {
    setLogs(prev => prev.map(log => {
      if (log.id === logId) {
        const updated = { ...log, ...updates };
        
        // Recalculate total duration if stages are present
        if (updated.analysis || updated.imageGeneration || updated.musicGeneration) {
          const durations = [
            updated.analysis?.duration || 0,
            updated.imageGeneration?.duration || 0,
            updated.musicGeneration?.duration || 0,
          ];
          updated.totalDuration = durations.reduce((sum, d) => sum + d, 0);
        }
        
        return updated;
      }
      return log;
    }));
    
    console.log('[CausalLog] Updated log:', logId);
  };

  const deleteLog = (logId: string): void => {
    setLogs(prev => prev.filter(log => log.id !== logId));
    console.log('[CausalLog] Deleted log:', logId);
  };

  const clearAllLogs = (): void => {
    setLogs([]);
    localStorage.removeItem(STORAGE_KEY);
    console.log('[CausalLog] Cleared all logs');
  };

  const getLogSummaries = (): CausalLogSummary[] => {
    return logs.map(log => ({
      id: log.id,
      sessionId: log.sessionId,
      createdAt: log.createdAt,
      success: log.success,
      totalDuration: log.totalDuration,
      albumId: log.album?.albumId,
    }));
  };

  const exportLog = (logId: string): string => {
    const log = getLog(logId);
    if (!log) {
      throw new Error(`Log ${logId} not found`);
    }
    return JSON.stringify(log, null, 2);
  };

  return (
    <CausalLogContext.Provider
      value={{
        logs,
        createLog,
        getLog,
        getLogBySessionId,
        updateLog,
        deleteLog,
        clearAllLogs,
        getLogSummaries,
        exportLog,
      }}
    >
      {children}
    </CausalLogContext.Provider>
  );
};

export const useCausalLog = () => {
  const context = useContext(CausalLogContext);
  if (context === undefined) {
    throw new Error('useCausalLog must be used within a CausalLogProvider');
  }
  return context;
};
