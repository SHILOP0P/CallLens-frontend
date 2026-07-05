import {
  ArrowLeft,
  Download,
  FileText,
  Trash2,
  Upload
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import type {
  AnalysisInstruction,
  CompanyResponse,
  DepartmentMemberResponse,
  DepartmentResponse,
  InstructionScope,
  SessionState
} from "../../types";

import { activeDepartmentLeaderIds, isCompanyManager } from "../../shared/lib/access";
import { instructionScopeLabel } from "../../shared/lib/formatters";
import { InstructionListSkeleton } from "../../shared/ui/loading";
import { FileDropZone, SelectControl } from "../../shared/ui/primitives";
import { instructionContextLabel } from "./instruction-components";

export function InstructionsPage({
  session,
  instructions,
  companies,
  departments,
  departmentMembers,
  loading,
  onBackToSettings,
  onInstructionCreated
}: {
  session: SessionState;
  instructions: AnalysisInstruction[];
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  departmentMembers: DepartmentMemberResponse[];
  loading: boolean;
  onBackToSettings: () => void;
  onInstructionCreated: (instruction: AnalysisInstruction) => void;
}) {
  const [title, setTitle] = useState("Инструкция анализа продаж");
  const [localInstructions, setLocalInstructions] = useState(instructions);
  const managedCompanies = useMemo(
    () => companies.filter((company) => isCompanyManager(company, session.user.id)),
    [companies, session.user.id]
  );
  const managedCompanyIds = useMemo(
    () => new Set(managedCompanies.map((company) => company.id)),
    [managedCompanies]
  );
  const ledDepartmentIds = useMemo(
    () => activeDepartmentLeaderIds(departmentMembers, session.user.id),
    [departmentMembers, session.user.id]
  );
  const editableDepartments = useMemo(
    () =>
      departments.filter(
        (department) =>
          managedCompanyIds.has(department.company_uuid) || ledDepartmentIds.has(department.id)
      ),
    [departments, ledDepartmentIds, managedCompanyIds]
  );
  const editableDepartmentIds = useMemo(
    () => new Set(editableDepartments.map((department) => department.id)),
    [editableDepartments]
  );
  const companiesWithDepartments = useMemo(
    () =>
      companies.filter((company) =>
        editableDepartments.some((department) => department.company_uuid === company.id)
      ),
    [companies, editableDepartments]
  );
  const [scope, setScope] = useState<InstructionScope>("personal");
  const [companyId, setCompanyId] = useState(managedCompanies[0]?.id ?? "");
  const [departmentId, setDepartmentId] = useState(editableDepartments[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const availableInstructionScopes = useMemo<InstructionScope[]>(
    () => [
      "personal",
      ...(managedCompanies.length > 0 ? (["company"] as InstructionScope[]) : []),
      ...(editableDepartments.length > 0 ? (["department"] as InstructionScope[]) : [])
    ],
    [editableDepartments.length, managedCompanies.length]
  );
  const selectableCompanies = scope === "department" ? companiesWithDepartments : managedCompanies;
  const availableDepartments = editableDepartments.filter((department) => department.company_uuid === companyId);
  const personalInstructions = localInstructions.filter((instruction) => instruction.scope === "personal");
  const companyInstructions = localInstructions.filter(
    (instruction) =>
      instruction.scope === "company" &&
      Boolean(instruction.company_uuid && managedCompanyIds.has(instruction.company_uuid))
  );
  const departmentInstructions = localInstructions.filter(
    (instruction) =>
      instruction.scope === "department" &&
      Boolean(instruction.department_uuid && editableDepartmentIds.has(instruction.department_uuid))
  );
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
      setLocalInstructions((current) => [created, ...current]);
      onInstructionCreated(created);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Не удалось загрузить инструкцию");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    setLocalInstructions(instructions);
  }, [instructions]);

  useEffect(() => {
    let cancelled = false;

    async function loadSettingsInstructions() {
      const loaded = (
        await Promise.all([
          api.listInstructions({ scope: "personal", include_inactive: true }).catch(() => []),
          ...managedCompanies.map((company) =>
            api.listInstructions({ scope: "company", company_uuid: company.id, include_inactive: true }).catch(() => [])
          ),
          ...editableDepartments.map((department) =>
            api
              .listInstructions({
                scope: "department",
                company_uuid: department.company_uuid,
                department_uuid: department.id,
                include_inactive: true
              })
              .catch(() => [])
          )
        ])
      ).flat();

      if (!cancelled) setLocalInstructions(loaded);
    }

    loadSettingsInstructions();
    return () => {
      cancelled = true;
    };
  }, [managedCompanies, editableDepartments]);

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
    <section className="instructions-layout app-page settings-subpage-layout">
      <div className="settings-back-row">
        <button className="ghost-button small" type="button" onClick={onBackToSettings}>
          <ArrowLeft size={16} />
          Назад
        </button>
      </div>
      <form className="instructions-form glass" onSubmit={submit}>
        <div className="app-page-heading settings-heading compact-heading">
          <span className="settings-heading-icon" aria-hidden="true">
            <FileText size={26} />
          </span>
          <div>
            <h1>Инструкции</h1>
            <p>Инструкция определяет, как AI будет оценивать звонок в выбранном контексте.</p>
          </div>
        </div>
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
              onInstructionChanged={(updated) =>
                setLocalInstructions((current) => current.map((item) => item.id === updated.id ? updated : item))
              }
              onInstructionDeleted={(instructionId) =>
                setLocalInstructions((current) => current.filter((item) => item.id !== instructionId))
              }
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
  departments,
  onInstructionChanged,
  onInstructionDeleted
}: {
  title: string;
  instructions: AnalysisInstruction[];
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  onInstructionChanged: (instruction: AnalysisInstruction) => void;
  onInstructionDeleted: (instructionId: string) => void;
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
          onInstructionChanged={onInstructionChanged}
          onInstructionDeleted={onInstructionDeleted}
        />
      ))}
    </section>
  );
}

export function InstructionRow({
  instruction,
  companies,
  departments,
  onInstructionChanged,
  onInstructionDeleted
}: {
  instruction: AnalysisInstruction;
  companies: CompanyResponse[];
  departments: DepartmentResponse[];
  onInstructionChanged: (instruction: AnalysisInstruction) => void;
  onInstructionDeleted: (instructionId: string) => void;
}) {
  async function download() {
    const blob = await api.downloadInstruction(instruction.download_url || instruction.id);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = instruction.original_filename || `${instruction.title}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="instruction-row">
      <FileText size={20} />
      <div>
        <strong>{instruction.title}</strong>
        <small>
          {instructionContextLabel(instruction, companies, departments)} · {instruction.original_filename}
        </small>
      </div>
      <span className={`status-chip ${instruction.is_active ? "ok" : "warn"}`}>
        {instruction.is_active ? "Активна" : "Отключена"}
      </span>
      <div className="panel-actions">
        <button
          className="text-button"
          type="button"
          onClick={async () => {
            const updated = await api.updateInstruction(instruction.id, { is_active: !instruction.is_active });
            onInstructionChanged(updated);
          }}
        >
          {instruction.is_active ? "Отключить" : "Включить"}
        </button>
        <button className="icon-button" type="button" aria-label="Скачать инструкцию" onClick={download}>
          <Download size={16} />
        </button>
        <label className="icon-button" aria-label="Заменить файл">
          <Upload size={16} />
          <input
            type="file"
            accept=".md,text/markdown,text/plain"
            hidden
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const updated = await api.replaceInstructionFile(instruction.id, file);
              onInstructionChanged(updated);
            }}
          />
        </label>
        <button
          className="icon-button"
          type="button"
          aria-label="Удалить инструкцию"
          onClick={async () => {
            await api.deleteInstruction(instruction.id);
            onInstructionDeleted(instruction.id);
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
