import {
  FileText
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import type {
  AnalysisInstruction,
  CompanyResponse,
  DepartmentResponse,
  InstructionScope,
  SessionState
} from "../../types";

import { instructionScopeLabel } from "../../shared/lib/formatters";
import { InstructionListSkeleton } from "../../shared/ui/loading";
import { FileDropZone, SelectControl } from "../../shared/ui/primitives";
import { instructionContextLabel } from "./instruction-components";

export function InstructionsPage({
  session,
  instructions,
  companies,
  departments,
  loading,
  onInstructionCreated
}: {
  session: SessionState;
  instructions: AnalysisInstruction[];
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  loading: boolean;
  onInstructionCreated: (instruction: AnalysisInstruction) => void;
}) {
  const [title, setTitle] = useState("Инструкция анализа продаж");
  const managedCompanies = useMemo(
    () => companies.filter((company) => company.manager_user_uuid === session.user.id),
    [companies, session.user.id]
  );
  const managedCompanyIds = useMemo(
    () => new Set(managedCompanies.map((company) => company.id)),
    [managedCompanies]
  );
  const managedDepartments = useMemo(
    () => departments.filter((department) => managedCompanyIds.has(department.company_uuid)),
    [departments, managedCompanyIds]
  );
  const companiesWithDepartments = useMemo(
    () =>
      managedCompanies.filter((company) =>
        managedDepartments.some((department) => department.company_uuid === company.id)
      ),
    [managedCompanies, managedDepartments]
  );
  const [scope, setScope] = useState<InstructionScope>("personal");
  const [companyId, setCompanyId] = useState(managedCompanies[0]?.id ?? "");
  const [departmentId, setDepartmentId] = useState(managedDepartments[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const availableInstructionScopes: InstructionScope[] = [
    "personal",
    ...(managedCompanies.length > 0 ? (["company"] as InstructionScope[]) : []),
    ...(managedDepartments.length > 0 ? (["department"] as InstructionScope[]) : [])
  ];
  const selectableCompanies = scope === "department" ? companiesWithDepartments : managedCompanies;
  const availableDepartments = managedDepartments.filter((department) => department.company_uuid === companyId);
  const personalInstructions = instructions.filter((instruction) => instruction.scope === "personal");
  const companyInstructions = instructions.filter((instruction) => instruction.scope === "company");
  const departmentInstructions = instructions.filter((instruction) => instruction.scope === "department");
  const instructionSections = [
    {
      title: "Личная инструкция",
      instructions: personalInstructions
    },
    {
      title: "Инструкция компании",
      instructions: companyInstructions
    },
    {
      title: "Инструкция Отдела",
      instructions: departmentInstructions
    }
  ].filter((section) => section.instructions.length > 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Введите название инструкции.");
      return;
    }

    if (!file) {
      setError("Выберите markdown-файл.");
      return;
    }

    if (scope !== "personal" && !companyId) {
      setError("Выберите компанию.");
      return;
    }

    if (scope === "department" && !departmentId) {
      setError("Выберите отдел.");
      return;
    }

    setBusy(true);
    try {
      const created = await api.createInstruction({
        title,
        file,
        scope,
        companyUuid: scope !== "personal" ? companyId : undefined,
        departmentUuid: scope === "department" ? departmentId : undefined
      });
      onInstructionCreated(created);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Не удалось загрузить инструкцию");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!availableInstructionScopes.includes(scope)) {
      setScope("personal");
    }
  }, [availableInstructionScopes, scope]);

  useEffect(() => {
    if (scope === "personal") return;

    if (!selectableCompanies.some((company) => company.id === companyId)) {
      setCompanyId(selectableCompanies[0]?.id ?? "");
    }
  }, [companyId, scope, selectableCompanies]);

  useEffect(() => {
    if (scope !== "department") return;

    if (!availableDepartments.some((department) => department.id === departmentId)) {
      setDepartmentId(availableDepartments[0]?.id ?? "");
    }
  }, [availableDepartments, departmentId, scope]);

  return (
    <section className="instructions-layout">
      <form className="instructions-form glass" onSubmit={submit}>
        <h1>Инструкции для анализа</h1>
        <p>Инструкция определяет, как AI будет оценивать звонок в выбранном контексте.</p>
        <label>
          Название инструкции
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <div className="segmented scope">
          {availableInstructionScopes.map((item) => (
            <button
              type="button"
              key={item}
              className={scope === item ? "active" : ""}
              onClick={() => setScope(item)}
            >
              {instructionScopeLabel(item)}
            </button>
          ))}
        </div>
        {scope !== "personal" && (
          <div className="form-grid two">
            <label>
              Компания
              <SelectControl value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
                {selectableCompanies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </SelectControl>
            </label>
            {scope === "department" && (
              <label>
                Отдел
                <SelectControl value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
                  {availableDepartments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </SelectControl>
              </label>
            )}
          </div>
        )}
        <div>
          <span className="field-title">Markdown-файл</span>
          <FileDropZone
            file={file}
            icon={<FileText size={22} />}
            accept=".md,text/markdown,text/plain"
            buttonLabel="Выбрать файл"
            emptyLabel="Перетащите markdown-файл сюда"
            onFile={setFile}
          />
        </div>
        {error && <div className="form-error">{error}</div>}
        <button className="primary-button" disabled={busy}>
          {busy ? "Загружаю..." : "Сохранить инструкцию"}
        </button>
      </form>
      <div className="instructions-list glass">
        <h2>Активные инструкции</h2>
        {loading ? (
          <InstructionListSkeleton count={4} />
        ) : instructionSections.length === 0 ? (
          <div className="instruction-empty standalone">Инструкций пока нет.</div>
        ) : (
          instructionSections.map((section) => (
            <InstructionSection
              key={section.title}
              title={section.title}
              instructions={section.instructions}
              companies={companies}
              departments={departments}
            />
          ))
        )}
      </div>
    </section>
  );
}

export function InstructionSection({
  title,
  instructions,
  companies,
  departments
}: {
  title: string;
  instructions: AnalysisInstruction[];
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
}) {
  return (
    <section className="instruction-section">
      <div className="instruction-section-title">
        <span />
        <strong>{title}</strong>
        <span />
      </div>
      {instructions.map((instruction) => (
        <InstructionRow
          key={instruction.id}
          instruction={instruction}
          companies={companies}
          departments={departments}
        />
      ))}
    </section>
  );
}

export function InstructionRow({
  instruction,
  companies,
  departments
}: {
  instruction: AnalysisInstruction;
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
}) {
  return (
    <div className="instruction-row">
      <FileText size={20} />
      <div>
        <strong>{instruction.title}</strong>
        <small>
          {instructionContextLabel(instruction, companies, departments)} · {instruction.original_filename}
        </small>
      </div>
      <span className="status-chip ok">Активна</span>
    </div>
  );
}
