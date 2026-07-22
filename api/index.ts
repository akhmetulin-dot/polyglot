/**
 * Vercel Serverless Function — wraps the Express app.
 * Vercel routes all /api/* requests here automatically via vercel.json rewrites.
 */
import app from '../artifacts/api-server/src/app';

export default app;
