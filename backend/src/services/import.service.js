/**
 * Import Service
 *
 * Handles bulk bookmark imports and progress tracking
 */

import { v4 as uuidv4 } from 'uuid';

// In-memory store for import jobs (in production, use Redis)
const importJobs = new Map();

/**
 * Create a new import job
 */
export function createImportJob(userId, totalBookmarks) {
  const jobId = uuidv4();

  importJobs.set(jobId, {
    jobId,
    userId,
    totalBookmarks,
    processedBookmarks: 0,
    successfulBookmarks: 0,
    failedBookmarks: 0,
    status: 'in_progress', // in_progress, completed, failed
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  return jobId;
}

/**
 * Update import job progress
 */
export function updateImportJobProgress(jobId, updates) {
  const job = importJobs.get(jobId);

  if (!job) {
    throw new Error('Import job not found');
  }

  const updatedJob = {
    ...job,
    ...updates,
    updatedAt: new Date().toISOString()
  };

  importJobs.set(jobId, updatedJob);
  return updatedJob;
}

/**
 * Get import job status
 */
export function getImportJob(jobId) {
  return importJobs.get(jobId) || null;
}

/**
 * Get all import jobs for a user
 */
export function getUserImportJobs(userId) {
  const jobs = [];

  for (const [jobId, job] of importJobs.entries()) {
    if (job.userId === userId) {
      jobs.push(job);
    }
  }

  // Sort by created date, newest first
  return jobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Delete old completed jobs (cleanup)
 * Call this periodically to prevent memory leaks
 */
export function cleanupOldJobs(maxAgeMs = 24 * 60 * 60 * 1000) { // 24 hours default
  const now = Date.now();
  const deletedJobs = [];

  for (const [jobId, job] of importJobs.entries()) {
    const jobAge = now - new Date(job.createdAt).getTime();

    if (job.status === 'completed' && jobAge > maxAgeMs) {
      importJobs.delete(jobId);
      deletedJobs.push(jobId);
    }
  }

  return deletedJobs;
}
