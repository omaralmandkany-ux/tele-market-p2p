// Escrow service - Legacy file, functionality moved to tonWallet.ts
// This file is kept for backwards compatibility but is no longer used

export const escrowService = {
    createDeal: async () => { throw new Error('Use tonWallet service'); },
    acceptDeal: async () => { throw new Error('Use tonWallet service'); },
    rejectDeal: async () => { throw new Error('Use tonWallet service'); },
    fundDeal: async () => { throw new Error('Use tonWallet service'); },
    markAsPosted: async () => { throw new Error('Use tonWallet service'); },
    completeDeal: async () => { throw new Error('Use tonWallet service'); },
    disputeDeal: async () => { throw new Error('Use tonWallet service'); },
    cancelDeal: async () => { throw new Error('Use tonWallet service'); },
};

export default escrowService;
