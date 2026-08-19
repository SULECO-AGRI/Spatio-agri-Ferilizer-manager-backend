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

  // 3. Seed Sample Pilot User & Profile
  const pilotPasswordHash = await bcrypt.hash("Pilot@123456", 10);
  const pilotUser = await prisma.user.upsert({
    where: { email: "pilot.nimal@fertilizer.com" },
    update: {
      password: pilotPasswordHash,
      firstName: "Nimal",
      lastName: "Perera",
      mobile: "+94771234567",
      roleId: 3,
    },
    create: {
      email: "pilot.nimal@fertilizer.com",
      password: pilotPasswordHash,
      firstName: "Nimal",
      lastName: "Perera",
      mobile: "+94771234567",
      roleId: 3,
      pilotProfile: {
        create: {
          licenceNumber: "DP-2026-081",
          status: "ACTIVE",
          ratings: 4.95,
          completedMissions: 24,
          totalFlightHours: 142.50,
        },
      },
    },
  });

  await prisma.pilotProfile.upsert({
    where: { userId: pilotUser.userId },
    update: {
      licenceNumber: "DP-2026-081",
      status: "ACTIVE",
      ratings: 4.95,
      completedMissions: 24,
      totalFlightHours: 142.50,
    },
    create: {
      userId: pilotUser.userId,
      licenceNumber: "DP-2026-081",
      status: "ACTIVE",
      ratings: 4.95,
      completedMissions: 24,
      totalFlightHours: 142.50,
    },
  });
  console.log(`✅ Seeded sample Pilot user: ${pilotUser.email} (ID: ${pilotUser.userId})`);

  // 4. Seed Sample Farmer User, Profile & Sample Field
  const farmerPasswordHash = await bcrypt.hash("Farmer@123456", 10);
  const farmerUser = await prisma.user.upsert({
    where: { email: "farmer.kamal@fertilizer.com" },
    update: {
      password: farmerPasswordHash,
      firstName: "Kamal",
      lastName: "Silva",
      mobile: "+94779876543",
      roleId: 2,
    },
    create: {
      email: "farmer.kamal@fertilizer.com",
      password: farmerPasswordHash,
      firstName: "Kamal",
      lastName: "Silva",
      mobile: "+94779876543",
      roleId: 2,
      farmerProfile: {
        create: {
          nic: "198823489201",
          address: "No. 45, Station Road, Medawachchiya",
          memberSince: new Date("2024-01-15"),
        },
      },
    },
  });

  await prisma.farmerProfile.upsert({
    where: { userId: farmerUser.userId },
    update: {
      nic: "198823489201",
      address: "No. 45, Station Road, Medawachchiya",
    },
    create: {
      userId: farmerUser.userId,
      nic: "198823489201",
      address: "No. 45, Station Road, Medawachchiya",
      memberSince: new Date("2024-01-15"),
    },
  });
  console.log(`✅ Seeded sample Farmer user: ${farmerUser.email} (ID: ${farmerUser.userId})`);

  // 5. Seed Sample Field for Farmer
  const existingField = await prisma.field.findFirst({
    where: { farmerId: farmerUser.userId, fieldName: "North Paddy Field Alpha" },
  });

  if (!existingField) {
    const field = await prisma.field.create({
      data: {
        farmerId: farmerUser.userId,
        fieldName: "North Paddy Field Alpha",
        cropType: "Paddy (BG 352)",
        locationCoordinates: [
          [8.5361, 80.4922],
          [8.5385, 80.4945],
          [8.5372, 80.4971],
          [8.5348, 80.4952],
        ],
        area: 4.5,
        province: "North Central",
        district: "Anuradhapura",
        city: "Medawachchiya",
        village: "Kahatagasdigiliya",
      },
    });
    console.log(`✅ Seeded sample Field: ${field.fieldName} (ID: ${field.id})`);
  }

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
