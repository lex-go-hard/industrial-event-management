import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MAIN_ADMIN_EMAIL = "admin@apz.ru";

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env`);
  return value;
}

async function createMainAdmin() {
  const password = getRequiredEnv("MAIN_ADMIN_PASSWORD");
  const existing = await prisma.user.findUnique({
    where: { email: MAIN_ADMIN_EMAIL },
    select: { id: true },
  });
  if (existing) {
    console.log(`Main admin already exists: ${MAIN_ADMIN_EMAIL}`);
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      email: MAIN_ADMIN_EMAIL,
      password: hash,
      role: "MAIN_APZ_ADMIN",
      isApproved: true,
    },
  });
  console.log(`Main admin created: ${MAIN_ADMIN_EMAIL}`);
}

async function createTestSchoolsAndZavuch() {
  const testSchools = [
    { name: "Школа №28", region: "Нижегородская область", apzCode: "APZ-28" },
    { name: "Школа №12", region: "Удмуртская Республика", apzCode: "APZ-12" },
    { name: "Гимназия №5", region: "Пермский край", apzCode: "APZ-05" },
  ];

  const zavuchPassword = process.env.TEST_ZAVUCH_PASSWORD ?? "Test12345!";
  const hash = await bcrypt.hash(zavuchPassword, 12);

  for (let i = 0; i < testSchools.length; i++) {
    const data = testSchools[i];
    const school =
      (await prisma.school.findFirst({
        where: { name: data.name },
      })) ??
      (await prisma.school.create({
        data,
      }));
    if (school) {
      console.log(`School ready: ${school.name}`);
    }

    const email = `zavuch${i + 1}@school.local`;
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        password: hash,
        role: "ZAVUCH",
        schoolId: school.id,
        isApproved: false,
      },
      update: {
        role: "ZAVUCH",
        schoolId: school.id,
        isApproved: false,
        deletedAt: null,
      },
    });
    console.log(`Zavuch ready: ${email} (${school.name})`);

    const existingRequest = await prisma.confirmationRequest.findFirst({
      where: { userId: user.id, status: "PENDING" },
      select: { id: true },
    });
    if (!existingRequest) {
      await prisma.confirmationRequest.create({
        data: {
          userId: user.id,
          status: "PENDING",
          schoolId: school.id,
        },
      });
      console.log(`Confirmation request created for: ${email}`);
    }

    // Teachers + classes + students + profile classes
    const teacherEmails = [
      `teacher${i + 1}-1@school.local`,
      `teacher${i + 1}-2@school.local`,
      `teacher${i + 1}-3@school.local`,
    ];
    const teachers = await Promise.all(
      teacherEmails.map((tEmail) =>
        prisma.user.upsert({
          where: { email: tEmail },
          create: {
            email: tEmail,
            password: hash,
            role: "CLASS_TEACHER",
            schoolId: school.id,
            isApproved: true,
          },
          update: {
            role: "CLASS_TEACHER",
            schoolId: school.id,
            isApproved: true,
            deletedAt: null,
          },
        }),
      ),
    );
    teachers.forEach((t) => console.log(`Teacher ready: ${t.email} (${school.name})`));

    const profileClass = await prisma.profileClass.create({
      data: {
        name: "Ракеты АПЗ",
        formationYear: 2025,
        studentCount: 24,
        gradeLevel: 7,
        schoolId: school.id,
      },
    });

    const classNames = ["7У", "8У", "9У"];
    for (let c = 0; c < classNames.length; c++) {
      const cls = await prisma.schoolClass.create({
        data: {
          name: classNames[c],
          gradeLevel: 7 + c,
          schoolId: school.id,
          classTeacherId: teachers[c]?.id,
          profileClassId: profileClass.id,
        },
      });

      const students = await Promise.all(
        Array.from({ length: 3 }).map((_, idx) =>
          prisma.student.create({
            data: {
              lastName: `Ученик${idx + 1}`,
              firstName: `Класс${classNames[c]}`,
              schoolClassId: cls.id,
            },
          }),
        ),
      );

      for (const s of students) {
        await prisma.studentAchievement.create({
          data: {
            studentId: s.id,
            type: "AWARD",
            eventName: "Олимпиада по физике",
            result: "Призёр",
            place: "2 место",
            organizer: "АПЗ",
            date: new Date(),
          },
        });
      }
    }
  }
}

async function main() {
  await createMainAdmin();
  await createTestSchoolsAndZavuch();
  console.log("Seed completed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
