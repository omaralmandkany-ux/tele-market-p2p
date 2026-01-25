import crypto from 'crypto';
import { walletHelpers, transactionHelpers, userHelpers, dealHelpers, notificationHelpers } from '../database/db.js';

// =============================================
// TON Wallet Simulation
// =============================================
// Note: This is a SIMULATION for MVP purposes.
// In production, integrate with real TON SDK (@ton/ton)

const PLATFORM_FEE = 0.05; // 5% platform fee

// =============================================
// Generate TON-like wallet address
// =============================================
export function generateWalletAddress(type: 'user' | 'escrow'): string {
    const prefix = type === 'user' ? 'UQ' : 'EQ';
    const randomPart = crypto.randomBytes(24).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 46);
    return `${prefix}${randomPart}`;
}

// =============================================
// Get or create user wallet
// =============================================
export async function getOrCreateUserWallet(userId: number): Promise<{ address: string; balance: number }> {
    let wallet = await walletHelpers.getByUser(userId);

    if (!wallet) {
        const result = await walletHelpers.createForUser(userId);
        wallet = { id: result.id, address: result.address, balance: 0, user_id: userId };
    }

    return { address: wallet.address, balance: wallet.balance };
}

// =============================================
// Create escrow wallet for deal
// =============================================
export async function createEscrowWallet(dealId: number): Promise<{ address: string }> {
    const existing = await walletHelpers.getEscrowWallet(dealId);
    if (existing) {
        return { address: existing.address };
    }

    const result = await walletHelpers.createEscrowWallet(dealId);
    return { address: result.address };
}

// =============================================
// Simulate deposit (for testing)
// =============================================
export async function simulateDeposit(
    userId: number,
    amount: number
): Promise<{ success: boolean; tx_hash: string; new_balance: number }> {
    if (amount <= 0) {
        throw new Error('Amount must be positive');
    }

    const txHash = 'tx_' + crypto.randomBytes(32).toString('hex');

    // Update user balance
    await userHelpers.updateBalance(userId, amount);

    // Get wallet
    const wallet = await getOrCreateUserWallet(userId);

    // Create transaction record
    await transactionHelpers.create({
        to_user_id: userId,
        to_wallet_address: wallet.address,
        amount,
        type: 'deposit',
        status: 'completed',
        tx_hash: txHash,
    });

    const user = await userHelpers.getById(userId);

    return {
        success: true,
        tx_hash: txHash,
        new_balance: user.balance,
    };
}

// =============================================
// Fund escrow for deal
// =============================================
export async function fundEscrow(
    dealId: number,
    advertiserId: number
): Promise<{ success: boolean; escrow_address: string; tx_hash: string }> {
    const deal = await dealHelpers.getById(dealId);

    if (!deal) {
        throw new Error('Deal not found');
    }

    if (deal.advertiser_id !== advertiserId) {
        throw new Error('Not authorized');
    }

    if (deal.status !== 'accepted') {
        throw new Error('Deal must be accepted before funding');
    }

    const user = await userHelpers.getById(advertiserId);

    if (user.balance < deal.escrow_amount) {
        throw new Error('Insufficient balance');
    }

    // Create escrow wallet
    const escrowWallet = await createEscrowWallet(dealId);

    // Deduct from user balance
    await userHelpers.updateBalance(advertiserId, -deal.escrow_amount);

    // Fund escrow
    await walletHelpers.fundEscrow(dealId, deal.escrow_amount);

    const txHash = 'tx_' + crypto.randomBytes(32).toString('hex');

    // Create transaction
    await transactionHelpers.create({
        deal_id: dealId,
        from_user_id: advertiserId,
        to_wallet_address: escrowWallet.address,
        amount: deal.escrow_amount,
        type: 'escrow_fund',
        status: 'completed',
        tx_hash: txHash,
    });

    // Update deal
    await dealHelpers.updateStatus(dealId, 'funded', {
        escrow_wallet_address: escrowWallet.address,
    });

    // Notify channel owner
    await notificationHelpers.create({
        user_id: deal.channel_owner_id,
        type: 'deal_funded',
        title: 'Deal Funded! 💰',
        message: `${deal.escrow_amount} TON has been deposited to escrow. Please submit your creative draft.`,
        data: JSON.stringify({ deal_id: dealId }),
    });

    return {
        success: true,
        escrow_address: escrowWallet.address,
        tx_hash: txHash,
    };
}

// =============================================
// Release escrow funds to channel owner
// =============================================
export async function releaseEscrow(dealId: number): Promise<{ success: boolean; tx_hash: string; payout: number }> {
    const deal = await dealHelpers.getById(dealId);

    if (!deal) {
        throw new Error('Deal not found');
    }

    const escrowWallet = await walletHelpers.getEscrowWallet(dealId);

    if (!escrowWallet || escrowWallet.status !== 'funded') {
        throw new Error('Escrow not funded');
    }

    // Calculate amounts
    const fee = deal.escrow_amount * PLATFORM_FEE;
    const payout = deal.escrow_amount - fee;

    // Release to channel owner
    await userHelpers.updateBalance(deal.channel_owner_id, payout);
    await walletHelpers.releaseEscrow(dealId);

    const txHash = 'tx_' + crypto.randomBytes(32).toString('hex');

    // Create transaction
    await transactionHelpers.create({
        deal_id: dealId,
        from_wallet_address: escrowWallet.address,
        to_user_id: deal.channel_owner_id,
        amount: payout,
        fee_amount: fee,
        type: 'escrow_release',
        status: 'completed',
        tx_hash: txHash,
    });

    return {
        success: true,
        tx_hash: txHash,
        payout,
    };
}

// =============================================
// Refund escrow to advertiser
// =============================================
export async function refundEscrow(dealId: number): Promise<{ success: boolean; tx_hash: string; refund: number }> {
    const deal = await dealHelpers.getById(dealId);

    if (!deal) {
        throw new Error('Deal not found');
    }

    const escrowWallet = await walletHelpers.getEscrowWallet(dealId);

    if (!escrowWallet || escrowWallet.status !== 'funded') {
        throw new Error('Escrow not funded');
    }

    // Refund to advertiser
    await userHelpers.updateBalance(deal.advertiser_id, deal.escrow_amount);
    await walletHelpers.refundEscrow(dealId);

    const txHash = 'tx_' + crypto.randomBytes(32).toString('hex');

    // Create transaction
    await transactionHelpers.create({
        deal_id: dealId,
        from_wallet_address: escrowWallet.address,
        to_user_id: deal.advertiser_id,
        amount: deal.escrow_amount,
        type: 'refund',
        status: 'completed',
        tx_hash: txHash,
    });

    // Notify advertiser
    await notificationHelpers.create({
        user_id: deal.advertiser_id,
        type: 'funds_refunded',
        title: 'Funds Refunded 💸',
        message: `${deal.escrow_amount} TON has been refunded to your balance.`,
        data: JSON.stringify({ deal_id: dealId }),
    });

    return {
        success: true,
        tx_hash: txHash,
        refund: deal.escrow_amount,
    };
}

// =============================================
// Get wallet info
// =============================================
export async function getWalletInfo(userId: number): Promise<{
    address: string;
    balance: number;
    transactions: any[];
}> {
    const wallet = await getOrCreateUserWallet(userId);
    const user = await userHelpers.getById(userId);
    const transactions = await transactionHelpers.getByUser(userId, 20);

    return {
        address: wallet.address,
        balance: user.balance,
        transactions,
    };
}

// =============================================
// Withdraw simulation
// =============================================
export async function simulateWithdraw(
    userId: number,
    amount: number,
    toAddress: string
): Promise<{ success: boolean; tx_hash: string }> {
    const user = await userHelpers.getById(userId);

    if (user.balance < amount) {
        throw new Error('Insufficient balance');
    }

    await userHelpers.updateBalance(userId, -amount);

    const txHash = 'tx_' + crypto.randomBytes(32).toString('hex');

    const wallet = await getOrCreateUserWallet(userId);

    await transactionHelpers.create({
        from_user_id: userId,
        from_wallet_address: wallet.address,
        to_wallet_address: toAddress,
        amount,
        type: 'withdrawal',
        status: 'completed',
        tx_hash: txHash,
    });

    return {
        success: true,
        tx_hash: txHash,
    };
}

export default {
    generateWalletAddress,
    getOrCreateUserWallet,
    createEscrowWallet,
    simulateDeposit,
    fundEscrow,
    releaseEscrow,
    refundEscrow,
    getWalletInfo,
    simulateWithdraw,
};
