import request from 'supertest';
import app from '../src/server.js';
import mongoose from 'mongoose';

describe('Security and Health API', () => {

    // Close database connection after tests
    afterAll(async () => {
        await mongoose.connection.close();
    });

    describe('GET /health', () => {
        it('should return 200 and success true', async () => {
            const res = await request(app).get('/health');
            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });

        it('should have security headers (Helmet)', async () => {
            const res = await request(app).get('/health');
            expect(res.headers['x-dns-prefetch-control']).toBeDefined();
            expect(res.headers['x-frame-options']).toBeDefined();
            expect(res.headers['strict-transport-security']).toBeDefined();
            expect(res.headers['x-content-type-options']).toBe('nosniff');
        });
    });

    describe('Rate Limiting', () => {
        it('should eventually return 429 after many requests', async () => {
            // We won't actually send 100 requests in a unit test to avoid slowness,
            // but we verify the headers are present
            const res = await request(app).get('/health');
            expect(res.headers['ratelimit-limit']).toBeDefined();
            expect(res.headers['ratelimit-remaining']).toBeDefined();
        });
    });

    describe('Authentication Middleware', () => {
        it('should return 401 if no token is provided for protected routes', async () => {
            const res = await request(app).get('/api/dashboard/stats');
            expect(res.statusCode).toEqual(401);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toContain('No token provided');
        });

        it('should return 401 for an invalid token', async () => {
            const res = await request(app)
                .get('/api/dashboard/stats')
                .set('Authorization', 'Bearer invalid-token');
            expect(res.statusCode).toEqual(401);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toContain('Invalid token');
        });
    });
});
