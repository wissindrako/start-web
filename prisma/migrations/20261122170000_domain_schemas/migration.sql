-- One PostgreSQL schema per domain, with Spanish names (CLAUDE.md, "Decisions").
--
-- Tables and enums move with SET SCHEMA: data, indexes, constraints and
-- foreign keys stay as they are (nothing is copied or recreated). Prisma's
-- own history table (_prisma_migrations) and the uuid-ossp extension stay in
-- public. Raw SQL that names these tables must now qualify them, e.g.
-- identidad."user" or acceso.role.

CREATE SCHEMA IF NOT EXISTS "identidad";
CREATE SCHEMA IF NOT EXISTS "acceso";
CREATE SCHEMA IF NOT EXISTS "configuracion";
CREATE SCHEMA IF NOT EXISTS "demo";

ALTER TYPE "public"."UserRole" SET SCHEMA "identidad";
ALTER TYPE "public"."Genero" SET SCHEMA "identidad";
ALTER TYPE "public"."RoleScope" SET SCHEMA "acceso";
ALTER TYPE "public"."PermissionEffect" SET SCHEMA "acceso";

ALTER TABLE "public"."user" SET SCHEMA "identidad";
ALTER TABLE "public"."personal_data" SET SCHEMA "identidad";
ALTER TABLE "public"."invitation" SET SCHEMA "identidad";
ALTER TABLE "public"."twoFactor" SET SCHEMA "identidad";
ALTER TABLE "public"."session" SET SCHEMA "identidad";
ALTER TABLE "public"."account" SET SCHEMA "identidad";
ALTER TABLE "public"."verification" SET SCHEMA "identidad";
ALTER TABLE "public"."jwks" SET SCHEMA "identidad";
ALTER TABLE "public"."oauthClient" SET SCHEMA "identidad";
ALTER TABLE "public"."oauthResource" SET SCHEMA "identidad";
ALTER TABLE "public"."oauthClientResource" SET SCHEMA "identidad";
ALTER TABLE "public"."oauthRefreshToken" SET SCHEMA "identidad";
ALTER TABLE "public"."oauthAccessToken" SET SCHEMA "identidad";
ALTER TABLE "public"."oauthConsent" SET SCHEMA "identidad";
ALTER TABLE "public"."oauthClientAssertion" SET SCHEMA "identidad";
ALTER TABLE "public"."_InvitationToRole" SET SCHEMA "identidad";

ALTER TABLE "public"."external_system" SET SCHEMA "acceso";
ALTER TABLE "public"."external_module" SET SCHEMA "acceso";
ALTER TABLE "public"."role" SET SCHEMA "acceso";
ALTER TABLE "public"."user_role_assignment" SET SCHEMA "acceso";
ALTER TABLE "public"."permission" SET SCHEMA "acceso";
ALTER TABLE "public"."role_permission" SET SCHEMA "acceso";
ALTER TABLE "public"."user_permission_override" SET SCHEMA "acceso";

ALTER TABLE "public"."system_config" SET SCHEMA "configuracion";
ALTER TABLE "public"."access_settings" SET SCHEMA "configuracion";
ALTER TABLE "public"."mail_settings" SET SCHEMA "configuracion";

ALTER TABLE "public"."book" SET SCHEMA "demo";
ALTER TABLE "public"."author" SET SCHEMA "demo";
ALTER TABLE "public"."genre" SET SCHEMA "demo";
ALTER TABLE "public"."publisher" SET SCHEMA "demo";
