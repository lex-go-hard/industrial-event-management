export type AppRole = "MAIN_APZ_ADMIN" | "ZAVUCH" | "CLASS_TEACHER";

export interface DashboardAccess {
  role: AppRole;
  allowedPaths: string[]; // ["/dashboard/admin", "/dashboard/zavuch", "/dashboard/teacher"]
}

// Profile class report payload used for import/export.
export interface ProfileClassReport {
  profileClassId: string;
  name: string;
  formationYear: number;
  studentCount: number;
  gradeLevel?: number | null;
  schoolId: string;
  classTeacherId?: string | null;
}
