-- Seed default admin user (password is bcrypt-hashed, not plaintext)
INSERT INTO "User" ("id", "email", "name", "password", "roleId", "createdAt", "updatedAt")
VALUES (
    '3b0ff66b-6356-45c3-882c-63311ac5138f',
    'admin@fertilizer.com',
    'Admin',
    '$2b$10$Dl.HUc3E/HzSb8Sdfz5ocOV5RNddsFh54wkJ.7/EAnK/sKaJe5ApW',
    (SELECT "id" FROM "Role" WHERE "name" = 'Admin'),
    now(),
    now()
)
ON CONFLICT ("email") DO NOTHING;
