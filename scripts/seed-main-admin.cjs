const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] ?? process.env.MAIN_ADMIN_EMAIL ?? "admin@apz.ru";
  const password = process.argv[3] ?? process.env.MAIN_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("Usage: node scripts/seed-main-admin.cjs <email> <password>");
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    console.log("Main admin already exists:", email);
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      email,
      password: hash,
      role: "MAIN_APZ_ADMIN",
      isApproved: true,
    },
  });

  console.log("Main admin created:", email);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
