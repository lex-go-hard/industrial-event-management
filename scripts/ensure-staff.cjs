const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

function randomPassword(length = 12) {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

async function main() {
  const created = [];
  const schools = await prisma.school.findMany({
    select: { id: true, name: true, apzCode: true },
    orderBy: { name: "asc" },
  });

  for (const school of schools) {
    const zavuchs = await prisma.user.findMany({
      where: { schoolId: school.id, role: "ZAVUCH" },
      select: { id: true, email: true },
      orderBy: { email: "asc" },
    });

    if (zavuchs.length === 0) {
      const password = randomPassword();
      const passwordHash = await bcrypt.hash(password, 12);
      const apzSafe = (school.apzCode || school.id).toLowerCase().replace(/\s+/g, "-");
      const email = `zavuch+${apzSafe}@example.local`;
      const user = await prisma.user.create({
        data: {
          email,
          password: passwordHash,
          role: "ZAVUCH",
          schoolId: school.id,
          isApproved: true,
        },
      });
      created.push({ role: "ZAVUCH", email, password, school: school.name, id: user.id });
    } else if (zavuchs.length > 1) {
      const keep = zavuchs[0];
      const toDemote = zavuchs.slice(1).map((u) => u.id);
      await prisma.user.updateMany({
        where: { id: { in: toDemote } },
        data: { role: "CLASS_TEACHER" },
      });
      console.log(`School ${school.name}: kept zavuch ${keep.email}, demoted ${toDemote.length}`);
    }
  }

  const classes = await prisma.schoolClass.findMany({
    select: { id: true, name: true, schoolId: true, classTeacherId: true },
  });

  for (const cls of classes) {
    if (cls.classTeacherId) {
      const teacher = await prisma.user.findUnique({
        where: { id: cls.classTeacherId },
        select: { id: true, role: true, schoolId: true },
      });
      if (teacher && (teacher.role !== "CLASS_TEACHER" || teacher.schoolId !== cls.schoolId)) {
        await prisma.user.update({
          where: { id: teacher.id },
          data: { role: "CLASS_TEACHER", schoolId: cls.schoolId },
        });
      }
      continue;
    }

    const teacher = await prisma.user.findFirst({
      where: { schoolId: cls.schoolId, role: "CLASS_TEACHER" },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });

    if (teacher) {
      await prisma.schoolClass.update({
        where: { id: cls.id },
        data: { classTeacherId: teacher.id },
      });
      continue;
    }

    const password = randomPassword();
    const passwordHash = await bcrypt.hash(password, 12);
    const email = `teacher+${cls.id}@example.local`;
    const user = await prisma.user.create({
      data: {
        email,
        password: passwordHash,
        role: "CLASS_TEACHER",
        schoolId: cls.schoolId,
        isApproved: true,
      },
    });
    await prisma.schoolClass.update({
      where: { id: cls.id },
      data: { classTeacherId: user.id },
    });
    created.push({ role: "CLASS_TEACHER", email, password, classId: cls.id, id: user.id });
  }

  if (created.length) {
    console.log("Created accounts:");
    for (const c of created) {
      console.log(c);
    }
  } else {
    console.log("No new accounts created.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });