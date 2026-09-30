import express from 'express';

export const boundedJsonBody = express.json({ limit: '16mb' });
