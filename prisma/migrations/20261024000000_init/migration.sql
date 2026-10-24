-- CreateTable
CREATE TABLE `user` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `emailVerified` BOOLEAN NOT NULL,
    `image` VARCHAR(191) NULL,
    `imageThumbnail` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `role` ENUM('user', 'admin') NULL,
    `banned` BOOLEAN NULL,
    `banReason` VARCHAR(191) NULL,
    `banExpires` DATETIME(3) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `twoFactorEnabled` BOOLEAN NULL DEFAULT false,

    UNIQUE INDEX `user_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `personal_data` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NULL,
    `primerApellido` VARCHAR(191) NULL,
    `segundoApellido` VARCHAR(191) NULL,
    `tipoDocumento` VARCHAR(191) NULL,
    `numeroDocumento` VARCHAR(191) NULL,
    `fechaNacimiento` DATETIME(3) NULL,
    `genero` ENUM('M', 'F') NULL,
    `telefono` VARCHAR(191) NULL,
    `telefonoAlternativo` VARCHAR(191) NULL,
    `pais` VARCHAR(191) NULL,
    `departamento` VARCHAR(191) NULL,
    `ciudad` VARCHAR(191) NULL,
    `direccion` VARCHAR(191) NULL,
    `codigoPostal` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `personal_data_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invitation` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `systemId` VARCHAR(191) NULL,
    `invitedById` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `acceptedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `invitation_email_idx`(`email`),
    INDEX `invitation_systemId_idx`(`systemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `twoFactor` (
    `id` VARCHAR(191) NOT NULL,
    `secret` TEXT NOT NULL,
    `backupCodes` TEXT NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `verified` BOOLEAN NULL DEFAULT true,
    `failedVerificationCount` INTEGER NULL DEFAULT 0,
    `lockedUntil` DATETIME(3) NULL,

    INDEX `twoFactor_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `external_system` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NULL,
    `apiKey` VARCHAR(191) NOT NULL,
    `oauthClientId` VARCHAR(191) NULL,
    `resourceIdentifier` VARCHAR(191) NULL,
    `serviceClientId` VARCHAR(191) NULL,
    `catalogSyncedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `external_system_name_key`(`name`),
    UNIQUE INDEX `external_system_apiKey_key`(`apiKey`),
    UNIQUE INDEX `external_system_oauthClientId_key`(`oauthClientId`),
    UNIQUE INDEX `external_system_resourceIdentifier_key`(`resourceIdentifier`),
    UNIQUE INDEX `external_system_serviceClientId_key`(`serviceClientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `external_module` (
    `id` VARCHAR(191) NOT NULL,
    `systemId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `actions` JSON NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `external_module_systemId_name_key`(`systemId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `scope` ENUM('local', 'external') NOT NULL DEFAULT 'local',
    `systemId` VARCHAR(191) NULL,

    UNIQUE INDEX `role_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_role_assignment` (
    `userId` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`userId`, `roleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permission` (
    `id` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `permission_subject_action_key`(`subject`, `action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permission` (
    `roleId` VARCHAR(191) NOT NULL,
    `permissionId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`roleId`, `permissionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session` (
    `id` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `impersonatedBy` VARCHAR(191) NULL,

    INDEX `session_userId_idx`(`userId`),
    UNIQUE INDEX `session_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `account` (
    `id` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `providerId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `accessToken` TEXT NULL,
    `refreshToken` TEXT NULL,
    `idToken` TEXT NULL,
    `accessTokenExpiresAt` DATETIME(3) NULL,
    `refreshTokenExpiresAt` DATETIME(3) NULL,
    `scope` TEXT NULL,
    `password` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `account_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `verification` (
    `id` VARCHAR(191) NOT NULL,
    `identifier` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NULL,

    INDEX `verification_identifier_idx`(`identifier`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_config` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'singleton',
    `systemName` VARCHAR(191) NULL,
    `logoUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `access_settings` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'singleton',
    `signupEnabled` BOOLEAN NOT NULL,
    `allowedDomains` JSON NOT NULL,
    `loginCodeMinutes` INTEGER NOT NULL,
    `invitationDays` INTEGER NOT NULL,
    `twoFactorRequired` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mail_settings` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'singleton',
    `mailer` VARCHAR(191) NOT NULL DEFAULT 'smtp',
    `host` VARCHAR(191) NULL,
    `port` INTEGER NULL,
    `encryption` VARCHAR(191) NOT NULL DEFAULT 'auto',
    `username` VARCHAR(191) NULL,
    `password` TEXT NULL,
    `fromAddress` VARCHAR(191) NOT NULL,
    `fromName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `book` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `author` VARCHAR(191) NOT NULL,
    `genreId` VARCHAR(191) NOT NULL,
    `publisher` VARCHAR(191) NULL,
    `coverId` VARCHAR(191) NULL,

    UNIQUE INDEX `book_title_author_key`(`title`, `author`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `author` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `name` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `author_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `genre` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `genre_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `publisher` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `name` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `publisher_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `jwks` (
    `id` VARCHAR(191) NOT NULL,
    `publicKey` TEXT NOT NULL,
    `privateKey` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `expiresAt` DATETIME(3) NULL,
    `alg` TEXT NULL,
    `crv` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `oauthClient` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `clientSecret` TEXT NULL,
    `clientDiscoveryId` TEXT NULL,
    `disabled` BOOLEAN NULL DEFAULT false,
    `skipConsent` BOOLEAN NULL,
    `enableEndSession` BOOLEAN NULL,
    `subjectType` TEXT NULL,
    `scopes` VARCHAR(191) NULL,
    `clientCredentialsScopes` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NULL,
    `name` TEXT NULL,
    `uri` TEXT NULL,
    `icon` TEXT NULL,
    `contacts` VARCHAR(191) NULL,
    `tos` TEXT NULL,
    `policy` TEXT NULL,
    `softwareId` TEXT NULL,
    `softwareVersion` TEXT NULL,
    `softwareStatement` TEXT NULL,
    `redirectUris` VARCHAR(191) NOT NULL,
    `postLogoutRedirectUris` VARCHAR(191) NULL,
    `backchannelLogoutUri` TEXT NULL,
    `backchannelLogoutSessionRequired` BOOLEAN NULL,
    `tokenEndpointAuthMethod` TEXT NULL,
    `applicationType` TEXT NULL,
    `jwks` TEXT NULL,
    `jwksUri` TEXT NULL,
    `grantTypes` VARCHAR(191) NULL,
    `responseTypes` VARCHAR(191) NULL,
    `requirePKCE` BOOLEAN NULL,
    `dpopBoundAccessTokens` BOOLEAN NULL DEFAULT false,
    `referenceId` TEXT NULL,
    `metadata` VARCHAR(191) NULL,

    INDEX `oauthClient_userId_idx`(`userId`),
    UNIQUE INDEX `oauthClient_clientId_key`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `oauthResource` (
    `id` VARCHAR(191) NOT NULL,
    `identifier` VARCHAR(191) NOT NULL,
    `name` TEXT NOT NULL,
    `accessTokenTtl` INTEGER NULL,
    `refreshTokenTtl` INTEGER NULL,
    `signingAlgorithm` TEXT NULL,
    `signingKeyId` TEXT NULL,
    `allowedScopes` VARCHAR(191) NULL,
    `customClaims` VARCHAR(191) NULL,
    `dpopBoundAccessTokensRequired` BOOLEAN NULL DEFAULT false,
    `disabled` BOOLEAN NULL DEFAULT false,
    `createdAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NULL,
    `policyVersion` INTEGER NULL DEFAULT 1,
    `metadata` VARCHAR(191) NULL,

    UNIQUE INDEX `oauthResource_identifier_key`(`identifier`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `oauthClientResource` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `resourceId` VARCHAR(191) NOT NULL,
    `metadata` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NULL,

    INDEX `oauthClientResource_clientId_idx`(`clientId`),
    INDEX `oauthClientResource_resourceId_idx`(`resourceId`),
    UNIQUE INDEX `oauthClientResource_clientId_resourceId_uidx`(`clientId`, `resourceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `oauthRefreshToken` (
    `id` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `referenceId` TEXT NULL,
    `authorizationCodeId` TEXT NULL,
    `resources` VARCHAR(191) NULL,
    `requestedUserInfoClaims` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `revoked` DATETIME(3) NULL,
    `rotatedAt` DATETIME(3) NULL,
    `rotationReplayResponse` TEXT NULL,
    `rotationReplayExpiresAt` DATETIME(3) NULL,
    `authTime` DATETIME(3) NULL,
    `confirmation` VARCHAR(191) NULL,
    `scopes` VARCHAR(191) NOT NULL,

    INDEX `oauthRefreshToken_clientId_idx`(`clientId`),
    INDEX `oauthRefreshToken_sessionId_idx`(`sessionId`),
    INDEX `oauthRefreshToken_userId_idx`(`userId`),
    INDEX `oauthRefreshToken_authorizationCodeId_idx`(`authorizationCodeId`(191)),
    UNIQUE INDEX `oauthRefreshToken_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `oauthAccessToken` (
    `id` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `referenceId` TEXT NULL,
    `authorizationCodeId` TEXT NULL,
    `resources` VARCHAR(191) NULL,
    `requestedUserInfoClaims` VARCHAR(191) NULL,
    `refreshId` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `revoked` DATETIME(3) NULL,
    `confirmation` VARCHAR(191) NULL,
    `scopes` VARCHAR(191) NOT NULL,

    INDEX `oauthAccessToken_clientId_idx`(`clientId`),
    INDEX `oauthAccessToken_sessionId_idx`(`sessionId`),
    INDEX `oauthAccessToken_userId_idx`(`userId`),
    INDEX `oauthAccessToken_authorizationCodeId_idx`(`authorizationCodeId`(191)),
    INDEX `oauthAccessToken_refreshId_idx`(`refreshId`),
    UNIQUE INDEX `oauthAccessToken_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `oauthConsent` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `referenceId` TEXT NULL,
    `resources` VARCHAR(191) NULL,
    `requestedUserInfoClaims` VARCHAR(191) NULL,
    `scopes` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `oauthConsent_clientId_idx`(`clientId`),
    INDEX `oauthConsent_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `oauthClientAssertion` (
    `id` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_permission_override` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `systemId` VARCHAR(191) NULL,
    `permissionId` VARCHAR(191) NOT NULL,
    `effect` ENUM('grant', 'deny') NOT NULL,
    `reason` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NULL,
    `grantedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `user_permission_override_permissionId_idx`(`permissionId`),
    UNIQUE INDEX `user_permission_override_userId_systemId_permissionId_key`(`userId`, `systemId`, `permissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_InvitationToRole` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_InvitationToRole_AB_unique`(`A`, `B`),
    INDEX `_InvitationToRole_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `personal_data` ADD CONSTRAINT `personal_data_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invitation` ADD CONSTRAINT `invitation_systemId_fkey` FOREIGN KEY (`systemId`) REFERENCES `external_system`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invitation` ADD CONSTRAINT `invitation_invitedById_fkey` FOREIGN KEY (`invitedById`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `twoFactor` ADD CONSTRAINT `twoFactor_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `external_system` ADD CONSTRAINT `external_system_oauthClientId_fkey` FOREIGN KEY (`oauthClientId`) REFERENCES `oauthClient`(`clientId`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `external_module` ADD CONSTRAINT `external_module_systemId_fkey` FOREIGN KEY (`systemId`) REFERENCES `external_system`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role` ADD CONSTRAINT `role_systemId_fkey` FOREIGN KEY (`systemId`) REFERENCES `external_system`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_role_assignment` ADD CONSTRAINT `user_role_assignment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_role_assignment` ADD CONSTRAINT `user_role_assignment_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permission` ADD CONSTRAINT `role_permission_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permission` ADD CONSTRAINT `role_permission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session` ADD CONSTRAINT `session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `account` ADD CONSTRAINT `account_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `book` ADD CONSTRAINT `book_genreId_fkey` FOREIGN KEY (`genreId`) REFERENCES `genre`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oauthClient` ADD CONSTRAINT `oauthClient_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oauthClientResource` ADD CONSTRAINT `oauthClientResource_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `oauthClient`(`clientId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oauthClientResource` ADD CONSTRAINT `oauthClientResource_resourceId_fkey` FOREIGN KEY (`resourceId`) REFERENCES `oauthResource`(`identifier`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oauthRefreshToken` ADD CONSTRAINT `oauthRefreshToken_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `oauthClient`(`clientId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oauthRefreshToken` ADD CONSTRAINT `oauthRefreshToken_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `session`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oauthRefreshToken` ADD CONSTRAINT `oauthRefreshToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oauthAccessToken` ADD CONSTRAINT `oauthAccessToken_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `oauthClient`(`clientId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oauthAccessToken` ADD CONSTRAINT `oauthAccessToken_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `session`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oauthAccessToken` ADD CONSTRAINT `oauthAccessToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oauthAccessToken` ADD CONSTRAINT `oauthAccessToken_refreshId_fkey` FOREIGN KEY (`refreshId`) REFERENCES `oauthRefreshToken`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oauthConsent` ADD CONSTRAINT `oauthConsent_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `oauthClient`(`clientId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oauthConsent` ADD CONSTRAINT `oauthConsent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_permission_override` ADD CONSTRAINT `user_permission_override_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_permission_override` ADD CONSTRAINT `user_permission_override_systemId_fkey` FOREIGN KEY (`systemId`) REFERENCES `external_system`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_permission_override` ADD CONSTRAINT `user_permission_override_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_permission_override` ADD CONSTRAINT `user_permission_override_grantedById_fkey` FOREIGN KEY (`grantedById`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_InvitationToRole` ADD CONSTRAINT `_InvitationToRole_A_fkey` FOREIGN KEY (`A`) REFERENCES `invitation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_InvitationToRole` ADD CONSTRAINT `_InvitationToRole_B_fkey` FOREIGN KEY (`B`) REFERENCES `role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

