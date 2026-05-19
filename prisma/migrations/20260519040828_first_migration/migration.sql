-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL,
    `google_id` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `avatar_url` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_google_id_key`(`google_id`),
    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trips` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `local_trip_id` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('draft', 'active', 'paused', 'completed', 'interrupted', 'deleted') NOT NULL DEFAULT 'completed',
    `started_at` DATETIME(3) NOT NULL,
    `ended_at` DATETIME(3) NULL,
    `duration_seconds` INTEGER NOT NULL DEFAULT 0,
    `total_distance_meters` DOUBLE NOT NULL DEFAULT 0,
    `avg_speed_mps` DOUBLE NOT NULL DEFAULT 0,
    `max_speed_mps` DOUBLE NOT NULL DEFAULT 0,
    `min_elevation_meters` DOUBLE NULL,
    `max_elevation_meters` DOUBLE NULL,
    `start_lat` DOUBLE NULL,
    `start_lng` DOUBLE NULL,
    `end_lat` DOUBLE NULL,
    `end_lng` DOUBLE NULL,
    `point_count` INTEGER NOT NULL DEFAULT 0,
    `sync_status` ENUM('pending', 'syncing', 'synced', 'failed') NOT NULL DEFAULT 'synced',
    `uploaded_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_trips_user_id`(`user_id`),
    INDEX `idx_trips_started_at`(`started_at`),
    INDEX `idx_trips_sync_status`(`sync_status`),
    UNIQUE INDEX `uq_user_local_trip`(`user_id`, `local_trip_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trip_files` (
    `id` CHAR(36) NOT NULL,
    `trip_id` CHAR(36) NOT NULL,
    `file_type` ENUM('raw_track_jsonl', 'processed_geojson', 'thumbnail') NOT NULL,
    `original_filename` VARCHAR(255) NULL,
    `stored_filename` VARCHAR(255) NOT NULL,
    `file_path` TEXT NOT NULL,
    `mime_type` VARCHAR(100) NULL,
    `size_bytes` BIGINT NOT NULL DEFAULT 0,
    `checksum_sha256` VARCHAR(255) NULL,
    `uploaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_trip_files_trip_id`(`trip_id`),
    INDEX `idx_trip_files_file_type`(`file_type`),
    UNIQUE INDEX `uq_trip_file_type`(`trip_id`, `file_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sync_logs` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `trip_id` CHAR(36) NULL,
    `action` ENUM('upload_trip', 'upload_track_file', 'update_trip', 'delete_trip') NOT NULL,
    `status` ENUM('success', 'failed') NOT NULL,
    `error_message` TEXT NULL,
    `request_id` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_sync_logs_user_id`(`user_id`),
    INDEX `idx_sync_logs_trip_id`(`trip_id`),
    INDEX `idx_sync_logs_created_at`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `trips` ADD CONSTRAINT `trips_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trip_files` ADD CONSTRAINT `trip_files_trip_id_fkey` FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sync_logs` ADD CONSTRAINT `sync_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sync_logs` ADD CONSTRAINT `sync_logs_trip_id_fkey` FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
