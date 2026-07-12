/**
 * Authentication Routes
 *
 * Handles user registration and login via Supabase Auth
 */

import { Router } from 'express';
import { getSupabaseClient, supabaseAdmin } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { deleteAllUserPoints } from '../services/qdrant.service.js';

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user with email and password
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email and password are required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Password must be at least 8 characters'
      });
    }

    // Register user with request-scoped Supabase client
    const supabaseClient = getSupabaseClient();
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || email.split('@')[0]
        },
        emailRedirectTo: process.env.MANAGER_BASE_URL || undefined
      }
    });

    if (error) {
      console.error('Registration error:', error);
      return res.status(400).json({
        error: 'Registration Failed',
        message: error.message
      });
    }

    // Return user info and session
    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name
      },
      session: {
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
        expires_at: data.session?.expires_at
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Registration failed'
    });
  }
});

/**
 * POST /api/auth/login
 * Login existing user with email and password
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email and password are required'
      });
    }

    // Sign in with request-scoped Supabase client
    const supabaseClient = getSupabaseClient();
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Login error:', error);
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid email or password'
      });
    }

    // Return user info and session
    res.json({
      message: 'Login successful',
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Login failed'
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Refresh token is required'
      });
    }

    // Refresh session with request-scoped Supabase client
    const supabaseClient = getSupabaseClient();
    const { data, error } = await supabaseClient.auth.refreshSession({
      refresh_token
    });

    if (error) {
      return res.status(401).json({
        error: 'Refresh Failed',
        message: 'Invalid or expired refresh token'
      });
    }

    res.json({
      message: 'Token refreshed successfully',
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      }
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Token refresh failed'
    });
  }
});

/**
 * POST /api/auth/me
 * Get current user info (protected route - requires authentication)
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    // User object is already attached by requireAuth middleware
    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.user_metadata?.name,
        created_at: req.user.created_at
      }
    });
  } catch (error) {
    console.error('Get user info error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get user info'
    });
  }
});

/**
 * POST /api/auth/oauth-callback
 * Exchange a raw provider session for Supabase access tokens
 */
router.post('/oauth-callback', async (req, res) => {
  try {
    const { access_token, refresh_token } = req.body;

    if (!access_token) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Access token is required'
      });
    }

    // Set the session on the server-side request-scoped supabase client
    const supabaseClient = getSupabaseClient();
    const { data: { user }, error } = await supabaseClient.auth.getUser(access_token);

    if (error || !user) {
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid access token'
      });
    }

    res.json({
      message: 'OAuth authentication successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.email.split('@')[0]
      },
      session: {
        access_token,
        refresh_token: refresh_token || null
      }
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'OAuth callback exchange failed'
    });
  }
});

/**
 * DELETE /api/auth/delete-account
 * Initiates soft deletion (30 days retention) or immediate account wipe
 */
router.delete('/delete-account', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const retentionDays = parseInt(req.query.retentionDays || req.body.retentionDays || '0', 10);

    console.log(`[Auth] Account deletion requested for user ${userId} (retention: ${retentionDays} days)...`);

    if (retentionDays === 30) {
      // Soft Delete: Set metadata scheduled_deletion_at
      const scheduledDeletionAt = new Date();
      scheduledDeletionAt.setDate(scheduledDeletionAt.getDate() + 30);

      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
          scheduled_deletion_at: scheduledDeletionAt.toISOString()
        }
      });

      if (error) {
        throw error;
      }

      console.log(`[Auth] User ${userId} scheduled for deletion on ${scheduledDeletionAt}`);
      return res.json({
        status: 'pending_deletion',
        scheduled_deletion_at: scheduledDeletionAt.toISOString(),
        message: 'Account scheduled for deletion. You have a 30-day grace period to restore your account.'
      });
    } else {
      // Immediate Permanent Delete
      console.log(`[Auth] Wiping user ${userId} data permanently...`);

      // 1. Delete Qdrant vectors first
      try {
        await deleteAllUserPoints(userId);
        console.log(`[Auth] Deleted Qdrant vectors for ${userId}`);
      } catch (qdErr) {
        console.error(`[Auth] Qdrant deletion failed for user ${userId}:`, qdErr);
        // Continue to delete from auth so user registration state is unblocked
      }

      // 2. Delete Supabase user (cascades to DB tables via RLS/FKs)
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) {
        throw error;
      }

      console.log(`[Auth] Successfully deleted user account ${userId} permanently.`);
      return res.json({
        status: 'deleted',
        message: 'Your account and all associated data have been permanently deleted.'
      });
    }
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process account deletion: ' + error.message
    });
  }
});

/**
 * POST /api/auth/reactivate-account
 * Restores an account scheduled for deletion
 */
router.post('/reactivate-account', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`[Auth] Restoring account for user ${userId}...`);

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        scheduled_deletion_at: null
      }
    });

    if (error) {
      throw error;
    }

    console.log(`[Auth] Account for user ${userId} successfully reactivated.`);
    res.json({
      status: 'active',
      message: 'Your account has been successfully reactivated. Welcome back!'
    });
  } catch (error) {
    console.error('Account reactivation error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to reactivate account: ' + error.message
    });
  }
});

/**
 * POST /api/auth/feedback
 * Submit user feedback to database
 */
router.post('/feedback', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, subject, message } = req.body;

    if (!type || !subject || !message) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Type, subject, and message are required'
      });
    }

    console.log(`[Feedback] Submitting feedback from user ${userId}...`);

    const { data, error } = await supabaseAdmin
      .from('user_feedback')
      .insert({
        user_id: userId,
        type,
        subject,
        message
      })
      .select();

    if (error) {
      throw error;
    }

    console.log(`[Feedback] Successfully saved feedback. ID: ${data[0]?.id}`);
    res.status(201).json({
      message: 'Feedback submitted successfully',
      feedbackId: data[0]?.id
    });
  } catch (error) {
    console.error('Feedback submission error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to submit feedback: ' + error.message
    });
  }
});

export default router;
