import type {
  CompanyResponse,
  DepartmentMemberResponse
} from "../../types";

export function isCompanyManager(company: CompanyResponse, userId: string) {
  return company.manager_user_uuid === userId;
}

export function activeDepartmentLeaderIds(members: DepartmentMemberResponse[], userId: string) {
  return new Set(
    members
      .filter(
        (member) =>
          member.user_uuid === userId &&
          member.role === "department_leader" &&
          member.status === "active"
      )
      .map((member) => member.department_uuid)
  );
}
