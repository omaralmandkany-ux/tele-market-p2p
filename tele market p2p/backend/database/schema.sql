-- =============================================
-- Telegram Ad Marketplace - Complete MySQL Schema
-- =============================================
-- Run this file in phpMyAdmin or MySQL CLI to create/update the database
-- =============================================

-- Create Database
CREATE DATABASE IF NOT EXISTS ad_marketplace CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ad_marketplace;

-- =============================================
-- Users Table
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255) NULL,
    first_name VARCHAR(255) NULL,
    photo_url TEXT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    balance DECIMAL(18, 9) DEFAULT 0.000000000,
    wallet_address VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_telegram_id (telegram_id),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Channels Table
-- =============================================
CREATE TABLE IF NOT EXISTS channels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    telegram_id BIGINT UNIQUE NULL,
    username VARCHAR(255) UNIQUE NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT NULL,
    subscribers_count INT NULL,
    avg_views INT NULL,
    avg_reach INT NULL,
    premium_percentage DECIMAL(5, 2) NULL,
    language_stats JSON NULL,
    owner_id INT NOT NULL,
    is_verified TINYINT(1) DEFAULT 0,
    bot_is_admin TINYINT(1) DEFAULT 0,
    verification_code VARCHAR(100) NULL,
    categories JSON NULL,
    photo_url TEXT NULL,
    last_stats_update TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_owner (owner_id),
    INDEX idx_verified (is_verified),
    INDEX idx_username (username),
    INDEX idx_subscribers (subscribers_count),
    
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Channel Managers (Multi-Admin Support)
-- =============================================
CREATE TABLE IF NOT EXISTS channel_managers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    channel_id INT NOT NULL,
    user_id INT NOT NULL,
    telegram_id BIGINT NOT NULL,
    role ENUM('owner', 'admin', 'manager') DEFAULT 'manager',
    permissions JSON NULL,
    synced_from_telegram TINYINT(1) DEFAULT 0,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_channel_user (channel_id, user_id),
    INDEX idx_channel (channel_id),
    INDEX idx_user (user_id),
    
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Listings Table
-- =============================================
CREATE TABLE IF NOT EXISTS listings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    channel_id INT NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT NULL,
    price DECIMAL(18, 9) NOT NULL,
    currency VARCHAR(10) DEFAULT 'TON',
    duration_hours INT DEFAULT 24,
    format ENUM('post', 'story', 'repost', 'video', 'custom') DEFAULT 'post',
    format_details TEXT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_channel (channel_id),
    INDEX idx_active (is_active),
    INDEX idx_price (price),
    INDEX idx_format (format),
    
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Campaigns (Advertiser Requests)
-- =============================================
CREATE TABLE IF NOT EXISTS campaigns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    advertiser_id INT NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    budget_min DECIMAL(18, 9) NULL,
    budget_max DECIMAL(18, 9) NULL,
    target_subscribers_min INT NULL,
    target_subscribers_max INT NULL,
    target_categories JSON NULL,
    target_languages JSON NULL,
    preferred_format ENUM('post', 'story', 'repost', 'video', 'any') DEFAULT 'any',
    start_date DATE NULL,
    end_date DATE NULL,
    status ENUM('draft', 'active', 'paused', 'completed', 'cancelled') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_advertiser (advertiser_id),
    INDEX idx_status (status),
    INDEX idx_budget (budget_max),
    
    FOREIGN KEY (advertiser_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Campaign Applications
-- =============================================
CREATE TABLE IF NOT EXISTS campaign_applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    campaign_id INT NOT NULL,
    channel_id INT NOT NULL,
    applicant_id INT NOT NULL,
    proposed_price DECIMAL(18, 9) NOT NULL,
    message TEXT NULL,
    status ENUM('pending', 'accepted', 'rejected', 'withdrawn') DEFAULT 'pending',
    response_message TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP NULL,
    
    UNIQUE KEY unique_campaign_channel (campaign_id, channel_id),
    INDEX idx_campaign (campaign_id),
    INDEX idx_channel (channel_id),
    INDEX idx_applicant (applicant_id),
    INDEX idx_status (status),
    
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    FOREIGN KEY (applicant_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Deals Table (Escrow)
-- =============================================
CREATE TABLE IF NOT EXISTS deals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    listing_id INT NULL,
    campaign_id INT NULL,
    application_id INT NULL,
    advertiser_id INT NOT NULL,
    channel_owner_id INT NOT NULL,
    channel_id INT NOT NULL,
    status ENUM(
        'pending',
        'accepted',
        'rejected',
        'funded',
        'draft_pending',
        'draft_submitted',
        'draft_approved',
        'draft_rejected',
        'scheduled',
        'posting',
        'posted',
        'verifying',
        'completed',
        'disputed',
        'cancelled',
        'refunded',
        'expired'
    ) DEFAULT 'pending',
    escrow_amount DECIMAL(18, 9) NULL,
    escrow_wallet_address VARCHAR(100) NULL,
    ad_content TEXT NULL,
    ad_media_url TEXT NULL,
    ad_requirements TEXT NULL,
    scheduled_time DATETIME NULL,
    posted_message_id BIGINT NULL,
    posted_at DATETIME NULL,
    post_verified_count INT DEFAULT 0,
    last_verification_at DATETIME NULL,
    completed_at DATETIME NULL,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_listing (listing_id),
    INDEX idx_campaign (campaign_id),
    INDEX idx_advertiser (advertiser_id),
    INDEX idx_owner (channel_owner_id),
    INDEX idx_channel (channel_id),
    INDEX idx_status (status),
    INDEX idx_scheduled (scheduled_time),
    INDEX idx_expires (expires_at),
    
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE SET NULL,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
    FOREIGN KEY (application_id) REFERENCES campaign_applications(id) ON DELETE SET NULL,
    FOREIGN KEY (advertiser_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (channel_owner_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Creative Drafts (Approval Workflow)
-- =============================================
CREATE TABLE IF NOT EXISTS creative_drafts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    deal_id INT NOT NULL,
    version INT DEFAULT 1,
    content TEXT NOT NULL,
    media_url TEXT NULL,
    submitted_by INT NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'superseded') DEFAULT 'pending',
    feedback TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP NULL,
    reviewed_by INT NULL,
    
    INDEX idx_deal (deal_id),
    INDEX idx_status (status),
    INDEX idx_version (deal_id, version),
    
    FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE,
    FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Wallets (TON Simulation)
-- =============================================
CREATE TABLE IF NOT EXISTS wallets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    address VARCHAR(100) UNIQUE NOT NULL,
    type ENUM('main', 'escrow') DEFAULT 'main',
    balance DECIMAL(18, 9) DEFAULT 0.000000000,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user (user_id),
    INDEX idx_address (address),
    INDEX idx_type (type),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Escrow Wallets (Per-Deal)
-- =============================================
CREATE TABLE IF NOT EXISTS escrow_wallets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    deal_id INT UNIQUE NOT NULL,
    address VARCHAR(100) UNIQUE NOT NULL,
    balance DECIMAL(18, 9) DEFAULT 0.000000000,
    status ENUM('pending', 'funded', 'released', 'refunded') DEFAULT 'pending',
    funded_at TIMESTAMP NULL,
    released_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_deal (deal_id),
    INDEX idx_address (address),
    INDEX idx_status (status),
    
    FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Transactions Table
-- =============================================
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    deal_id INT NULL,
    from_user_id INT NULL,
    to_user_id INT NULL,
    from_wallet_address VARCHAR(100) NULL,
    to_wallet_address VARCHAR(100) NULL,
    amount DECIMAL(18, 9) NOT NULL,
    fee_amount DECIMAL(18, 9) DEFAULT 0.000000000,
    type ENUM('deposit', 'withdrawal', 'escrow_fund', 'escrow_release', 'refund', 'fee', 'transfer') NOT NULL,
    status ENUM('pending', 'processing', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
    tx_hash VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    
    INDEX idx_deal (deal_id),
    INDEX idx_from_user (from_user_id),
    INDEX idx_to_user (to_user_id),
    INDEX idx_type (type),
    INDEX idx_status (status),
    INDEX idx_tx_hash (tx_hash),
    
    FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL,
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Notifications Table
-- =============================================
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(100) NOT NULL,
    title VARCHAR(500) NOT NULL,
    message TEXT NULL,
    is_read TINYINT(1) DEFAULT 0,
    data JSON NULL,
    bot_message_id BIGINT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user (user_id),
    INDEX idx_unread (user_id, is_read),
    INDEX idx_type (type),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Post Verifications (Track Published Ads)
-- =============================================
CREATE TABLE IF NOT EXISTS post_verifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    deal_id INT NOT NULL,
    message_id BIGINT NOT NULL,
    channel_telegram_id BIGINT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    is_present TINYINT(1) DEFAULT 1,
    is_modified TINYINT(1) DEFAULT 0,
    check_count INT DEFAULT 0,
    last_check_at TIMESTAMP NULL,
    first_missing_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_deal_message (deal_id, message_id),
    INDEX idx_deal (deal_id),
    INDEX idx_present (is_present),
    
    FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Scheduled Tasks (For Cron Jobs)
-- =============================================
CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type ENUM('auto_post', 'verify_post', 'timeout_check', 'release_funds', 'stats_update') NOT NULL,
    target_id INT NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    scheduled_at DATETIME NOT NULL,
    executed_at DATETIME NULL,
    status ENUM('pending', 'processing', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
    result JSON NULL,
    error TEXT NULL,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_type (type),
    INDEX idx_scheduled (scheduled_at),
    INDEX idx_status (status),
    INDEX idx_target (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Summary of Tables
-- =============================================
-- Core:
--   1. users - Telegram users
--   2. channels - Registered channels
--   3. channel_managers - Multi-admin support
--   4. listings - Ad slot listings
--
-- Campaigns:
--   5. campaigns - Advertiser campaign briefs
--   6. campaign_applications - Channel owner applications
--
-- Deals:
--   7. deals - Escrow deals
--   8. creative_drafts - Approval workflow drafts
--
-- Payments:
--   9. wallets - User wallets
--   10. escrow_wallets - Per-deal escrow wallets
--   11. transactions - Payment history
--
-- Verification:
--   12. post_verifications - Track posted ads
--   13. scheduled_tasks - Background jobs
--   14. notifications - User notifications
-- =============================================
