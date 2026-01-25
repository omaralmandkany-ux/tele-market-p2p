// Verification service - Legacy file, functionality moved to channels.ts route
// This file is kept for backwards compatibility

import crypto from 'crypto';

export function generateVerificationCode(): string {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
}

export const verificationService = {
    generateCode: generateVerificationCode,
    startVerification: async () => { throw new Error('Use channels route'); },
    confirmVerification: async () => { throw new Error('Use channels route'); },
};

export default verificationService;
