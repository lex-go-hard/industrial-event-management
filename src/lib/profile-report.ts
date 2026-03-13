import mammoth from "mammoth";
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun } from "docx";

import type { AppRole, ProfileClassReport } from "@/types";

function normalizeText(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function matchString(lines: string[], patterns: RegExp[]) {
  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match?.[1]) return normalizeText(match[1]);
    }
  }
  return "";
}

function matchNumber(lines: string[], patterns: RegExp[]) {
  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match?.[1]) {
        const num = Number(match[1].replace(/\s/g, ""));
        if (Number.isFinite(num)) return num;
      }
    }
  }
  return null;
}

export async function parseProfileReportDocx(buffer: Buffer): Promise<ProfileClassReport> {
  const res = await mammoth.extractRawText({ buffer });
  const raw = res.value ?? "";
  const lines = raw
    .split(/\r?\n/)
    .map((l) => normalizeText(l))
    .filter(Boolean);

  const profileClassId = matchString(lines, [
    /profile\s*class\s*id\s*[:\-]\s*(.+)$/i,
    /profileClassId\s*[:\-]\s*(.+)$/i,
    /ид\s*профильного\s*класса\s*[:\-]\s*(.+)$/i,
  ]);

  const name = matchString(lines, [
    /профильн(?:ый|ого)\s*класс\s*[:\-]\s*(.+)$/i,
    /название\s*класса\s*[:\-]\s*(.+)$/i,
    /^класс\s*[:\-]\s*(.+)$/i,
  ]);

  const formationYear = matchNumber(lines, [
    /год\s*формирован(?:ия|е)\s*[:\-]\s*(\d{4})/i,
    /formation\s*year\s*[:\-]\s*(\d{4})/i,
  ]);

  const studentCount = matchNumber(lines, [
    /(?:кол-?во|количество|число)\s*(?:учеников|учащихся)\s*[:\-]\s*(\d+)/i,
    /student\s*count\s*[:\-]\s*(\d+)/i,
  ]);

  const gradeLevel = matchNumber(lines, [
    /класс\s*обучения\s*[:\-]\s*(\d+)/i,
    /уровень\s*класса\s*[:\-]\s*(\d+)/i,
    /grade\s*level\s*[:\-]\s*(\d+)/i,
  ]);

  const schoolId = matchString(lines, [
    /school\s*id\s*[:\-]\s*(.+)$/i,
    /schoolId\s*[:\-]\s*(.+)$/i,
    /ид\s*школы\s*[:\-]\s*(.+)$/i,
  ]);

  const classTeacherId = matchString(lines, [
    /class\s*teacher\s*id\s*[:\-]\s*(.+)$/i,
    /classTeacherId\s*[:\-]\s*(.+)$/i,
    /ид\s*классного\s*руководителя\s*[:\-]\s*(.+)$/i,
  ]);

  if (!profileClassId || !name || !formationYear || !studentCount || !schoolId) {
    const missing = [
      !profileClassId ? "profileClassId" : null,
      !name ? "name" : null,
      !formationYear ? "formationYear" : null,
      !studentCount ? "studentCount" : null,
      !schoolId ? "schoolId" : null,
    ].filter(Boolean);
    throw new Error(`INVALID_PROFILE_REPORT: missing ${missing.join(", ")}`);
  }

  return {
    profileClassId,
    name,
    formationYear,
    studentCount,
    gradeLevel,
    schoolId,
    classTeacherId: classTeacherId || null,
  };
}

function roleLabel(role: AppRole) {
  switch (role) {
    case "MAIN_APZ_ADMIN":
      return "Главный админ АПЗ";
    case "ZAVUCH":
      return "Завуч";
    case "CLASS_TEACHER":
      return "Классный руководитель";
    default:
      return role;
  }
}

function textCell(value: string) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun(value)] })],
  });
}

export async function generateProfileReportDocx(params: {
  reports: ProfileClassReport[];
  role: AppRole;
  schoolName?: string;
  schoolNamesById?: Record<string, string>;
  downloadedBy?: string;
}) {
  const { reports, role, schoolName, schoolNamesById, downloadedBy } = params;

  const uniqueSchoolIds = new Set(reports.map((r) => r.schoolId));
  const isMultiSchool = uniqueSchoolIds.size > 1;
  const title = isMultiSchool ? "Сводный отчет по профильным классам" : "Отчет по профильному классу";
  const schoolTitle = isMultiSchool
    ? `Количество школ: ${uniqueSchoolIds.size}`
    : `Школа: ${schoolName ?? (reports[0] ? (schoolNamesById?.[reports[0].schoolId] ?? "Не указана") : "Не указана")}`;

  const header = [
    new Paragraph({ children: [new TextRun({ text: title, bold: true })] }),
    new Paragraph({ children: [new TextRun(schoolTitle)] }),
    new Paragraph({ children: [new TextRun(`Роль: ${roleLabel(role)}`)] }),
    new Paragraph({ children: [new TextRun(`Дата выгрузки: ${new Date().toLocaleDateString("ru-RU")}`)] }),
  ];
  if (downloadedBy) {
    header.push(new Paragraph({ children: [new TextRun(`Выгрузил: ${downloadedBy}`)] }));
  }

  const tableRows: TableRow[] = [];
  tableRows.push(
    new TableRow({
      children: [
        textCell("Школа"),
        textCell("Профильный класс"),
        textCell("Год формирования"),
        textCell("Класс"),
        textCell("Кол-во учеников"),
        textCell("ClassTeacherId"),
        textCell("ProfileClassId"),
        textCell("SchoolId"),
      ],
    }),
  );

  for (const report of reports) {
    const schoolLabel = schoolNamesById?.[report.schoolId] ?? schoolName ?? report.schoolId;
    tableRows.push(
      new TableRow({
        children: [
          textCell(schoolLabel),
          textCell(report.name),
          textCell(String(report.formationYear)),
          textCell(report.gradeLevel ? String(report.gradeLevel) : ""),
          textCell(String(report.studentCount)),
          textCell(report.classTeacherId ?? ""),
          textCell(report.profileClassId),
          textCell(report.schoolId),
        ],
      }),
    );
  }

  const doc = new Document({
    sections: [
      {
        children: [
          ...header,
          new Paragraph({ text: "" }),
          new Table({ rows: tableRows }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
