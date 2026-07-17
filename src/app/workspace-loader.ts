import { api } from "../api";
import type {
  AnalysisInstruction,
  CallResponse,
  CompanyResponse,
  DepartmentMemberResponse,
  DepartmentResponse,
  Invitation,
  Subscription
} from "../types";

export type OrganizationContext = {
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  departmentMembers: DepartmentMemberResponse[];
  instructions: AnalysisInstruction[];
  companySubscriptions: Record<string, Subscription | null>;
};

export type WorkspaceContext = OrganizationContext & {
  calls: CallResponse[];
  invitations: Invitation[];
  personalSubscription: Subscription | null;
};

/** Loads organization-scoped data in one place so every refresh has identical fallback rules. */
export async function loadOrganizationContext(): Promise<OrganizationContext> {
  const companies = await api.listCompanies();
  const departments = (
    await Promise.all(companies.map((company) => api.listDepartments(company.id).catch(() => [])))
  ).flat();
  const [instructions, departmentMembers, subscriptionEntries] = await Promise.all([
    Promise.all([
      api.listInstructions("personal").catch(() => []),
      ...companies.map((company) => api.listInstructions("company", company.id).catch(() => [])),
      ...departments.map((department) =>
        api.listInstructions("department", department.company_uuid, department.id).catch(() => [])
      )
    ]).then((items) => items.flat()),
    Promise.all(
      departments.map((department) =>
        api.listDepartmentMembers(department.company_uuid, department.id).catch(() => [])
      )
    ).then((items) => items.flat()),
    Promise.all(
      companies.map(async (company) => [
        company.id,
        await api.getCompanySubscription(company.id).catch(() => null)
      ] as const)
    )
  ]);

  return {
    companies,
    departments,
    departmentMembers,
    instructions,
    companySubscriptions: Object.fromEntries(subscriptionEntries)
  };
}

export async function loadWorkspaceContext(): Promise<WorkspaceContext> {
  const [callsResponse, invitations, personalSubscription, organization] = await Promise.all([
    api.listCalls(),
    api.listMyInvitations().catch(() => []),
    api.getSubscription().catch(() => null),
    loadOrganizationContext()
  ]);

  return {
    calls: Array.isArray(callsResponse) ? callsResponse : callsResponse.items,
    invitations,
    personalSubscription,
    ...organization
  };
}
