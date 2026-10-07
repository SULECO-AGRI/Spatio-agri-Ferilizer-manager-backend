import bcrypt from "bcryptjs";
import prisma from "../src/config/prisma";

async function main() {
  console.log("🌱 Starting Spatio-Agri database seeding...");

  // 1. Seed Core Roles
  const roles = [
    { roleId: 1, name: "Admin" },
    { roleId: 2, name: "Farmer" },
    { roleId: 3, name: "Pilot" },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { roleId: role.roleId },
      update: { name: role.name },
      create: {
        roleId: role.roleId,
        name: role.name,
      },
    });
  }
  console.log("✅ Seeded core roles: Admin, Farmer, Pilot");

  // 2. Seed Default Admin User & Profile
  const adminPasswordHash = await bcrypt.hash("Admin@123456", 10);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@fertilizer.com" },
    update: {
      password: adminPasswordHash,
      firstName: "Admin",
      lastName: "System",
      mobile: "+94770000001",
      roleId: 1,
    },
    create: {
      email: "admin@fertilizer.com",
      password: adminPasswordHash,
      firstName: "Admin",
      lastName: "System",
      mobile: "+94770000001",
      roleId: 1,
      adminProfile: {
        create: {
          department: "Executive",
          accessLevel: "SuperAdmin",
        },
      },
    },
  });

  await prisma.adminProfile.upsert({
    where: { userId: adminUser.userId },
    update: {
      department: "Executive",
      accessLevel: "SuperAdmin",
    },
    create: {
      userId: adminUser.userId,
      department: "Executive",
      accessLevel: "SuperAdmin",
    },
  });
  console.log(`✅ Seeded default Admin user: ${adminUser.email} (ID: ${adminUser.userId})`);

  console.log("🚀 Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Database seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
