-- Add refresh token rotation storage. Token values are never stored, only SHA-256 hashes.
CREATE TABLE `refresh_tokens` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `refresh_tokens_token_hash_key`(`token_hash`),
    INDEX `idx_refresh_tokens_user_id`(`user_id`),
    INDEX `idx_refresh_tokens_expires_at`(`expires_at`),
    INDEX `idx_refresh_tokens_revoked_at`(`revoked_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `refresh_tokens`
ADD CONSTRAINT `refresh_tokens_user_id_fkey`
FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- New trip metadata is additive and keeps existing synced trips valid.
ALTER TABLE `trips`
ADD COLUMN `travel_mode` ENUM('walking', 'biking', 'trekking') NOT NULL DEFAULT 'walking',
ADD COLUMN `offline_region_id` VARCHAR(255) NULL;
